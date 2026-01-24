import { Hono } from "hono"
import { z } from "zod"

const healthSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.number(),
  version: z.string(),
})

export type HealthResponse = z.infer<typeof healthSchema>

export const healthRoutes = new Hono().get("/", (c) => {
  const response: HealthResponse = {
    status: "ok",
    timestamp: Date.now(),
    version: "0.0.1",
  }
  return c.json(response)
})
