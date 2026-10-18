import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { Hono } from "hono"
import { createMcpServer } from "../mcp/server"

/**
 * Streamable HTTP MCP endpoint in stateless mode: no session, no server-initiated stream.
 */
export const mcpRoutes = new Hono().all("/", async (c) => {
  const server = createMcpServer()
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })

  await server.connect(transport)
  return transport.handleRequest(c.req.raw)
})
