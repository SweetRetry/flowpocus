import type { HttpBindings } from "@hono/node-server"
import { serve } from "@hono/node-server"
import { createNodeWebSocket } from "@hono/node-ws"
import { swaggerUI } from "@hono/swagger-ui"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger as honoLogger } from "hono/logger"
import { getHocuspocus, initializeHocuspocus, shutdownHocuspocus } from "./collaboration"
import { createLogger } from "./lib/logger"
import { shutdownRedis } from "./lib/redis"
import { canvasRoutes, commandRoutes, healthRoutes } from "./routes"

const logger = createLogger("server")

// Initialize Hocuspocus collaboration server
const hocuspocus = initializeHocuspocus()

// Create Hono app with Node.js bindings for WebSocket access
const app = new Hono<{ Bindings: HttpBindings }>()

// Create WebSocket upgrade helper
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

// Apply middleware
app
  .use("*", cors())
  .use("*", honoLogger())

  // API routes
  .route("/health", healthRoutes)
  .route("/api/canvases", canvasRoutes)
  .route("/api/commands", commandRoutes)

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

      return {
        onOpen(_event, ws) {
          const hocuspocusServer = getHocuspocus()
          if (!hocuspocusServer) {
            ws.close(1011, "Collaboration server not initialized")
            return
          }

          logger.debug({ canvasId }, "WebSocket connection opened")

          // Pass connection to Hocuspocus with context
          hocuspocusServer.handleConnection(ws.raw, c.env.incoming, {
            documentName: canvasId,
            token,
          })
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

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  logger.info(`Server running at http://localhost:${info.port}`)
  logger.info(`API docs available at http://localhost:${info.port}/docs`)
  logger.info(`WebSocket collaboration at ws://localhost:${info.port}/collaboration/{canvasId}`)

  // Trigger Hocuspocus onListen hook
  hocuspocus.hooks("onListen", {
    instance: hocuspocus,
    configuration: hocuspocus.configuration,
    port: info.port,
  })
})

// Inject WebSocket support
injectWebSocket(server)

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
