import type { Extension } from "@hocuspocus/server"
import type { SQL } from "drizzle-orm"

/**
 * How backend instances share canvases. See docs/adr/0001-single-owner-placement.md.
 *
 * - `owner`: each canvas loads on one instance, held by a database lease;
 *   other instances forward to it. The default, and correct on a single node.
 * - `redis`: each canvas loads wherever a client lands; copies sync over Redis.
 *
 * A platform with built-in single placement (Durable Objects and similar)
 * would be another `CanvasPlacement`.
 */
export const clusterModes = ["owner", "redis"] as const
export type ClusterMode = (typeof clusterModes)[number]

export interface Cluster {
  placement: CanvasPlacement
  /** Mode-specific Hocuspocus extensions, run after the ownership check and before persistence */
  extensions: Extension[]
}

/** Where a canvas's live Y.Doc runs, as seen from this instance. */
export type CanvasLocation = { kind: "local" } | { kind: "remote"; url: string }

export interface CanvasPlacement {
  /** Read-only lookup. Never claims ownership. */
  locate(canvasId: string): Promise<CanvasLocation>
  /** Claim ownership before loading. False when another live owner holds the canvas. */
  acquire(canvasId: string): Promise<boolean>
  /**
   * Extra WHERE condition for the persistence UPDATE, so a write from an
   * instance that lost the canvas matches no row. Check and write are one
   * statement; a separate check would leave a gap a stalled owner can fall
   * into. Undefined when the mode needs no fence.
   */
  fence(canvasId: string): SQL | undefined
  release(canvasId: string): Promise<void>
  /** Stop renewing and release everything this instance owns. */
  close(): Promise<void>
}
