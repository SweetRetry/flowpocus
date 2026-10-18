import crypto from "node:crypto"
import { Database } from "@hocuspocus/extension-database"
import type { Extension } from "@hocuspocus/server"
import { Hocuspocus } from "@hocuspocus/server"
import { canvases, db } from "@workspace/database"
import { and, eq, sql } from "drizzle-orm"
import * as Y from "yjs"
import { createLogger } from "../lib/logger"
import { type CanvasPlacement, createCluster } from "../placement"

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
const instanceUrl =
  process.env.INSTANCE_URL ?? `http://localhost:${Number(process.env.PORT) || 3001}`

let hocuspocus: Hocuspocus | null = null
let placement: CanvasPlacement | null = null

/**
 * Keeps this instance the single owner of every document it loads.
 * Listed before Database so a load claims the lease before fetching state.
 * Stores are fenced inside the persistence UPDATE itself.
 */
function ownershipExtension(placement: CanvasPlacement): Extension {
  return {
    async onLoadDocument({ documentName }) {
      if (!(await placement.acquire(documentName))) {
        throw new Error(`Canvas ${documentName} is owned by another instance`)
      }
    },
    async afterUnloadDocument({ documentName }) {
      await placement.release(documentName)
    },
  }
}

/**
 * Create Hocuspocus server instance with all extensions
 */
function createHocuspocusInstance(
  placement: CanvasPlacement,
  clusterExtensions: Extension[]
): Hocuspocus {
  const extensions: Extension[] = [ownershipExtension(placement), ...clusterExtensions]

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

          return canvas.yjsUpdate
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

          // Atomic dual-write: JSON (read model) + Binary (write model)
          const stored = await db
            .update(canvases)
            .set({
              nodes: nodes as typeof canvases.$inferSelect.nodes,
              edges: edges as typeof canvases.$inferSelect.edges,
              yjsUpdate: Buffer.from(stateCopy),
              // Monotonic revision counter, not a lock: state is the full merged doc
              version: sql`${canvases.version} + 1`,
              updatedAt: new Date(),
            })
            .where(and(eq(canvases.id, canvasId), placement.fence(canvasId)))
            .returning({ id: canvases.id })

          if (stored.length === 0) {
            // Lease lost to another instance (or canvas deleted). The new owner loaded from the
            // database; clients still connected here carry these edits over when they reconnect.
            logger.warn(
              { canvasId, instanceId },
              "Store skipped: this instance no longer owns the canvas"
            )
            return
          }

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

  const mode = process.env.CLUSTER_MODE ?? "owner"
  const cluster = createCluster({
    mode,
    redisUrl: process.env.REDIS_URL,
    db,
    instanceId,
    instanceUrl,
    onLost: (canvasId) => hocuspocus?.closeConnections(canvasId),
  })
  placement = cluster.placement
  hocuspocus = createHocuspocusInstance(placement, cluster.extensions)
  logger.info({ mode, instanceId, instanceUrl }, "Hocuspocus server initialized")
  return hocuspocus
}

/**
 * Get current Hocuspocus instance
 */
export function getHocuspocus(): Hocuspocus | null {
  return hocuspocus
}

export function getPlacement(): CanvasPlacement | null {
  return placement
}

/**
 * Graceful shutdown
 */
export async function shutdownHocuspocus(): Promise<void> {
  if (!hocuspocus) return

  logger.info("Initiating Hocuspocus shutdown...")

  try {
    // Closing the last connection stores and unloads each document; wait for that
    // before releasing leases, or the stores would find the lease gone and skip
    hocuspocus.closeConnections()
    hocuspocus.flushPendingStores()
    const deadline = Date.now() + 5000
    while (hocuspocus.getDocumentsCount() > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    logger.info({ remaining: hocuspocus.getDocumentsCount() }, "All connections closed")
    await placement?.close()
  } catch (error) {
    logger.error({ error }, "Error during Hocuspocus shutdown")
  } finally {
    hocuspocus = null
    placement = null
  }
}
