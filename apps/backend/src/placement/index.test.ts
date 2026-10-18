import assert from "node:assert/strict"
import { after, describe, it } from "node:test"
import { useTestDatabase } from "../lib/test-database"

const { db, drop } = await useTestDatabase()
const { createCluster } = await import("./index")
after(drop)

const base = {
  redisUrl: undefined,
  db,
  instanceId: "a",
  instanceUrl: "http://a:3001",
  onLost: () => {},
}

describe("createCluster", () => {
  it("拒绝未知的 CLUSTER_MODE", () => {
    assert.throws(
      () => createCluster({ ...base, mode: "raft" }),
      /CLUSTER_MODE must be one of owner, redis, got "raft"/
    )
  })

  it("redis 模式缺少 REDIS_URL 时启动即失败", () => {
    assert.throws(() => createCluster({ ...base, mode: "redis" }), /requires REDIS_URL/)
  })

  it("owner 模式不挂额外扩展", async () => {
    const cluster = createCluster({ ...base, mode: "owner" })

    assert.deepEqual(cluster.extensions, [])
    await cluster.placement.close()
  })
})
