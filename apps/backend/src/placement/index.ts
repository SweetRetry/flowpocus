import type { DatabaseClient } from "@workspace/database"
import { createLeasePlacement } from "./lease"
import { createRedisCluster } from "./redis"
import { type Cluster, type ClusterMode, clusterModes } from "./types"

export type { CanvasPlacement } from "./types"

interface ClusterOptions {
  mode: string
  redisUrl: string | undefined
  db: DatabaseClient
  instanceId: string
  instanceUrl: string
  onLost: (canvasId: string) => void
}

function parseMode(mode: string): ClusterMode {
  if ((clusterModes as readonly string[]).includes(mode)) return mode as ClusterMode
  throw new Error(`CLUSTER_MODE must be one of ${clusterModes.join(", ")}, got "${mode}"`)
}

export function createCluster({ mode, redisUrl, ...lease }: ClusterOptions): Cluster {
  switch (parseMode(mode)) {
    case "owner":
      return { placement: createLeasePlacement(lease), extensions: [] }
    case "redis":
      if (!redisUrl) throw new Error("CLUSTER_MODE=redis requires REDIS_URL")
      return createRedisCluster({ redisUrl, instanceId: lease.instanceId })
  }
}
