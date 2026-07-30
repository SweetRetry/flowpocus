import assert from "node:assert/strict"
import { describe, it } from "node:test"
import * as Y from "yjs"
import { CanvasCommandError, executeCanvasCommandInDocument } from "./canvas-command"

const request = {
  commandId: "command-1",
  name: "create_node",
  input: {
    type: "text",
    position: { x: 10, y: 20 },
    label: "Agent note",
    content: "Created through the server command path",
  },
}

describe("executeCanvasCommandInDocument", () => {
  it("创建节点并在同一份 Y.Doc 中记录 receipt", () => {
    const document = new Y.Doc()

    const receipt = executeCanvasCommandInDocument(document, "canvas-1", request)

    assert.equal(receipt.replayed, false)
    assert.equal(receipt.result.nodeId, "node-command-1")
    assert.deepEqual(document.getMap("nodes").get("node-command-1"), {
      id: "node-command-1",
      type: "text",
      position: { x: 10, y: 20 },
      width: 240,
      height: 160,
      data: {
        label: "Agent note",
        content: "Created through the server command path",
      },
    })
    assert.equal(document.getMap("_serverCommands").has("command-1"), true)
  })

  it("相同 commandId 与 payload 重放时不重复创建", () => {
    const document = new Y.Doc()
    const first = executeCanvasCommandInDocument(document, "canvas-1", request)

    const replay = executeCanvasCommandInDocument(document, "canvas-1", request)

    assert.equal(replay.replayed, true)
    assert.equal(replay.executedAt, first.executedAt)
    assert.equal(document.getMap("nodes").size, 1)
  })

  it("拒绝使用相同 commandId 提交不同 payload", () => {
    const document = new Y.Doc()
    executeCanvasCommandInDocument(document, "canvas-1", request)

    assert.throws(
      () =>
        executeCanvasCommandInDocument(document, "canvas-1", {
          ...request,
          input: { ...request.input, content: "Different" },
        }),
      (error) => error instanceof CanvasCommandError && error.code === "COMMAND_ID_CONFLICT"
    )
  })
})
