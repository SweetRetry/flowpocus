import type { DirectConnection, Document } from "@hocuspocus/server"
import {
  type CanvasCommandReceipt,
  type CanvasCommandRequest,
  canvasCommandReceiptSchema,
} from "@workspace/commands"
import { type CanvasEdge, type CanvasNode, canvases, db } from "@workspace/database"
import { eq } from "drizzle-orm"
import type * as Y from "yjs"
import { getHocuspocus, getPlacement } from "../collaboration"
import {
  CanvasCommandError,
  executeCanvasCommandInDocument,
  planCommandFocus,
} from "./canvas-command"
import { openAgentPresence } from "./presence"

const DEFAULT_AGENT = { name: "Agent" }

interface CanvasDocument {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

/** Where the canvas owner runs, or null when this instance should serve it. */
async function remoteOwner(canvasId: string): Promise<string | null> {
  const location = await getPlacement()?.route(canvasId)
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

async function withCanvas<T>(
  canvasId: string,
  actor: Record<string, unknown>,
  fn: (connection: DirectConnection, document: Document) => Promise<T>
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
  try {
    // The connection keeps its document loaded, so it is in the registry
    return await fn(connection, hocuspocus.documents.get(canvasId) as Document)
  } finally {
    await connection.disconnect()
  }
}

async function transactIn<T>(connection: DirectConnection, fn: (document: Y.Doc) => T): Promise<T> {
  let result: { value: T } | undefined

  await connection.transact((document) => {
    result = { value: fn(document) }
  })

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

  return withCanvas(
    canvasId,
    { type: "server-command", commandId: request.commandId },
    async (connection, document) => {
      const presence = openAgentPresence(document, canvasId, request.agent ?? DEFAULT_AGENT)
      const focus = presence && planCommandFocus(document, request)
      if (focus) await presence.approach(focus.position, focus.activity)

      let receipt: CanvasCommandReceipt | undefined
      try {
        receipt = await transactIn(connection, (live) =>
          executeCanvasCommandInDocument(live, canvasId, request)
        )
        return receipt
      } finally {
        const nodeId = receipt?.result.nodeId
        presence?.settle(typeof nodeId === "string" ? [nodeId] : [])
      }
    }
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

  return withCanvas(canvasId, { type: "server-read" }, (connection) =>
    transactIn(connection, (document) => ({
      nodes: Array.from(document.getMap<CanvasNode>("nodes").values()),
      edges: Array.from(document.getMap<CanvasEdge>("edges").values()),
    }))
  )
}
