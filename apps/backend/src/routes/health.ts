import { Elysia } from "elysia"
import { z } from "zod"

const healthSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.number(),
  version: z.string(),
})

export type HealthResponse = z.infer<typeof healthSchema>

export const healthRoutes = new Elysia({ prefix: "/health" }).get(
  "",
  (): HealthResponse => ({ status: "ok", timestamp: Date.now(), version: "0.0.1" })
)
