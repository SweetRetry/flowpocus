import { createCanvasId } from "@workspace/commands"
import { type CanvasEdge, type CanvasNode, canvases, db } from "@workspace/database"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"
import { CanvasCommandError, readCanvasDocument } from "../commands"
import { createLogger } from "../lib/logger"

const logger = createLogger("canvases")

// Request/Response schemas
const createCanvasSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
})

const updateCanvasSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
})

export const canvasRoutes = new Hono()
  /**
   * List all canvases (with pagination)
   */
  .get("/", async (c) => {
    const limit = Math.min(Number(c.req.query("limit")) || 20, 100)
    const offset = Number(c.req.query("offset")) || 0

    const results = await db.query.canvases.findMany({
      limit,
      offset,
      orderBy: (canvases, { desc }) => [desc(canvases.updatedAt)],
      columns: {
        id: true,
        name: true,
        description: true,
        version: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return c.json({
      data: results.map((canvas) => ({
        ...canvas,
        createdAt: canvas.createdAt.toISOString(),
        updatedAt: canvas.updatedAt.toISOString(),
      })),
      pagination: { limit, offset },
    })
  })

  /**
   * Get canvas by ID (returns JSON read model)
   * For real-time collaboration, connect via WebSocket instead
   */
  // Live Y.Doc state from the owner instance; GET /:id returns the debounced read model
  .get("/:id/document", async (c) => {
    try {
      return c.json(await readCanvasDocument(c.req.param("id")))
    } catch (error) {
      if (error instanceof CanvasCommandError) {
        return c.json({ error: { code: error.code, message: error.message } }, error.status)
      }
      throw error
    }
  })

  .get("/:id", async (c) => {
    const canvasId = c.req.param("id")

    const canvas = await db.query.canvases.findFirst({
      where: eq(canvases.id, canvasId),
    })

    if (!canvas) {
      return c.json({ error: "Canvas not found" }, 404)
    }

    return c.json({
      ...canvas,
      createdAt: canvas.createdAt.toISOString(),
      updatedAt: canvas.updatedAt.toISOString(),
    })
  })

  /**
   * Create new canvas
   */
  .post("/", async (c) => {
    const body = await c.req.json()
    const parsed = createCanvasSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400)
    }

    const id = createCanvasId()
    const now = new Date()

    const newCanvas = {
      id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      nodes: [] as CanvasNode[],
      edges: [] as CanvasEdge[],
      yjsUpdate: null,
      version: 0,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(canvases).values(newCanvas)

    logger.info({ canvasId: id }, "Canvas created")

    return c.json(
      {
        ...newCanvas,
        createdAt: newCanvas.createdAt.toISOString(),
        updatedAt: newCanvas.updatedAt.toISOString(),
      },
      201
    )
  })

  /**
   * Update canvas metadata (not content - use WebSocket for that)
   */
  .patch("/:id", async (c) => {
    const canvasId = c.req.param("id")
    const body = await c.req.json()
    const parsed = updateCanvasSchema.safeParse(body)

    if (!parsed.success) {
      return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400)
    }

    const existing = await db.query.canvases.findFirst({
      where: eq(canvases.id, canvasId),
      columns: { id: true },
    })

    if (!existing) {
      return c.json({ error: "Canvas not found" }, 404)
    }

    await db
      .update(canvases)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(canvases.id, canvasId))

    logger.info({ canvasId }, "Canvas metadata updated")

    const updated = await db.query.canvases.findFirst({
      where: eq(canvases.id, canvasId),
    })

    if (!updated) {
      return c.json({ error: "Canvas not found after update" }, 404)
    }

    return c.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  })

  /**
   * Delete canvas
   */
  .delete("/:id", async (c) => {
    const canvasId = c.req.param("id")

    const existing = await db.query.canvases.findFirst({
      where: eq(canvases.id, canvasId),
      columns: { id: true },
    })

    if (!existing) {
      return c.json({ error: "Canvas not found" }, 404)
    }

    await db.delete(canvases).where(eq(canvases.id, canvasId))

    logger.info({ canvasId }, "Canvas deleted")

    return c.json({ success: true })
  })
