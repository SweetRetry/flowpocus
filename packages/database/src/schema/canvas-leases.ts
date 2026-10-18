import { pgTable, text, timestamp } from "drizzle-orm/pg-core"

/**
 * Canvas ownership leases
 *
 * One row per canvas whose live Y.Doc is loaded on some backend instance.
 * The owner renews `expiresAt` while the document stays loaded; an expired
 * row can be taken over by any instance. See docs/adr/0001-single-owner-placement.md.
 */
export const canvasLeases = pgTable("canvas_leases", {
  canvasId: text("canvas_id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  // Internal base URL other instances use to forward traffic to the owner
  ownerUrl: text("owner_url").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
})
