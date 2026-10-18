import type { Hocuspocus } from "@hocuspocus/server"
import type { HttpBindings } from "@hono/node-server"
import { serve, upgradeWebSocket } from "@hono/node-server"
import { swaggerUI } from "@hono/swagger-ui"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger as honoLogger } from "hono/logger"
import { WebSocketServer } from "ws"
import { getHocuspocus, initializeHocuspocus, shutdownHocuspocus } from "./collaboration"
import { createLogger } from "./lib/logger"
import { shutdownRedis } from "./lib/redis"
import { canvasRoutes, commandRoutes, healthRoutes, mcpRoutes } from "./routes"

const logger = createLogger("server")

// Initialize Hocuspocus collaboration server
const hocuspocus = initializeHocuspocus()

// Create Hono app with Node.js bindings for WebSocket access
const app = new Hono<{ Bindings: HttpBindings }>()

// Apply middleware
app
  .use("*", cors())
  .use("*", honoLogger())

  // API routes
  .route("/health", healthRoutes)
  .route("/api/canvases", canvasRoutes)
  .route("/api/commands", commandRoutes)
  .route("/mcp", mcpRoutes)

  // OpenAPI documentation UI
  .get("/docs", swaggerUI({ url: "/openapi.json" }))
  .get("/openapi.json", (c) =>
    c.json({
      openapi: "3.0.0",
      info: {
        title: "Flowpocus API",
        version: "0.0.1",
        description: "Real-time collaborative canvas API",
      },
      paths: {
        "/health": {
          get: {
            summary: "Health check",
            responses: {
              200: { description: "Server is healthy" },
            },
          },
        },
        "/api/canvases": {
          get: { summary: "List canvases" },
          post: { summary: "Create canvas" },
        },
        "/api/canvases/{id}": {
          get: { summary: "Get canvas by ID" },
          patch: { summary: "Update canvas metadata" },
          delete: { summary: "Delete canvas" },
        },
        "/api/commands": {
          get: { summary: "List server-owned canvas commands" },
        },
        "/api/commands/{canvasId}": {
          post: { summary: "Execute a canvas command through a direct connection" },
        },
        "/mcp": {
          post: { summary: "MCP Streamable HTTP endpoint (stateless, JSON responses)" },
        },
        "/collaboration/{canvasId}": {
          get: { summary: "WebSocket endpoint for real-time collaboration" },
        },
      },
    })
  )

  // WebSocket collaboration endpoint
  .get(
    "/collaboration/:canvasId",
    upgradeWebSocket((c) => {
      const canvasId = c.req.param("canvasId")
      const token = c.req.query("token") ?? c.req.header("Authorization")

      let connection: ReturnType<Hocuspocus["handleConnection"]> | undefined

      return {
        onOpen(_event, ws) {
          const hocuspocusServer = getHocuspocus()
          if (!hocuspocusServer || !ws.raw) {
            ws.close(1011, "Collaboration server not initialized")
            return
          }

          logger.debug({ canvasId }, "WebSocket connection opened")

          // Hocuspocus 4 takes a web Request and leaves message/close forwarding to the integration
          connection = hocuspocusServer.handleConnection(ws.raw, c.req.raw, {
            documentName: canvasId,
            token,
          })
        },
        onMessage(event) {
          if (event.data instanceof ArrayBuffer) {
            connection?.handleMessage(new Uint8Array(event.data))
          }
        },
        onClose(event) {
          connection?.handleClose({ code: event.code, reason: event.reason })
        },
      }
    })
  )

  // Root endpoint
  .get("/", (c) => c.json({ message: "Flowpocus API", version: "0.0.1" }))

// Export app type for API client type inference
export type AppType = typeof app

// Start server
const PORT = Number(process.env.PORT) || 3001

const wss = new WebSocketServer({ noServer: true })

const server = serve({ fetch: app.fetch, port: PORT, websocket: { server: wss } }, (info) => {
  logger.info(`Server running at http://localhost:${info.port}`)
  logger.info(`API docs available at http://localhost:${info.port}/docs`)
  logger.info(`MCP endpoint at http://localhost:${info.port}/mcp`)
  logger.info(`WebSocket collaboration at ws://localhost:${info.port}/collaboration/{canvasId}`)

  // Trigger Hocuspocus onListen hook
  hocuspocus.hooks("onListen", {
    instance: hocuspocus,
    configuration: hocuspocus.configuration,
    port: info.port,
  })
})

// Graceful shutdown
async function shutdown() {
  logger.info("Shutting down...")

  await shutdownHocuspocus()
  await shutdownRedis()

  server.close()
  logger.info("Shutdown complete")
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
