import { createHash } from "node:crypto"
import type { Document } from "@hocuspocus/server"
import type { CanvasAgent } from "@workspace/commands"
import * as encoding from "lib0/encoding"
import { applyAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness"

/** Time for the browser to glide the cursor to its target, then to "click". */
const TRAVEL_MS = 700
const CLICK_MS = 250
/** The cursor stays this long after the last action before it leaves the canvas. */
const LINGER_MS = 4000
/** Where an agent's cursor appears when it first joins, relative to its first target. */
const ENTRY_OFFSET = { x: -160, y: -120 }
const DEFAULT_COLOR = "#8b5cf6"
/** Brand colors for known model families, used when the agent names a model but no color. */
const FAMILY_COLORS: [RegExp, string][] = [
  [/claude/i, "#d97706"],
  [/deepseek/i, "#4d6bfe"],
  [/gpt|openai/i, "#10a37f"],
  [/gemini/i, "#1a73e8"],
]

type Point = { x: number; y: number }

const lingerTimers = new Map<string, NodeJS.Timeout>()
let clock = Date.now()

/** Stable per canvas and agent name, so a returning agent keeps one cursor. */
function awarenessClientId(canvasId: string, name: string): number {
  const digest = createHash("sha256").update(`${canvasId}\0${name}`).digest()
  return digest.readUInt32BE(0) || 1
}

/**
 * Write a state for a client that has no socket of its own. A wall-clock based clock keeps
 * the update newer than anything a browser remembers from before a server restart.
 */
function publish(document: Document, clientId: number, state: object | null) {
  clock = Math.max(clock + 1, Date.now())
  const update = encoding.createEncoder()
  encoding.writeVarUint(update, 1)
  encoding.writeVarUint(update, clientId)
  encoding.writeVarUint(update, clock)
  encoding.writeVarString(update, JSON.stringify(state))
  applyAwarenessUpdate(document.awareness, encoding.toUint8Array(update), "agent-presence")
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface AgentPresence {
  /** Glide to a point and pause as if about to click. */
  approach(position: Point, activity: string): Promise<void>
  /** Rest the cursor, mark what the agent touched, and start the leave timer. */
  settle(selection: string[]): void
}

/**
 * An agent's cursor on a live canvas, shown through Yjs awareness like a human collaborator's.
 * Returns null when nobody else is connected: there is no audience, so no time is spent.
 */
export function openAgentPresence(
  document: Document,
  canvasId: string,
  agent: CanvasAgent
): AgentPresence | null {
  if (document.getConnections().length === 0) {
    return null
  }

  const clientId = awarenessClientId(canvasId, agent.name)
  const timerKey = `${canvasId}:${clientId}`
  const identity = `${agent.model ?? ""} ${agent.name}`
  const user = {
    id: `agent:${agent.name}`,
    name: agent.name,
    color:
      agent.color ?? FAMILY_COLORS.find(([family]) => family.test(identity))?.[1] ?? DEFAULT_COLOR,
    kind: "agent",
    model: agent.model,
    avatarUrl: agent.avatarUrl,
  }
  const show = (cursor: Point, activity: string | null, selection: string[] = []) => {
    clearTimeout(lingerTimers.get(timerKey))
    publish(document, clientId, { user, cursor, selection, activity })
  }

  return {
    async approach(position, activity) {
      if (!document.awareness.getStates().has(clientId)) {
        show({ x: position.x + ENTRY_OFFSET.x, y: position.y + ENTRY_OFFSET.y }, null)
        await sleep(60)
      }
      show(position, activity)
      await sleep(TRAVEL_MS + CLICK_MS)
    },

    settle(selection) {
      const cursor = document.awareness.getStates().get(clientId)?.cursor as Point | undefined
      if (cursor) show(cursor, null, selection)
      lingerTimers.set(
        timerKey,
        setTimeout(() => {
          lingerTimers.delete(timerKey)
          removeAwarenessStates(document.awareness, [clientId], "agent-presence")
        }, LINGER_MS).unref()
      )
    },
  }
}
