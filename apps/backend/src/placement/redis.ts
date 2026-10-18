import { Redis as RedisExtension } from "@hocuspocus/extension-redis"
import Redis from "ioredis"
import { createLogger } from "../lib/logger"
import type { Cluster } from "./types"

const logger = createLogger("redis")

/**
 * Every instance serves every canvas locally; copies on different instances
 * stay in sync over Redis Pub/Sub, and the extension's Redlock serialises
 * stores. No forwarding, so placement always answers "local".
 */
export function createRedisCluster({
  redisUrl,
  instanceId,
}: {
  redisUrl: string
  instanceId: string
}): Cluster {
  const extension = new RedisExtension({
    identifier: instanceId,
    createClient: () => {
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 100, 3000),
      })
      client.on("error", (error) => logger.error({ error: error.message }, "Redis error"))
      return client
    },
  })

  return {
    placement: {
      locate: async () => ({ kind: "local" }),
      acquire: async () => true,
      // The extension's Redlock serialises stores across instances
      fence: () => undefined,
      release: async () => {},
      close: () => extension.onDestroy(),
    },
    extensions: [extension],
  }
}
