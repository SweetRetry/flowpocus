import { canvasLeases, type DatabaseClient } from "@workspace/database"
import { and, eq, exists, inArray, lt, or } from "drizzle-orm"
import { createLogger } from "../lib/logger"
import type { CanvasLocation, CanvasPlacement } from "./types"

const logger = createLogger("placement")

interface LeasePlacementOptions {
  db: DatabaseClient
  instanceId: string
  /** Base URL other instances use to reach this one, e.g. http://10.0.0.5:3001 */
  instanceUrl: string
  /** Called when a renewal finds another instance took over a canvas this one had loaded */
  onLost: (canvasId: string) => void
  ttlMs?: number
  now?: () => number
}

/**
 * Canvas placement backed by a lease row per canvas in the shared database.
 * The owner renews every ttl/3; an owner that stops renewing loses the canvas
 * after ttl and any instance may take it over.
 */
export function createLeasePlacement({
  db,
  instanceId,
  instanceUrl,
  onLost,
  ttlMs = 30_000,
  now = Date.now,
}: LeasePlacementOptions): CanvasPlacement & { renew(): Promise<void> } {
  const held = new Set<string>()

  async function renew() {
    if (held.size === 0) return
    const ids = [...held]
    const renewed = await db
      .update(canvasLeases)
      .set({ expiresAt: new Date(now() + ttlMs) })
      .where(and(eq(canvasLeases.ownerId, instanceId), inArray(canvasLeases.canvasId, ids)))
      .returning({ canvasId: canvasLeases.canvasId })
    const kept = new Set(renewed.map((row) => row.canvasId))

    for (const canvasId of ids) {
      if (kept.has(canvasId) || !held.delete(canvasId)) continue
      logger.warn({ canvasId, instanceId }, "Lost canvas lease to another instance")
      onLost(canvasId)
    }
  }

  const timer = setInterval(() => {
    renew().catch((error) => logger.error({ error }, "Lease renewal failed"))
  }, ttlMs / 3)
  timer.unref()

  return {
    async locate(canvasId): Promise<CanvasLocation> {
      const lease = await db.query.canvasLeases.findFirst({
        where: eq(canvasLeases.canvasId, canvasId),
      })
      if (!lease || lease.ownerId === instanceId || lease.expiresAt.getTime() <= now()) {
        return { kind: "local" }
      }
      return { kind: "remote", url: lease.ownerUrl }
    },

    async acquire(canvasId) {
      const claimed = await db
        .insert(canvasLeases)
        .values({
          canvasId,
          ownerId: instanceId,
          ownerUrl: instanceUrl,
          expiresAt: new Date(now() + ttlMs),
        })
        .onConflictDoUpdate({
          target: canvasLeases.canvasId,
          set: { ownerId: instanceId, ownerUrl: instanceUrl, expiresAt: new Date(now() + ttlMs) },
          setWhere: or(
            eq(canvasLeases.ownerId, instanceId),
            lt(canvasLeases.expiresAt, new Date(now()))
          ),
        })
        .returning({ canvasId: canvasLeases.canvasId })
      if (claimed.length === 0) return false
      held.add(canvasId)
      return true
    },

    fence(canvasId) {
      // An expired lease nobody took over is still ours: no one else can have loaded the canvas.
      // SQLite serialises writers, so this subquery and the UPDATE around it cannot interleave
      // with a takeover. On PostgreSQL READ COMMITTED it would need FOR SHARE on the lease row.
      return exists(
        db
          .select({ canvasId: canvasLeases.canvasId })
          .from(canvasLeases)
          .where(and(eq(canvasLeases.canvasId, canvasId), eq(canvasLeases.ownerId, instanceId)))
      )
    },

    async release(canvasId) {
      held.delete(canvasId)
      await db
        .delete(canvasLeases)
        .where(and(eq(canvasLeases.canvasId, canvasId), eq(canvasLeases.ownerId, instanceId)))
    },

    async close() {
      clearInterval(timer)
      held.clear()
      await db.delete(canvasLeases).where(eq(canvasLeases.ownerId, instanceId))
    },

    renew,
  }
}
