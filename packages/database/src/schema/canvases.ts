import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

/**
 * Canvas table with dual-write strategy (CQRS-Lite)
 *
 * Read Model (nodes/edges): JSON format for fast HTTP API queries
 * Write Model (yjsUpdate): Binary CRDT state as Source of Truth
 */
export const canvases = sqliteTable("canvases", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Untitled"),
  description: text("description"),

  // Read Model - JSON for fast queries and SQL analytics
  nodes: text("nodes", { mode: "json" }).$type<CanvasNode[]>().default([]),
  edges: text("edges", { mode: "json" }).$type<CanvasEdge[]>().default([]),

  // Write Model - CRDT binary state
  yjsUpdate: blob("yjs_update", { mode: "buffer" }),

  // Metadata
  version: integer("version").notNull().default(0),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
})

// React Flow compatible node type
export interface CanvasNode {
  id: string
  type?: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  width?: number
  height?: number
  selected?: boolean
  dragging?: boolean
  parentId?: string
}

// React Flow compatible edge type
export interface CanvasEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  type?: string
  animated?: boolean
  data?: Record<string, unknown>
  style?: Record<string, unknown>
  label?: string
}

export type Canvas = typeof canvases.$inferSelect
export type NewCanvas = typeof canvases.$inferInsert
