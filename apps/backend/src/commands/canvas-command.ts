import { createHash } from "node:crypto"
import {
  type CanvasCommandReceipt,
  type CanvasCommandRequest,
  type CreateNodeInput,
  getCanvasCommandDefinition,
} from "@workspace/commands"
import type { CanvasNode } from "@workspace/database"
import type * as Y from "yjs"

interface StoredCanvasCommandReceipt extends Omit<CanvasCommandReceipt, "replayed"> {
  requestHash: string
}

export class CanvasCommandError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 404 | 409 | 500 | 503,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = "CanvasCommandError"
  }
}

function createNode(
  input: CreateNodeInput,
  commandId: string,
  nodes: Y.Map<CanvasNode>
): Record<string, unknown> {
  const nodeId = input.id ?? `node-${commandId}`

  if (nodes.has(nodeId)) {
    throw new CanvasCommandError(
      "NODE_ID_CONFLICT",
      409,
      `Node ${nodeId} already exists on this canvas`
    )
  }

  const baseNode = {
    id: nodeId,
    type: input.type,
    position: input.position,
  }
  let node: CanvasNode

  switch (input.type) {
    case "text":
      node = {
        ...baseNode,
        width: input.width ?? 240,
        height: input.height ?? 160,
        data: {
          label: input.label ?? "Text",
          content: input.content ?? "",
        },
      }
      break
    case "image":
      node = {
        ...baseNode,
        width: input.width ?? 200,
        height: input.height ?? 150,
        data: {
          label: input.label ?? "Image",
          imageUrl: input.imageUrl ?? `https://picsum.photos/seed/${nodeId}/400/300`,
        },
      }
      break
    case "video":
      node = {
        ...baseNode,
        width: input.width ?? 320,
        height: input.height ?? 180,
        data: {
          label: input.label ?? "Video",
          videoUrl: input.videoUrl ?? "https://www.w3schools.com/html/mov_bbb.mp4",
        },
      }
      break
  }

  nodes.set(nodeId, node)
  return { nodeId, node }
}

export function executeCanvasCommandInDocument(
  document: Y.Doc,
  canvasId: string,
  request: CanvasCommandRequest
): CanvasCommandReceipt {
  const definition = getCanvasCommandDefinition(request.name)

  if (!definition) {
    throw new CanvasCommandError("COMMAND_NOT_FOUND", 404, `Unknown command: ${request.name}`)
  }

  const parsedInput = definition.inputSchema.safeParse(request.input)
  if (!parsedInput.success) {
    throw new CanvasCommandError(
      "INVALID_COMMAND_INPUT",
      400,
      `Invalid input for command ${request.name}`,
      parsedInput.error.flatten()
    )
  }

  const requestHash = createHash("sha256")
    .update(JSON.stringify({ name: request.name, input: parsedInput.data }))
    .digest("hex")
  const commandLog = document.getMap<StoredCanvasCommandReceipt>("_serverCommands")
  const nodes = document.getMap<CanvasNode>("nodes")
  let receipt: CanvasCommandReceipt | undefined

  document.transact(() => {
    const existing = commandLog.get(request.commandId)
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new CanvasCommandError(
          "COMMAND_ID_CONFLICT",
          409,
          `Command ID ${request.commandId} was already used with a different request`
        )
      }

      const { requestHash: _requestHash, ...storedReceipt } = existing
      receipt = { ...storedReceipt, replayed: true }
      return
    }

    const result = createNode(parsedInput.data, request.commandId, nodes)
    const storedReceipt: StoredCanvasCommandReceipt = {
      commandId: request.commandId,
      canvasId,
      name: request.name,
      status: "completed",
      result,
      executedAt: new Date().toISOString(),
      requestHash,
    }
    commandLog.set(request.commandId, storedReceipt)
    const { requestHash: _requestHash, ...completedReceipt } = storedReceipt
    receipt = { ...completedReceipt, replayed: false }
  }, `server-command:${request.commandId}`)

  if (!receipt) {
    throw new CanvasCommandError("COMMAND_FAILED", 500, "Command completed without a receipt")
  }

  return receipt
}
