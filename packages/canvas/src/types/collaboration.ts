/**
 * Connection status for collaboration
 */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

/**
 * Awareness user presence data
 */
export interface UserPresence {
  id: string
  name: string
  color: string
  cursor?: { x: number; y: number }
  selection?: string[]
}
