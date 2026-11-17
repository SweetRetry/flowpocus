import { cors } from "@elysiajs/cors"
import { openapi } from "@elysiajs/openapi"
import type { WebSocketLike } from "@hocuspocus/server"
import { db } from "@workspace/database"
import { Elysia } from "elysia"
import { z } from "zod"
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

/** Where a client socket's frames go once the canvas owner is known. */
interface Peer {
  send(data: Uint8Array): void
  close(code: number, reason: string): void
}

/**
 * One entry per open client socket. Locating the owner is async, so frames that
 * arrive before it resolves chain on the promise and keep their order.
 */
const peers = new WeakMap<WebSocketLike, Promise<Peer>>()

function forward(socket: WebSocketLike, use: (peer: Peer) => void) {
  // A failed relay already closed the client socket; drop whatever was queued behind it
  peers.get(socket)?.then(use, () => {})
}

async function openPeer(
  socket: WebSocketLike,
  request: Request,
  canvasId: string,
  token: string | undefined
): Promise<Peer> {
  const location = await getPlacement()?.route(canvasId)
  if (location?.kind === "remote") {
    return relayToOwner(
      socket,
      `${location.url}/collaboration/${encodeURIComponent(canvasId)}`,
      token
    )
  }

  const hocuspocusServer = getHocuspocus()
  if (!hocuspocusServer) {
    socket.close(1011, "Collaboration server not initialized")
    throw new Error("Collaboration server not initialized")
  }

  logger.debug({ canvasId }, "WebSocket connection opened")

  // Hocuspocus 4 accepts Bun's ServerWebSocket and leaves message/close forwarding to the integration
  const connection = hocuspocusServer.handleConnection(socket, request, {
    documentName: canvasId,
    token,
  })
  return {
    send: (data) => connection.handleMessage(data),
    close: (code, reason) => connection.handleClose({ code, reason }),
  }
}

/**
 * Pipe a client socket to the canvas owner's collaboration endpoint, so any
 * instance can accept a connection without loading a second copy of the Y.Doc.
 * Resolves once the upstream socket is open, so queued frames flush in order.
 */
function relayToOwner(
  socket: WebSocketLike,
  ownerUrl: string,
  token: string | undefined
): Promise<Peer> {
  const target = new URL(ownerUrl.replace(/^http/, "ws"))
  if (token) target.searchParams.set("token", token)

  logger.debug({ target: target.pathname }, "Relaying WebSocket to canvas owner")
  const upstream = new WebSocket(target)
  upstream.binaryType = "arraybuffer"

  return new Promise((resolve, reject) => {
    upstream.addEventListener("open", () =>
      resolve({
        send: (data) => upstream.send(data),
        close: () => upstream.close(),
      })
    )
    upstream.addEventListener("message", (event) => {
      socket.send(new Uint8Array(event.data as ArrayBuffer))
    })
    upstream.addEventListener("close", (event) => {
      // 1005/1006 are reserved for "no status" and may not be sent; report them as a server error
      const code = event.code === 1005 || event.code === 1006 ? 1011 : event.code
      socket.close(code, event.reason)
    })
    upstream.addEventListener("error", () => {
      logger.warn({ target: target.pathname }, "Canvas owner unreachable")
      socket.close(1011, "Canvas owner unreachable")
      reject(new Error("Canvas owner unreachable"))
    })
  })
}

const app = new Elysia()
  .use(cors())
  .use(
    openapi({
      path: "/docs",
      specPath: "/openapi.json",
      documentation: {
        info: {
          title: "Flowpocus API",
          version: "0.0.1",
          description: "Real-time collaborative canvas API",
        },
      },
      mapJsonSchema: { zod: z.toJSONSchema },
    })
  )
  .onAfterResponse(({ request, set }) => {
    logger.info({ method: request.method, path: new URL(request.url).pathname, status: set.status })
  })
  .use(healthRoutes)
  .use(canvasRoutes)
  .use(commandRoutes)
  .use(mcpRoutes)
  .ws("/collaboration/:canvasId", {
    detail: { summary: "WebSocket endpoint for real-time collaboration" },
    open(ws) {
      const { params, query, request } = ws.data
      const token = query.token ?? request.headers.get("Authorization") ?? undefined
      const peer = openPeer(ws.raw, request, params.canvasId, token)
      // Close with 1011 so the client reconnects; a socket the relay already closed ignores it
      peer.catch((error: unknown) => {
        logger.warn({ canvasId: params.canvasId, error: String(error) }, "Could not open canvas")
        ws.raw.close(1011, "Could not open canvas")
      })
      peers.set(ws.raw, peer)
    },
    message(ws, message) {
      if (!(message instanceof Uint8Array)) return
      forward(ws.raw, (peer) => peer.send(message))
    },
    close(ws, code, reason) {
      forward(ws.raw, (peer) => peer.close(code, reason))
      peers.delete(ws.raw)
    },
  })
  .get("/", () => ({ message: "Flowpocus API", version: "0.0.1" }))

// Export app type for API client type inference
export type AppType = typeof app

const PORT = Number(process.env.PORT) || 3001

app.listen(PORT, (server) => {
  logger.info(`Server running at http://localhost:${server.port}`)
  logger.info(`API docs available at http://localhost:${server.port}/docs`)
  logger.info(`MCP endpoint at http://localhost:${server.port}/mcp`)
  logger.info(`WebSocket collaboration at ws://localhost:${server.port}/collaboration/{canvasId}`)

  // Trigger Hocuspocus onListen hook
  hocuspocus.hooks("onListen", {
    instance: hocuspocus,
    configuration: hocuspocus.configuration,
    port: server.port ?? PORT,
  })
})

// Graceful shutdown
async function shutdown() {
  logger.info("Shutting down...")

  await shutdownHocuspocus()
  await db.$client.end()

  await app.stop()
  logger.info("Shutdown complete")
  process.exit(0)
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
