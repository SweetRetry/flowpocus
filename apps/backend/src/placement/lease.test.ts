import assert from "node:assert/strict"
import { after, beforeEach, describe, it } from "node:test"
import { setTimeout as sleep } from "node:timers/promises"
import { canvases, canvasLeases } from "@workspace/database"
import { and, eq, sql } from "drizzle-orm"
import { useTestDatabase } from "../lib/test-database"

process.env.LOG_LEVEL = "error"
const { db, drop } = await useTestDatabase()
const { createLeasePlacement } = await import("./lease")
after(drop)

const lost: string[] = []

function instance(id: string) {
  return createLeasePlacement({
    db,
    instanceId: id,
    instanceUrl: `http://${id}:3001`,
    onLost: (canvasId) => lost.push(`${id}:${canvasId}`),
    ttlMs: 30_000,
  })
}

/** Lease time comes from the database clock, so tests expire a lease in the database. */
async function expire(canvasId: string) {
  await db
    .update(canvasLeases)
    .set({ expiresAt: sql`now() - interval '1 second'` })
    .where(eq(canvasLeases.canvasId, canvasId))
}

/** The persistence write shape used by the store hook: one UPDATE carrying the fence. */
async function fencedWrite(
  placement: ReturnType<typeof instance>,
  canvasId: string,
  name = "written"
) {
  const rows = await db
    .update(canvases)
    .set({ name })
    .where(and(eq(canvases.id, canvasId), placement.fence(canvasId)))
    .returning({ id: canvases.id })
  return rows.length === 1
}

describe("createLeasePlacement", () => {
  beforeEach(async () => {
    await db.delete(canvasLeases)
    await db.delete(canvases)
    await db.insert(canvases).values({ id: "canvas-1" })
    lost.length = 0
  })

  it("未被持有的画布在任何实例上都定位为本地", async () => {
    const a = instance("a")

    assert.deepEqual(await a.locate("canvas-1"), { kind: "local" })
    await a.close()
  })

  it("一个实例持有后，另一个实例定位到它并且无法抢占", async () => {
    const a = instance("a")
    const b = instance("b")

    assert.equal(await a.acquire("canvas-1"), true)

    assert.deepEqual(await b.locate("canvas-1"), { kind: "remote", url: "http://a:3001" })
    assert.deepEqual(await a.locate("canvas-1"), { kind: "local" })
    assert.equal(await b.acquire("canvas-1"), false)
    assert.equal(await fencedWrite(b, "canvas-1"), false)
    assert.equal(await fencedWrite(a, "canvas-1"), true)
    await Promise.all([a.close(), b.close()])
  })

  it("租约过期后由新实例接管，旧实例续约时收到 onLost，且它的写库语句匹配不到行", async () => {
    const a = instance("a")
    const b = instance("b")
    await a.acquire("canvas-1")

    await expire("canvas-1")
    assert.deepEqual(await b.locate("canvas-1"), { kind: "local" })
    assert.equal(await b.acquire("canvas-1"), true)
    await a.renew()

    assert.deepEqual(lost, ["a:canvas-1"])
    assert.equal(await fencedWrite(a, "canvas-1"), false)
    assert.equal(await fencedWrite(b, "canvas-1"), true)
    assert.deepEqual(await a.locate("canvas-1"), { kind: "remote", url: "http://b:3001" })
    await Promise.all([a.close(), b.close()])
  })

  it("卡住的旧 owner 醒来后写库，不会覆盖新 owner 已写入的状态", async () => {
    const a = instance("a")
    const b = instance("b")
    await a.acquire("canvas-1")

    // A stalls past the ttl without renewing; B takes over, edits, persists
    await expire("canvas-1")
    await b.acquire("canvas-1")
    assert.equal(await fencedWrite(b, "canvas-1", "state from b"), true)

    // A wakes up and runs the write it was about to make
    assert.equal(await fencedWrite(a, "canvas-1", "stale state from a"), false)
    const row = await db.query.canvases.findFirst({
      where: eq(canvases.id, "canvas-1"),
      columns: { name: true },
    })
    assert.equal(row?.name, "state from b")
    await Promise.all([a.close(), b.close()])
  })

  it("接管事务未提交时，旧 owner 的写库等待它提交，然后匹配不到行", async () => {
    const a = instance("a")
    await a.acquire("canvas-1")

    // Another connection is mid-takeover: lease row changed, not yet committed
    const takeover = await db.$client.connect()
    await takeover.query("BEGIN")
    await takeover.query("UPDATE canvas_leases SET owner_id = 'b' WHERE canvas_id = 'canvas-1'")

    // A's store starts against a snapshot that still says A owns the canvas
    const write = fencedWrite(a, "canvas-1", "stale state from a")
    const settledEarly = await Promise.race([write.then(() => true), sleep(200, false)])

    await takeover.query("COMMIT")
    takeover.release()

    assert.equal(settledEarly, false)
    assert.equal(await write, false)
    await a.close()
  })

  it("过期但没被接管的租约，续约后重新生效", async () => {
    const a = instance("a")
    const b = instance("b")
    await a.acquire("canvas-1")

    await expire("canvas-1")
    await a.renew()

    assert.equal(await b.acquire("canvas-1"), false)
    assert.deepEqual(lost, [])
    await Promise.all([a.close(), b.close()])
  })

  it("释放只删除自己的租约，关闭释放全部", async () => {
    const a = instance("a")
    const b = instance("b")
    await a.acquire("canvas-1")
    await a.acquire("canvas-2")

    await b.release("canvas-1")
    assert.equal(await b.acquire("canvas-1"), false)

    await a.release("canvas-1")
    assert.equal(await b.acquire("canvas-1"), true)

    await a.close()
    assert.equal(await b.acquire("canvas-2"), true)
    await b.close()
  })
})
