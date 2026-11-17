import { canvasCommandRequestSchema, listCanvasCommandDefinitions } from "@workspace/commands"
import { Elysia } from "elysia"
import { CanvasCommandError, executeCanvasCommand } from "../commands"

export const commandRoutes = new Elysia({ prefix: "/api/commands" })
  .get("", () => ({ data: listCanvasCommandDefinitions() }))
  .post(
    "/:canvasId",
    async ({ params, request, status }) => {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return status(400, {
          error: { code: "INVALID_JSON", message: "Request body must be valid JSON" },
        })
      }

      const parsed = canvasCommandRequestSchema.safeParse(body)
      if (!parsed.success) {
        return status(400, {
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid command request",
            details: parsed.error.flatten(),
          },
        })
      }

      try {
        return await executeCanvasCommand(params.canvasId, parsed.data)
      } catch (error) {
        if (error instanceof CanvasCommandError) {
          return status(error.status, {
            error: { code: error.code, message: error.message, details: error.details },
          })
        }
        throw error
      }
    },
    // Read the body ourselves so malformed JSON maps to INVALID_JSON instead of Elysia's parse error
    { parse: "none" }
  )
