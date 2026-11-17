import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { Elysia } from "elysia"
import { createMcpServer } from "../mcp/server"

/**
 * Streamable HTTP MCP endpoint in stateless mode: no session, no server-initiated stream.
 * `parse: "none"` leaves the body unread so the transport can consume the raw Request.
 */
export const mcpRoutes = new Elysia({ prefix: "/mcp" }).all(
  "",
  async ({ request }) => {
    const server = createMcpServer()
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    await server.connect(transport)
    return transport.handleRequest(request)
  },
  { parse: "none" }
)
