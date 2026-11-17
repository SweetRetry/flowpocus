import type { ConnectionStatus, UserPresence } from "@workspace/canvas/types/collaboration"
import type { Edge, Node } from "@xyflow/react"

export type { ConnectionStatus, UserPresence }

/**
 * Collaboration hook options
 */
export interface CollaborationOptions {
  /** WebSocket server URL */
  serverUrl: string
  /** Canvas/document ID */
  canvasId: string
  /** Authentication token */
  token?: string
  /** User presence information */
  user?: {
    id: string
    name: string
    color?: string
  }
  /** Connection timeout in ms (default: 5000) */
  timeout?: number
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean
}

/**
 * Collaboration hook return type
 */
export interface CollaborationState {
  /** Current nodes from Yjs state */
  nodes: Node[]
  /** Current edges from Yjs state */
  edges: Edge[]
  /** Connection status */
  status: ConnectionStatus
  /** This client as others see it, so the UI can show it beside them */
  self: { name: string; color: string }
  /** Other users currently editing */
  users: UserPresence[]
  /** Error message if status is 'error' */
  error?: string
  /** Whether this client can undo */
  canUndo: boolean
  /** Whether this client can redo */
  canRedo: boolean
}

/**
 * Collaboration hook actions
 */
export interface CollaborationActions {
  /** Update nodes (from React Flow onChange) */
  updateNodes: (nodes: Node[]) => void
  /** Update edges (from React Flow onChange) */
  updateEdges: (edges: Edge[]) => void
  /** Undo last local change */
  undo: () => void
  /** Redo last undone local change */
  redo: () => void
  /** Update cursor position for awareness */
  updateCursor: (position: { x: number; y: number } | null) => void
  /** Update selection for awareness */
  updateSelection: (nodeIds: string[]) => void
  /** Force reconnect */
  reconnect: () => void
  /** Disconnect from server */
  disconnect: () => void
}
