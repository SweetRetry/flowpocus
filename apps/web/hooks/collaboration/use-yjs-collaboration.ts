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
   * Update cursor position for awareness
   */
  const updateCursor = useCallback((position: { x: number; y: number } | null) => {
    if (!providerRef.current?.awareness) return

    providerRef.current.awareness.setLocalStateField("cursor", position)
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
      user: userInfo,
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

      const states = Array.from(provider.awareness.getStates().entries())
      const otherUsers: UserPresence[] = states
        .filter(([clientId]) => clientId !== provider.awareness?.clientID)
        .map(([, state]) => ({
          id: (state as { user?: { id?: string } }).user?.id ?? "unknown",
          name: (state as { user?: { name?: string } }).user?.name ?? "Anonymous",
          color: (state as { user?: { color?: string } }).user?.color ?? "#888",
          cursor: (state as { cursor?: { x: number; y: number } }).cursor,
          selection: (state as { selection?: string[] }).selection,
        }))

      setUsers(otherUsers)
    }
    provider.awareness?.on("change", awarenessHandler)

    // Cleanup
    return () => {
      nodesMap.unobserve(observeNodeChanges)
      edgesMap.unobserve(observeEdgeChanges)
      provider.awareness?.off("change", awarenessHandler)
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
