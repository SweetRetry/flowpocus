"use client"

import { HocuspocusProvider } from "@hocuspocus/provider"
import { getRandomUserColor } from "@workspace/canvas/lib/colors"
import type { Edge, Node } from "@xyflow/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Y from "yjs"
import type {
  CollaborationActions,
  CollaborationOptions,
  CollaborationState,
  ConnectionStatus,
  UserPresence,
} from "./types"

/** Shape of the awareness state this app and the server's agent presence both write. */
interface AwarenessState {
  user?: {
    id?: string
    name?: string
    color?: string
    kind?: "user" | "agent"
    model?: string
    avatarUrl?: string
  }
  cursor?: { x: number; y: number } | null
  selection?: string[]
  activity?: string | null
}

/** Cursor updates are coalesced to at most one per this many ms. */
const CURSOR_INTERVAL_MS = 40

/**
 * useYjsCollaboration - React Flow + Yjs real-time collaboration hook
 *
 * Features:
 * - Bi-directional sync between React Flow and Yjs CRDT
 * - Origin tracking to prevent sync loops
 * - Scoped undo/redo (only affects current user's changes)
 * - User presence awareness (cursors, selections)
 *
 * @example
 * ```tsx
 * const { nodes, edges, status, updateNodes, updateEdges, undo, redo } = useYjsCollaboration({
 *   serverUrl: "ws://localhost:3001/collaboration",
 *   canvasId: "my-canvas-id",
 *   token: "jwt-token",
 *   user: { id: "user-1", name: "Alice" },
 * })
 * ```
 */
export function useYjsCollaboration(
  options: CollaborationOptions
): CollaborationState & CollaborationActions {
  const { serverUrl, canvasId, token, user } = options

  // Core state
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [users, setUsers] = useState<UserPresence[]>([])
  const [error, setError] = useState<string>()
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Refs for stable references
  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<HocuspocusProvider | null>(null)
  const undoManagerRef = useRef<Y.UndoManager | null>(null)
  const clientIdRef = useRef<string>(`client-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const isLocalUpdateRef = useRef(false)
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cursorSentAtRef = useRef(0)

  // User presence info
  const userInfo = useMemo(
    () => ({
      id: user?.id ?? clientIdRef.current,
      name: user?.name ?? "Anonymous",
      color: user?.color ?? getRandomUserColor(),
    }),
    [user]
  )

  /**
   * Sync Yjs maps to React Flow state
   * Only called for remote changes (origin !== clientId)
   */
  const syncFromYjs = useCallback(() => {
    if (!ydocRef.current) return

    const nodesMap = ydocRef.current.getMap("nodes")
    const edgesMap = ydocRef.current.getMap("edges")

    // Use requestAnimationFrame for smooth 60fps rendering
    requestAnimationFrame(() => {
      setNodes(Array.from(nodesMap.values()) as Node[])
      setEdges(Array.from(edgesMap.values()) as Edge[])
    })
  }, [])

  /**
   * Handle node changes from React Flow
   */
  const updateNodes = useCallback((newNodes: Node[]) => {
    // Update React state immediately for responsive UI
    setNodes(newNodes)

    if (!ydocRef.current) return

    isLocalUpdateRef.current = true

    const nodesMap = ydocRef.current.getMap<Node>("nodes")

    ydocRef.current.transact(() => {
      // Build set of new node IDs
      const newIds = new Set(newNodes.map((n) => n.id))

      // Remove nodes that no longer exist
      for (const id of nodesMap.keys()) {
        if (!newIds.has(id)) {
          nodesMap.delete(id)
        }
      }

      // Update/add nodes - skip local-only properties
      for (const node of newNodes) {
        const existing = nodesMap.get(node.id)
        // Create a copy without transient properties
        const nodeToStore = {
          ...node,
          selected: undefined,
          dragging: undefined,
        }

        if (!existing || JSON.stringify(existing) !== JSON.stringify(nodeToStore)) {
          nodesMap.set(node.id, nodeToStore)
        }
      }
    }, clientIdRef.current) // Origin tracking

    isLocalUpdateRef.current = false
  }, [])

  /**
   * Handle edge changes from React Flow
   * Uses Edge[] type to accept edges from addEdge() and applyEdgeChanges()
   */
  const updateEdges = useCallback((newEdges: Edge[]) => {
    // Update React state immediately for responsive UI
    setEdges([...newEdges])

    if (!ydocRef.current) return

    isLocalUpdateRef.current = true

    // Use unknown type for Yjs map to avoid strict type constraints
    const edgesMap = ydocRef.current.getMap("edges")

    ydocRef.current.transact(() => {
      const newIds = new Set(newEdges.map((e) => e.id))

      for (const id of edgesMap.keys()) {
        if (!newIds.has(id)) {
          edgesMap.delete(id)
        }
      }

      for (const edge of newEdges) {
        const existing = edgesMap.get(edge.id)
        // Create a copy without transient properties
        const { selected: _, ...edgeToStore } = edge

        if (!existing || JSON.stringify(existing) !== JSON.stringify(edgeToStore)) {
          edgesMap.set(edge.id, edgeToStore)
        }
      }
    }, clientIdRef.current)

    isLocalUpdateRef.current = false
  }, [])

  /**
   * Undo last local change
   */
  const undo = useCallback(() => {
    undoManagerRef.current?.undo()
  }, [])

  /**
   * Redo last undone change
   */
  const redo = useCallback(() => {
    undoManagerRef.current?.redo()
  }, [])

  /**
   * Update cursor position for awareness. Moves are throttled; leaving the canvas (null)
   * goes out at once and cancels any move still waiting.
   */
  const updateCursor = useCallback((position: { x: number; y: number } | null) => {
    const awareness = providerRef.current?.awareness
    if (!awareness) return

    clearTimeout(cursorTimerRef.current)
    const send = () => {
      cursorSentAtRef.current = performance.now()
      awareness.setLocalStateField("cursor", position)
    }
    const wait = CURSOR_INTERVAL_MS - (performance.now() - cursorSentAtRef.current)
    if (!position || wait <= 0) {
      send()
    } else {
      cursorTimerRef.current = setTimeout(send, wait)
    }
  }, [])

  /**
   * Update selection for awareness
   */
  const updateSelection = useCallback((nodeIds: string[]) => {
    if (!providerRef.current?.awareness) return

    providerRef.current.awareness.setLocalStateField("selection", nodeIds)
  }, [])

  /**
   * Force reconnect
   */
  const reconnect = useCallback(() => {
    providerRef.current?.connect()
  }, [])

  /**
   * Disconnect from server
   */
  const disconnect = useCallback(() => {
    providerRef.current?.disconnect()
  }, [])

  /**
   * Initialize Yjs document and Hocuspocus provider
   */
  useEffect(() => {
    // Create Yjs document
    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    // Get shared types (use unknown to avoid strict type constraints with Yjs)
    const nodesMap = ydoc.getMap("nodes")
    const edgesMap = ydoc.getMap("edges")

    // Create Hocuspocus provider
    // Construct full WebSocket URL with canvasId in path
    const wsUrl = `${serverUrl}/${canvasId}`

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: canvasId,
      document: ydoc,
      token: token ?? "",
      onConnect: () => {
        setStatus("connected")
        setError(undefined)
      },
      onClose: () => {
        setStatus("disconnected")
      },
      onSynced: () => {
        // Initial sync after connection
        syncFromYjs()
      },
      onAuthenticationFailed: ({ reason }) => {
        setStatus("error")
        setError(reason ?? "Authentication failed")
      },
      onStatus: ({ status: providerStatus }) => {
        if (providerStatus === "connecting") {
          setStatus("connecting")
        }
      },
    })
    providerRef.current = provider

    // Set up awareness (user presence)
    provider.awareness?.setLocalState({
      user: { ...userInfo, kind: "user" },
      cursor: null,
      selection: [],
    })

    // Create UndoManager with scoped tracking (only this client's changes)
    const undoManager = new Y.UndoManager([nodesMap, edgesMap], {
      trackedOrigins: new Set([clientIdRef.current]),
    })
    undoManagerRef.current = undoManager

    // Update undo/redo state
    const updateUndoState = () => {
      setCanUndo(undoManager.canUndo())
      setCanRedo(undoManager.canRedo())
    }
    undoManager.on("stack-item-added", updateUndoState)
    undoManager.on("stack-item-popped", updateUndoState)

    // Observe Yjs changes with origin tracking
    const handleRemoteChange = (transaction: Y.Transaction) => {
      // Skip if this is a local update (prevents sync loop)
      if (transaction.origin === clientIdRef.current || isLocalUpdateRef.current) {
        return
      }
      // Sync remote changes to React state
      syncFromYjs()
    }

    const observeNodeChanges = (_event: Y.YMapEvent<unknown>, transaction: Y.Transaction) => {
      handleRemoteChange(transaction)
    }

    const observeEdgeChanges = (_event: Y.YMapEvent<unknown>, transaction: Y.Transaction) => {
      handleRemoteChange(transaction)
    }

    nodesMap.observe(observeNodeChanges)
    edgesMap.observe(observeEdgeChanges)

    // Awareness changes (other users)
    const awarenessHandler = () => {
      if (!provider.awareness) return

      const otherUsers: UserPresence[] = []
      for (const [clientId, state] of provider.awareness.getStates()) {
        if (clientId === provider.awareness.clientID) continue
        const { user, cursor, selection } = state as AwarenessState
        otherUsers.push({
          clientId,
          id: user?.id ?? "unknown",
          name: user?.name ?? "Anonymous",
          color: user?.color ?? "#888",
          kind: user?.kind ?? "user",
          model: user?.model,
          avatarUrl: user?.avatarUrl,
          activity: state.activity ?? undefined,
          cursor: cursor ?? undefined,
          selection,
        })
      }

      setUsers(otherUsers)
    }
    provider.awareness?.on("change", awarenessHandler)

    // Cleanup
    return () => {
      nodesMap.unobserve(observeNodeChanges)
      edgesMap.unobserve(observeEdgeChanges)
      provider.awareness?.off("change", awarenessHandler)
      clearTimeout(cursorTimerRef.current)
      undoManager.destroy()
      provider.disconnect()
      provider.destroy()
      ydoc.destroy()
    }
  }, [serverUrl, canvasId, token, userInfo, syncFromYjs])

  return {
    // State
    nodes,
    edges,
    status,
    self: userInfo,
    users,
    error,
    canUndo,
    canRedo,
    // Actions
    updateNodes,
    updateEdges,
    undo,
    redo,
    updateCursor,
    updateSelection,
    reconnect,
    disconnect,
  }
}
