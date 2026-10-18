import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { canvasCommandDefinitions } from "@workspace/commands"
import { db } from "@workspace/database"
import { z } from "zod"
import { CanvasCommandError, executeCanvasCommand, readCanvasDocument } from "../commands"

function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] }
}

/**
 * Map domain errors to tool errors so the model can read and correct them.
 * Anything else is a server fault and propagates as a JSON-RPC error.
 */
async function run(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return json(await fn())
  } catch (error) {
    if (error instanceof CanvasCommandError) {
      return {
        ...json({ error: { code: error.code, message: error.message, details: error.details } }),
        isError: true,
      }
    }
    throw error
  }
}

/**
 * Build a fresh MCP server. The transport is stateless, so each HTTP request gets its own.
 * Command tools are generated from the shared contracts; execution goes through the same
 * server-owned path as the HTTP command route.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "flowpocus", version: "0.0.1" })

  server.registerTool(
    "list_canvases",
    {
      description: "List canvases, most recently updated first",
      inputSchema: { limit: z.number().int().min(1).max(100).default(20) },
      annotations: { readOnlyHint: true },
    },
    ({ limit }) =>
      run(() =>
        db.query.canvases.findMany({
          limit,
          orderBy: (canvases, { desc }) => [desc(canvases.updatedAt)],
          columns: { id: true, name: true, description: true, updatedAt: true },
        })
      )
  )

  server.registerTool(
    "get_canvas",
    {
      description: "Read the live nodes and edges of a canvas",
      inputSchema: { canvasId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    ({ canvasId }) => run(() => readCanvasDocument(canvasId))
  )

  for (const [name, definition] of Object.entries(canvasCommandDefinitions)) {
    server.registerTool(
      name,
      {
        description: `${definition.description}. Retrying with the same commandId and input is safe and returns the original receipt.`,
        inputSchema: {
          canvasId: z.string().min(1),
          commandId: z.string().min(1).max(128).describe("Stable idempotency key for this change"),
          input: definition.inputSchema,
        },
        annotations: { idempotentHint: true, destructiveHint: false },
      },
      ({ canvasId, commandId, input }) =>
        run(() => executeCanvasCommand(canvasId, { commandId, name, input }))
    )
  }

  return server
}
