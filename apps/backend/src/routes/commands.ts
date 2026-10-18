import { canvasCommandRequestSchema, listCanvasCommandDefinitions } from "@workspace/commands"
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

      const receipt = await executeCanvasCommand(c.req.param("canvasId"), parsed.data)
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
