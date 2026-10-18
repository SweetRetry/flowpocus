import { boolean, customType, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

// Drizzle has no built-in bytea column; node-postgres reads and writes it as a Buffer
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" })

/**
 * Canvas table with dual-write strategy (CQRS-Lite)
 *
 * Read Model (nodes/edges): JSON format for fast HTTP API queries
 * Write Model (yjsUpdate): Binary CRDT state as Source of Truth
 */
export const canvases = pgTable("canvases", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Untitled"),
  description: text("description"),

  // Read Model - JSON for fast queries and SQL analytics
  nodes: jsonb("nodes").$type<CanvasNode[]>().default([]),
  edges: jsonb("edges").$type<CanvasEdge[]>().default([]),

  // Write Model - CRDT binary state
  yjsUpdate: bytea("yjs_update"),

  // Metadata
  version: integer("version").notNull().default(0),
  isPublic: boolean("is_public").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
