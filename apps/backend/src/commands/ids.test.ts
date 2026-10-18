import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createCanvasId, createElementId } from "@workspace/commands"

describe("short IDs", () => {
  it("画布 ID 是 12 位 base62，节点 ID 是 8 位 base62", () => {
    assert.match(createCanvasId(), /^[0-9A-Za-z]{12}$/)
    assert.match(createElementId(), /^[0-9A-Za-z]{8}$/)
  })

  it("一万次生成不重复且覆盖全部 62 个字符", () => {
    const ids = Array.from({ length: 10_000 }, createElementId)
    assert.equal(new Set(ids).size, 10_000)
    assert.equal(new Set(ids.join("")).size, 62)
  })
})
