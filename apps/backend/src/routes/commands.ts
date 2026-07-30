import { canvasCommandRequestSchema, listCanvasCommandDefinitions } from "@workspace/commands"
import { canvases, db } from "@workspace/database"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { CanvasCommandError, executeCanvasCommand } from "../commands"

export const commandRoutes = new Hono()
  .get("/", (c) => c.json({ data: listCanvasCommandDefinitions() }))
  .post("/:canvasId", async (c) => {
    try {
      const body = await c.req.json()
      const parsed = canvasCommandRequestSchema.safeParse(body)

      if (!parsed.success) {
        return c.json(
          {
            error: {
              code: "INVALID_REQUEST",
              message: "Invalid command request",
              details: parsed.error.flatten(),
            },
          },
          400
        )
      }

      const canvasId = c.req.param("canvasId")
      const canvas = await db.query.canvases.findFirst({
        where: eq(canvases.id, canvasId),
        columns: { id: true },
      })

      if (!canvas) {
        return c.json({ error: { code: "CANVAS_NOT_FOUND", message: "Canvas not found" } }, 404)
      }

      const receipt = await executeCanvasCommand(canvasId, parsed.data)
      return c.json(receipt)
    } catch (error) {
      if (error instanceof CanvasCommandError) {
        return c.json(
          {
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          },
          error.status
        )
      }

      if (error instanceof SyntaxError) {
        return c.json(
          { error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } },
          400
        )
      }

      throw error
    }
  })
