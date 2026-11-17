import { createCanvasId } from "@workspace/commands"
import { type CanvasEdge, type CanvasNode, canvases, db } from "@workspace/database"
import { eq } from "drizzle-orm"
import { Elysia } from "elysia"
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

export const canvasRoutes = new Elysia({ prefix: "/api/canvases" })
  /**
   * List all canvases (with pagination)
   */
  .get("", async ({ query }) => {
    const limit = Math.min(Number(query.limit) || 20, 100)
    const offset = Number(query.offset) || 0

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

    return {
      data: results.map((canvas) => ({
        ...canvas,
        createdAt: canvas.createdAt.toISOString(),
        updatedAt: canvas.updatedAt.toISOString(),
      })),
      pagination: { limit, offset },
    }
  })

  /**
   * Get canvas by ID (returns JSON read model)
   * For real-time collaboration, connect via WebSocket instead
   */
  // Live Y.Doc state from the owner instance; GET /:id returns the debounced read model
  .get("/:id/document", async ({ params, status }) => {
    try {
      return await readCanvasDocument(params.id)
    } catch (error) {
      if (error instanceof CanvasCommandError) {
        return status(error.status, { error: { code: error.code, message: error.message } })
      }
      throw error
    }
  })

  .get("/:id", async ({ params, status }) => {
    const canvasId = params.id

    const canvas = await db.query.canvases.findFirst({
      where: eq(canvases.id, canvasId),
    })

    if (!canvas) {
      return status(404, { error: "Canvas not found" })
    }

    return {
      ...canvas,
      createdAt: canvas.createdAt.toISOString(),
      updatedAt: canvas.updatedAt.toISOString(),
    }
  })

  /**
   * Create new canvas
   */
  .post("", async ({ body, status }) => {
    const parsed = createCanvasSchema.safeParse(body)

    if (!parsed.success) {
      return status(400, { error: "Invalid request", details: parsed.error.flatten() })
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

    return status(201, {
      ...newCanvas,
      createdAt: newCanvas.createdAt.toISOString(),
      updatedAt: newCanvas.updatedAt.toISOString(),
    })
  })

  /**
   * Update canvas metadata (not content - use WebSocket for that)
   */
  .patch("/:id", async ({ params, body, status }) => {
    const canvasId = params.id
    const parsed = updateCanvasSchema.safeParse(body)

    if (!parsed.success) {
      return status(400, { error: "Invalid request", details: parsed.error.flatten() })
    }

    const existing = await db.query.canvases.findFirst({
      where: eq(canvases.id, canvasId),
      columns: { id: true },
    })

    if (!existing) {
      return status(404, { error: "Canvas not found" })
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
      return status(404, { error: "Canvas not found after update" })
    }

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }
  })

  /**
   * Delete canvas
   */
  .delete("/:id", async ({ params, status }) => {
    const canvasId = params.id

    const existing = await db.query.canvases.findFirst({
      where: eq(canvases.id, canvasId),
      columns: { id: true },
    })

    if (!existing) {
      return status(404, { error: "Canvas not found" })
    }

    await db.delete(canvases).where(eq(canvases.id, canvasId))

    logger.info({ canvasId }, "Canvas deleted")

    return { success: true }
  })
