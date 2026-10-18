import assert from "node:assert/strict"
import { beforeEach, describe, it } from "node:test"
import { and, eq, sql } from "drizzle-orm"

process.env.DATABASE_URL = ":memory:"
process.env.LOG_LEVEL = "error"
const { canvases, db } = await import("@workspace/database")
const { createLeasePlacement } = await import("./lease")

// Mirrors packages/database/src/schema; the repo applies schema with db:push
db.run(sql`CREATE TABLE canvases (id text PRIMARY KEY NOT NULL, name text NOT NULL)`)
db.run(sql`
  CREATE TABLE canvas_leases (
    canvas_id text PRIMARY KEY NOT NULL,
    owner_id text NOT NULL,
    owner_url text NOT NULL,
    expires_at integer NOT NULL
  )
`)

let clock = 0
const lost: string[] = []

function instance(id: string) {
  return createLeasePlacement({
    db,
    instanceId: id,
    instanceUrl: `http://${id}:3001`,
    onLost: (canvasId) => lost.push(`${id}:${canvasId}`),
    ttlMs: 30_000,
    now: () => clock,
  })
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
  beforeEach(() => {
    db.run(sql`DELETE FROM canvas_leases`)
    db.run(sql`DELETE FROM canvases`)
    db.run(sql`INSERT INTO canvases (id, name) VALUES ('canvas-1', 'Untitled')`)
    clock = 1_000_000
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

    clock += 30_001
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
    clock += 30_001
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

  it("续约让持有者跨过原过期时间", async () => {
    const a = instance("a")
    const b = instance("b")
    await a.acquire("canvas-1")

    clock += 20_000
    await a.renew()
    clock += 20_000

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
