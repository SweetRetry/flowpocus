import type { Hocuspocus } from "@hocuspocus/server"
import type { HttpBindings } from "@hono/node-server"
import { serve, upgradeWebSocket } from "@hono/node-server"
import { swaggerUI } from "@hono/swagger-ui"
import { db } from "@workspace/database"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger as honoLogger } from "hono/logger"
import type { WSEvents } from "hono/ws"
import { WebSocket, WebSocketServer } from "ws"
import {
  getHocuspocus,
  getPlacement,
  initializeHocuspocus,
  shutdownHocuspocus,
} from "./collaboration"
import { createLogger } from "./lib/logger"
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
        "/api/canvases/{id}/document": {
          get: { summary: "Read the live canvas document from its owner instance" },
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
    upgradeWebSocket(async (c) => {
      // upgradeWebSocket types the context without the route's params; the pattern guarantees it
      const canvasId = c.req.param("canvasId") as string
      const token = c.req.query("token") ?? c.req.header("Authorization")

      const location = await getPlacement()?.locate(canvasId)
      if (location?.kind === "remote") {
        return relayToOwner(`${location.url}/collaboration/${encodeURIComponent(canvasId)}`, token)
      }

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

/**
 * Pipe a client socket to the canvas owner's collaboration endpoint, so any
 * instance can accept a connection without loading a second copy of the Y.Doc.
 */
function relayToOwner(ownerUrl: string, token: string | undefined): WSEvents {
  const target = new URL(ownerUrl.replace(/^http/, "ws"))
  if (token) target.searchParams.set("token", token)

  let upstream: WebSocket | undefined
  const pending: ArrayBuffer[] = []

  return {
    onOpen(_event, ws) {
      logger.debug({ target: target.pathname }, "Relaying WebSocket to canvas owner")
      upstream = new WebSocket(target)
      upstream.on("open", () => {
        for (const message of pending.splice(0)) upstream?.send(message)
      })
      upstream.on("message", (data: Buffer) => ws.send(new Uint8Array(data)))
      // 1005/1006 are reserved for "no status" and may not be sent; report them as a server error
      upstream.on("close", (code, reason) =>
        ws.close(code === 1005 || code === 1006 ? 1011 : code, reason.toString())
      )
      upstream.on("error", (error) => {
        logger.warn({ error: error.message, target: target.pathname }, "Canvas owner unreachable")
        ws.close(1011, "Canvas owner unreachable")
      })
    },
    onMessage(event) {
      if (!(event.data instanceof ArrayBuffer)) return
      if (upstream?.readyState === WebSocket.OPEN) upstream.send(event.data)
      else pending.push(event.data)
    },
    onClose() {
      upstream?.close()
    },
  }
}

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
  await db.$client.end()

  server.close()
  logger.info("Shutdown complete")
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
