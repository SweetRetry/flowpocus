import assert from "node:assert/strict"
import { afterEach, beforeEach, describe, it, mock } from "node:test"
import { type Connection, Document } from "@hocuspocus/server"
import { executeCanvasCommandInDocument, planCommandFocus } from "./canvas-command"
import { openAgentPresence } from "./presence"

const agent = { name: "Claude", color: "#d97706" }

const documents: Document[] = []

/** A Document's awareness interval keeps the process alive until its awareness is destroyed. */
function createDocument() {
  const document = new Document("canvas-1")
  documents.push(document)
  return document
}

/** The part of a connection the awareness broadcast touches. */
const viewer = () =>
  ({ messageAddress: "canvas-1", send: () => undefined }) as unknown as Connection

/** Let pending continuations run; setImmediate is not mocked. */
const flush = () => new Promise((resolve) => setImmediate(resolve))

function agentStates(document: Document) {
  return [...document.awareness.getStates().values()]
}

afterEach(() => {
  for (const document of documents.splice(0)) {
    document.awareness.destroy()
    document.destroy()
  }
})

describe("openAgentPresence", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }))
  afterEach(() => mock.timers.reset())

  it("没有其他连接时不展示光标，也不耗时", () => {
    const document = createDocument()
    document.addDirectConnection()

    assert.equal(openAgentPresence(document, "canvas-1", agent), null)
  })

  it("光标从入场点滑向目标，落笔后选中新节点，并在停留后离场", async () => {
    const document = createDocument()
    document.addConnection(viewer())
    const presence = openAgentPresence(document, "canvas-1", agent)
    assert.ok(presence)

    const approaching = presence.approach({ x: 400, y: 300 }, "Creating text node")
    assert.deepEqual(
      agentStates(document).map((state) => state.cursor),
      [{ x: 240, y: 180 }]
    )

    mock.timers.tick(60)
    await flush()
    assert.deepEqual(
      agentStates(document).map((state) => state.cursor),
      [{ x: 400, y: 300 }]
    )
    assert.equal(agentStates(document)[0]?.activity, "Creating text node")
    mock.timers.tick(950)
    await approaching

    presence.settle(["node-1"])
    assert.deepEqual(agentStates(document)[0], {
      user: { id: "agent:Claude", name: "Claude", color: "#d97706", kind: "agent" },
      cursor: { x: 400, y: 300 },
      selection: ["node-1"],
      activity: null,
    })

    mock.timers.tick(4000)
    assert.equal(agentStates(document).length, 0)
  })

  it("再次出现的 agent 沿用同一个光标，不重新入场", async () => {
    const document = createDocument()
    document.addConnection(viewer())
    const first = openAgentPresence(document, "canvas-1", agent)
    const pending = first?.approach({ x: 0, y: 0 }, "Creating text node")
    mock.timers.tick(60)
    await flush()
    mock.timers.tick(950)
    await pending
    first?.settle([])

    const second = openAgentPresence(document, "canvas-1", agent)
    const moving = second?.approach({ x: 500, y: 500 }, "Creating text node")

    assert.equal(document.awareness.getStates().size, 1)
    assert.deepEqual(agentStates(document)[0]?.cursor, { x: 500, y: 500 })
    mock.timers.tick(950)
    await moving
  })
})

describe("agent identity", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }))
  afterEach(() => mock.timers.reset())

  async function userOf(agent: Parameters<typeof openAgentPresence>[2]) {
    const document = createDocument()
    document.addConnection(viewer())
    const presence = openAgentPresence(document, "canvas-1", agent)
    const pending = presence?.approach({ x: 0, y: 0 }, "Creating text node")
    mock.timers.tick(60)
    await flush()
    mock.timers.tick(950)
    await pending
    return agentStates(document)[0]?.user
  }

  it("带上自报的型号和头像，未给颜色时按型号家族取色", async () => {
    const avatarUrl = "https://example.com/deepseek.png"

    assert.deepEqual(await userOf({ name: "Bot", model: "deepseek-v4", avatarUrl }), {
      id: "agent:Bot",
      name: "Bot",
      color: "#4d6bfe",
      kind: "agent",
      model: "deepseek-v4",
      avatarUrl,
    })
  })

  it("显式颜色优先于型号家族，未知型号用默认色", async () => {
    assert.equal(
      (await userOf({ name: "Bot", model: "gpt-5", color: "#112233" }))?.color,
      "#112233"
    )
    assert.equal((await userOf({ name: "Mystery" }))?.color, "#8b5cf6")
  })
})

describe("planCommandFocus", () => {
  const request = {
    commandId: "command-1",
    name: "create_node",
    input: { type: "image", position: { x: 10, y: 20 } },
  }

  it("返回首次有效命令的落点和动作", () => {
    const document = createDocument()

    assert.deepEqual(planCommandFocus(document, request), {
      position: { x: 10, y: 20 },
      activity: "Creating image node",
    })
  })

  it("无效输入、未知命令和已执行过的 commandId 没有可看的动作", () => {
    const document = createDocument()
    executeCanvasCommandInDocument(document, "canvas-1", request)

    assert.equal(planCommandFocus(document, request), null)
    assert.equal(planCommandFocus(document, { ...request, commandId: "c2", input: {} }), null)
    assert.equal(planCommandFocus(document, { ...request, commandId: "c3", name: "nope" }), null)
  })
})
