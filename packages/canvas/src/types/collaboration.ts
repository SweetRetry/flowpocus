/**
 * Connection status for collaboration
 */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

/**
 * Awareness user presence data
 */
export interface UserPresence {
  /** Awareness client ID, unique per connection (one user can have several tabs). */
  clientId: number
  id: string
  name: string
  color: string
  /** Agents are server-driven cursors; they glide instead of tracking a pointer. */
  kind: "user" | "agent"
  /** Model an agent says it runs on. */
  model?: string
  /** HTTPS avatar an agent claims for itself. */
  avatarUrl?: string
  /** What an agent is doing right now, shown next to its cursor. */
  activity?: string
  cursor?: { x: number; y: number }
  selection?: string[]
}
