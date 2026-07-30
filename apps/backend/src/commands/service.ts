import type { CanvasCommandReceipt, CanvasCommandRequest } from "@workspace/commands"
import { getHocuspocus } from "../collaboration"
import { CanvasCommandError, executeCanvasCommandInDocument } from "./canvas-command"

export async function executeCanvasCommand(
  canvasId: string,
  request: CanvasCommandRequest
): Promise<CanvasCommandReceipt> {
  const hocuspocus = getHocuspocus()
  if (!hocuspocus) {
    throw new CanvasCommandError(
      "COLLABORATION_UNAVAILABLE",
      503,
      "Collaboration server is not initialized"
    )
  }

  const connection = await hocuspocus.openDirectConnection(canvasId, {
    actor: { type: "server-command", commandId: request.commandId },
  })
  let receipt: CanvasCommandReceipt | undefined

  try {
    await connection.transact((document) => {
      receipt = executeCanvasCommandInDocument(document, canvasId, request)
    })
  } finally {
    await connection.disconnect()
  }

  if (!receipt) {
    throw new CanvasCommandError("COMMAND_FAILED", 500, "Command completed without a receipt")
  }

  return receipt
}
