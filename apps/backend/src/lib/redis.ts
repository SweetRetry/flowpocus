import Redis from "ioredis"
import { createLogger } from "./logger"

const logger = createLogger("redis")

let redisClient: Redis | null = null

/**
 * Get or create Redis client instance
 * Returns null if REDIS_URL is not configured (single-node mode)
 */
export function getRedisClient(): Redis | null {
  if (redisClient) return redisClient

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    logger.warn("REDIS_URL not set, Redis features disabled")
    return null
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.error({ times }, "Redis retry limit exceeded")
          return null
        }
        return Math.min(times * 100, 3000)
      },
    })

    redisClient.on("connect", () => logger.info("Redis connected"))
    redisClient.on("ready", () => logger.info("Redis ready"))
    redisClient.on("error", (err) => logger.error({ error: err.message }, "Redis error"))
    redisClient.on("close", () => logger.warn("Redis connection closed"))
    redisClient.on("reconnecting", () => logger.info("Redis reconnecting"))

    return redisClient
  } catch (error) {
    logger.error({ error }, "Failed to create Redis client")
    return null
  }
}

/**
 * Gracefully shutdown Redis connection
 */
export async function shutdownRedis(): Promise<void> {
  if (!redisClient) return

  try {
    await redisClient.quit()
    logger.info("Redis shutdown complete")
  } catch (error) {
    logger.error({ error }, "Error during Redis shutdown")
  } finally {
    redisClient = null
  }
}
