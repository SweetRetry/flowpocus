import {
  type CanvasCommandReceipt,
  type CanvasCommandRequest,
  canvasCommandReceiptSchema,
} from "@workspace/commands"
import { type CanvasEdge, type CanvasNode, canvases, db } from "@workspace/database"
import { eq } from "drizzle-orm"
import type * as Y from "yjs"
import { getHocuspocus, getPlacement } from "../collaboration"
import { CanvasCommandError, executeCanvasCommandInDocument } from "./canvas-command"

interface CanvasDocument {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

/** Where the canvas owner runs, or null when this instance should serve it. */
async function remoteOwner(canvasId: string): Promise<string | null> {
  const location = await getPlacement()?.locate(canvasId)
  return location?.kind === "remote" ? location.url : null
}

/**
 * Call the owner's public HTTP endpoint. Only the owner may open a direct
 * connection, so commands that land elsewhere run there instead.
 */
async function callOwner(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    })
  } catch {
    throw new CanvasCommandError(
      "OWNER_UNREACHABLE",
      503,
      "The instance owning this canvas is unreachable"
    )
  }

  const body = (await response.json()) as {
    error?: { code: string; message: string; details?: unknown }
  }
  if (!response.ok) {
    const error = body.error ?? { code: "OWNER_ERROR", message: "Canvas owner failed the request" }
    const status = response.status as CanvasCommandError["status"]
    throw new CanvasCommandError(error.code, status, error.message, error.details)
  }
  return body
}

async function transactCanvas<T>(
  canvasId: string,
  actor: Record<string, unknown>,
  fn: (document: Y.Doc) => T
): Promise<T> {
  const hocuspocus = getHocuspocus()
  if (!hocuspocus) {
    throw new CanvasCommandError(
      "COLLABORATION_UNAVAILABLE",
      503,
      "Collaboration server is not initialized"
    )
  }

  const canvas = await db.query.canvases.findFirst({
    where: eq(canvases.id, canvasId),
    columns: { id: true },
  })
  if (!canvas) {
    throw new CanvasCommandError("CANVAS_NOT_FOUND", 404, "Canvas not found")
  }

  const connection = await hocuspocus.openDirectConnection(canvasId, { actor })
  let result: { value: T } | undefined

  try {
    await connection.transact((document) => {
      result = { value: fn(document) }
    })
  } finally {
    await connection.disconnect()
  }

  if (!result) {
    throw new CanvasCommandError("COMMAND_FAILED", 500, "Canvas transaction did not run")
  }

  return result.value
}

export async function executeCanvasCommand(
  canvasId: string,
  request: CanvasCommandRequest
): Promise<CanvasCommandReceipt> {
  const owner = await remoteOwner(canvasId)
  if (owner) {
    const receipt = await callOwner(`${owner}/api/commands/${encodeURIComponent(canvasId)}`, {
      method: "POST",
      body: JSON.stringify(request),
    })
    return canvasCommandReceiptSchema.parse(receipt)
  }

  return transactCanvas(
    canvasId,
    { type: "server-command", commandId: request.commandId },
    (document) => executeCanvasCommandInDocument(document, canvasId, request)
  )
}

/**
 * Read the live Y.Doc state, which can be ahead of the debounced JSON read model.
 */
export async function readCanvasDocument(canvasId: string): Promise<CanvasDocument> {
  const owner = await remoteOwner(canvasId)
  if (owner) {
    // Same backend version on both ends; the owner shaped this from its own Y.Doc
    return (await callOwner(
      `${owner}/api/canvases/${encodeURIComponent(canvasId)}/document`
    )) as CanvasDocument
  }

  return transactCanvas(canvasId, { type: "server-read" }, (document) => ({
    nodes: Array.from(document.getMap<CanvasNode>("nodes").values()),
    edges: Array.from(document.getMap<CanvasEdge>("edges").values()),
  }))
}
