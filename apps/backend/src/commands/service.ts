import type { CanvasCommandReceipt, CanvasCommandRequest } from "@workspace/commands"
import { type CanvasEdge, type CanvasNode, canvases, db } from "@workspace/database"
import { eq } from "drizzle-orm"
import type * as Y from "yjs"
import { getHocuspocus } from "../collaboration"
import { CanvasCommandError, executeCanvasCommandInDocument } from "./canvas-command"

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

export function executeCanvasCommand(
  canvasId: string,
  request: CanvasCommandRequest
): Promise<CanvasCommandReceipt> {
  return transactCanvas(
    canvasId,
    { type: "server-command", commandId: request.commandId },
    (document) => executeCanvasCommandInDocument(document, canvasId, request)
  )
}

/**
 * Read the live Y.Doc state, which can be ahead of the debounced JSON read model.
 */
export function readCanvasDocument(
  canvasId: string
): Promise<{ nodes: CanvasNode[]; edges: CanvasEdge[] }> {
  return transactCanvas(canvasId, { type: "server-read" }, (document) => ({
    nodes: Array.from(document.getMap<CanvasNode>("nodes").values()),
    edges: Array.from(document.getMap<CanvasEdge>("edges").values()),
  }))
}
