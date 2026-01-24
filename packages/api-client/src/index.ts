import type { AppType } from "@workspace/backend"
import { hc } from "hono/client"

/**
 * Create type-safe API client for Hono backend
 */
export function createApiClient(baseUrl = "http://localhost:3001") {
  return hc<AppType>(baseUrl)
}

export type { AppType }
export type ApiClient = ReturnType<typeof createApiClient>
