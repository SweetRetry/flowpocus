import crypto from "node:crypto"
import { Database } from "@hocuspocus/extension-database"
import { Redis as HocuspocusRedisExtension } from "@hocuspocus/extension-redis"
import type { Extension } from "@hocuspocus/server"
import { Hocuspocus } from "@hocuspocus/server"
import { canvases, db } from "@workspace/database"
import { eq } from "drizzle-orm"
import * as Y from "yjs"
import { createLogger } from "../lib/logger"
import { getRedisClient } from "../lib/redis"

const logger = createLogger("hocuspocus")

/**
 * Error codes for collaboration authentication
 * Production-ready error taxonomy for client handling
 */
const ErrorCodes = {
  AUTH_REQUIRED: "COLLAB_001",
  INVALID_TOKEN: "COLLAB_002",
  CANVAS_NOT_FOUND: "COLLAB_003",
  ACCESS_DENIED: "COLLAB_004",
} as const

interface AuthContext {
  user: {
    id: string
    email?: string
    name?: string
  }
}

const instanceId = process.env.INSTANCE_ID ?? crypto.randomUUID()

let hocuspocus: Hocuspocus | null = null

/**
 * Create Hocuspocus server instance with all extensions
 */
function createHocuspocusInstance(): Hocuspocus {
  const extensions: Extension[] = []
  const redis = getRedisClient()

  // Redis extension for multi-node synchronization
  if (redis) {
    extensions.push(
      new HocuspocusRedisExtension({
        redis: redis.duplicate(),
        identifier: instanceId,
      })
    )
    logger.info("Redis extension enabled for multi-node sync")
  } else {
    logger.warn("Running in single-node mode (no Redis)")
  }

  // Database extension for persistence with dual-write strategy
  extensions.push(
    new Database({
      /**
       * Fetch CRDT state from database
       * Returns binary Yjs update for document initialization
       */
      fetch: async ({ documentName }) => {
        const canvasId = documentName
        logger.debug({ canvasId }, "Fetching canvas state")

        try {
          const canvas = await db.query.canvases.findFirst({
            where: eq(canvases.id, canvasId),
            columns: { yjsUpdate: true },
          })

          if (!canvas?.yjsUpdate) {
            logger.debug({ canvasId }, "No existing state found, starting fresh")
            return null
          }

          // Decode Base64 to binary
          return Buffer.from(canvas.yjsUpdate, "base64")
        } catch (error) {
          logger.error({ error, canvasId }, "Failed to fetch canvas")
          throw error
        }
      },

      /**
       * Store CRDT state with dual-write (JSON + Binary)
       * Implements CQRS-lite pattern for read/write separation
       */
      store: async ({ documentName, state }) => {
        const canvasId = documentName
        logger.debug({ canvasId, stateSize: state.length }, "Storing canvas state")

        try {
          // Create a copy to avoid modification during processing
          const stateCopy = new Uint8Array(state)

          // Decode Yjs state to extract nodes/edges for read model
          const ydoc = new Y.Doc()
          Y.applyUpdate(ydoc, stateCopy)

          const nodesMap = ydoc.getMap("nodes")
          const edgesMap = ydoc.getMap("edges")

          // Convert YMap to array for JSON storage
          const nodes = Array.from(nodesMap.values())
          const edges = Array.from(edgesMap.values())

          // Get current version for optimistic locking
          const existing = await db.query.canvases.findFirst({
            where: eq(canvases.id, canvasId),
            columns: { version: true },
          })

          // Atomic dual-write: JSON (read model) + Binary (write model)
          await db
            .update(canvases)
            .set({
              nodes: nodes as typeof canvases.$inferSelect.nodes,
              edges: edges as typeof canvases.$inferSelect.edges,
              yjsUpdate: Buffer.from(stateCopy).toString("base64"),
              version: (existing?.version ?? 0) + 1,
              updatedAt: new Date(),
            })
            .where(eq(canvases.id, canvasId))

          logger.debug(
            { canvasId, nodeCount: nodes.length, edgeCount: edges.length },
            "Canvas state persisted"
          )
        } catch (error) {
          logger.error({ error, canvasId }, "Failed to store canvas")
          throw error
        }
      },
    })
  )

  return new Hocuspocus({
    name: "flowpocus-collaboration",
    quiet: true,

    // Connection settings
    timeout: 30000, // 30s connection timeout

    // Debounce settings for write-behind persistence
    debounce: 3000, // Wait 3s of inactivity before persisting
    maxDebounce: 15000, // Force persist after 15s max

    /**
     * Authentication handler
     *
     * Production architecture with development mock support.
     *
     * Token formats:
     * - "mock.<base64-payload>.<signature>" - Development mock tokens
     * - "Bearer <jwt>" or "<jwt>" - Production JWT tokens
     *
     * To integrate with a real auth provider (Supabase, Auth0, Clerk):
     * 1. Add JWT signature verification using provider's public key/JWKS
     * 2. Implement proper authorization checks against canvas.ownerId
     * 3. Add role-based access control if needed
     */
    onAuthenticate: async ({ token, documentName }) => {
      logger.debug({ canvasId: documentName, hasToken: Boolean(token) }, "Authentication attempt")

      if (!token) {
        throw new Error(`${ErrorCodes.AUTH_REQUIRED}: Authentication required`)
      }

      try {
        let userId: string
        let userName: string | undefined
        let userEmail: string | undefined

        // Parse token based on format
        if (token.startsWith("mock.")) {
          // Development mock token format: "mock.<base64url-payload>.<signature>"
          // Only allowed in development mode
          if (process.env.NODE_ENV === "production") {
            throw new Error(`${ErrorCodes.INVALID_TOKEN}: Mock tokens not allowed in production`)
          }

          const parts = token.split(".")
          if (parts.length !== 3 || !parts[1]) {
            throw new Error(`${ErrorCodes.INVALID_TOKEN}: Invalid mock token format`)
          }

          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString())
          userId = payload.sub
          userName = payload.name
          userEmail = payload.email

          if (!userId) {
            throw new Error(`${ErrorCodes.INVALID_TOKEN}: Missing user ID in mock token`)
          }

          logger.debug({ userId, userName }, "Mock token authenticated")
        } else {
          // Production JWT token format
          // Extract from Bearer prefix if present
          const jwtToken = token.replace(/^Bearer\s+/i, "")
          const parts = jwtToken.split(".")

          if (parts.length !== 3 || !parts[1]) {
            throw new Error(`${ErrorCodes.INVALID_TOKEN}: Invalid JWT format`)
          }

          // TODO: Implement JWT signature verification
          // Example with jose library:
          // const { payload } = await jwtVerify(jwtToken, publicKey, { issuer: 'your-issuer' })

          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString())
          userId = payload.sub
          userName = payload.name
          userEmail = payload.email

          if (!userId) {
            throw new Error(`${ErrorCodes.INVALID_TOKEN}: Missing user ID in token`)
          }
        }

        // Verify canvas exists (or create if not)
        const canvas = await db.query.canvases.findFirst({
          where: eq(canvases.id, documentName),
          columns: { id: true, isPublic: true },
        })

        if (!canvas) {
          // Auto-create canvas for open source demo
          await db.insert(canvases).values({
            id: documentName,
            name: "Untitled",
            nodes: [],
            edges: [],
            yjsUpdate: null,
            version: 0,
            isPublic: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          logger.info({ canvasId: documentName }, "Auto-created canvas")
        }

        const ctx: AuthContext = {
          user: {
            id: userId,
            name: userName,
            email: userEmail,
          },
        }

        logger.info({ userId: ctx.user.id, canvasId: documentName }, "Authentication successful")
        return ctx
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!message.startsWith("COLLAB_")) {
          logger.error({ documentName, error: message }, "Authentication failed")
        }
        throw error
      }
    },

    /**
     * Connection established handler
     * Useful for logging and metrics
     */
    onConnect: async ({ documentName, socketId, context }) => {
      const auth = context as AuthContext | undefined
      logger.info({ socketId, canvasId: documentName, userId: auth?.user?.id }, "Client connected")
    },

    /**
     * Disconnection handler
     * Cleanup and logging
     */
    onDisconnect: async ({ documentName, socketId }) => {
      logger.debug({ socketId, canvasId: documentName }, "Client disconnected")
    },

    /**
     * Document load handler
     * Called when a document is first loaded into memory
     */
    onLoadDocument: async ({ document, documentName }) => {
      logger.debug(
        { canvasId: documentName, clientsCount: document.getConnectionsCount() },
        "Document loaded into memory"
      )
    },

    /**
     * Document unload handler (memory cleanup)
     * Called when all clients disconnect and document is removed from memory
     */
    afterUnloadDocument: async ({ documentName }) => {
      logger.debug({ canvasId: documentName }, "Document unloaded from memory")
    },

    extensions,
  })
}

/**
 * Initialize and return Hocuspocus server instance
 */
export function initializeHocuspocus(): Hocuspocus {
  if (hocuspocus) {
    logger.warn("Hocuspocus already initialized, returning existing instance")
    return hocuspocus
  }

  hocuspocus = createHocuspocusInstance()
  logger.info({ instanceId }, "Hocuspocus server initialized")
  return hocuspocus
}

/**
 * Get current Hocuspocus instance
 */
export function getHocuspocus(): Hocuspocus | null {
  return hocuspocus
}

/**
 * Graceful shutdown
 */
export async function shutdownHocuspocus(): Promise<void> {
  if (!hocuspocus) return

  logger.info("Initiating Hocuspocus shutdown...")

  try {
    // Close all WebSocket connections gracefully
    hocuspocus.closeConnections()
    logger.info("All connections closed")
  } catch (error) {
    logger.error({ error }, "Error during Hocuspocus shutdown")
  } finally {
    hocuspocus = null
  }
}
