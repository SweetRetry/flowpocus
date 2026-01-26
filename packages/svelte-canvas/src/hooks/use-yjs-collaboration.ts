import { HocuspocusProvider } from "@hocuspocus/provider"
import { get, writable } from "svelte/store"
import { onDestroy, onMount } from "svelte"
import type { Edge, Node } from "@xyflow/svelte"
import * as Y from "yjs"
import { getRandomUserColor } from "../lib/colors"
import type { ConnectionStatus, UserPresence } from "../types/collaboration"

export interface CollaborationOptions {
  serverUrl: string
  canvasId: string
  token?: string
  user?: {
    id: string
    name: string
    color?: string
  }
}

export interface CollaborationState {
  nodes: ReturnType<typeof writable<Node[]>>
  edges: ReturnType<typeof writable<Edge[]>>
  status: ReturnType<typeof writable<ConnectionStatus>>
  users: ReturnType<typeof writable<UserPresence[]>>
  error: ReturnType<typeof writable<string | undefined>>
  canUndo: ReturnType<typeof writable<boolean>>
  canRedo: ReturnType<typeof writable<boolean>>
}

export interface CollaborationActions {
  updateNodes: (newNodes: Node[]) => void
  updateEdges: (newEdges: Edge[]) => void
  undo: () => void
  redo: () => void
  updateCursor: (position: { x: number; y: number } | null) => void
  updateSelection: (nodeIds: string[]) => void
  reconnect: () => void
  disconnect: () => void
}

/**
 * useYjsCollaboration - Svelte Flow + Yjs real-time collaboration
 */
export function useYjsCollaboration(
  optionsOrGetter: CollaborationOptions | (() => CollaborationOptions)
): CollaborationState & CollaborationActions {
  const options = typeof optionsOrGetter === "function" ? optionsOrGetter() : optionsOrGetter
  const { serverUrl, canvasId, token, user } = options

  const baseNodes = writable<Node[]>([])
  const baseEdges = writable<Edge[]>([])
  const status = writable<ConnectionStatus>("disconnected")
  const users = writable<UserPresence[]>([])
  const error = writable<string | undefined>(undefined)
  const canUndo = writable(false)
  const canRedo = writable(false)

  let ydoc: Y.Doc | null = null
  let provider: HocuspocusProvider | null = null
  let undoManager: Y.UndoManager | null = null
  const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2)}`
  let isLocalUpdate = false

  const userInfo = {
    id: user?.id ?? clientId,
    name: user?.name ?? "Anonymous",
    color: user?.color ?? getRandomUserColor()
  }

  const setNodesFromYjs = (newNodes: Node[]) => {
    baseNodes.set(newNodes)
  }

  const setEdgesFromYjs = (newEdges: Edge[]) => {
    baseEdges.set(newEdges)
  }

  const syncFromYjs = () => {
    if (!ydoc) return
    const nodesMap = ydoc.getMap("nodes")
    const edgesMap = ydoc.getMap("edges")

    requestAnimationFrame(() => {
      setNodesFromYjs(Array.from(nodesMap.values()) as Node[])
      setEdgesFromYjs(Array.from(edgesMap.values()) as Edge[])
    })
  }

  const updateNodes = (newNodes: Node[]) => {
    baseNodes.set(newNodes)
    if (!ydoc) return

    isLocalUpdate = true

    const nodesMap = ydoc.getMap<Node>("nodes")

    ydoc.transact(() => {
      const newIds = new Set(newNodes.map((n) => n.id))

      for (const id of nodesMap.keys()) {
        if (!newIds.has(id)) {
          nodesMap.delete(id)
        }
      }

      for (const node of newNodes) {
        const existing = nodesMap.get(node.id)
        const nodeToStore = {
          ...node,
          selected: undefined,
          dragging: undefined
        }

        if (!existing || JSON.stringify(existing) !== JSON.stringify(nodeToStore)) {
          nodesMap.set(node.id, nodeToStore)
        }
      }
    }, clientId)

    isLocalUpdate = false
  }

  const updateEdges = (newEdges: Edge[]) => {
    baseEdges.set([...newEdges])
    if (!ydoc) return

    isLocalUpdate = true

    const edgesMap = ydoc.getMap("edges")

    ydoc.transact(() => {
      const newIds = new Set(newEdges.map((e) => e.id))

      for (const id of edgesMap.keys()) {
        if (!newIds.has(id)) {
          edgesMap.delete(id)
        }
      }

      for (const edge of newEdges) {
        const existing = edgesMap.get(edge.id)
        const { selected: _, ...edgeToStore } = edge as Edge & { selected?: boolean }

        if (!existing || JSON.stringify(existing) !== JSON.stringify(edgeToStore)) {
          edgesMap.set(edge.id, edgeToStore)
        }
      }
    }, clientId)

    isLocalUpdate = false
  }

  const undo = () => {
    undoManager?.undo()
  }

  const redo = () => {
    undoManager?.redo()
  }

  const updateCursor = (position: { x: number; y: number } | null) => {
    if (!provider?.awareness) return
    provider.awareness.setLocalStateField("cursor", position)
  }

  const updateSelection = (nodeIds: string[]) => {
    if (!provider?.awareness) return
    provider.awareness.setLocalStateField("selection", nodeIds)
  }

  const reconnect = () => {
    provider?.connect()
  }

  const disconnect = () => {
    provider?.disconnect()
  }

  const nodes = {
    subscribe: baseNodes.subscribe,
    set: (value: Node[]) => updateNodes(value),
    update: (fn: (value: Node[]) => Node[]) => updateNodes(fn(get(baseNodes)))
  }

  const edges = {
    subscribe: baseEdges.subscribe,
    set: (value: Edge[]) => updateEdges(value),
    update: (fn: (value: Edge[]) => Edge[]) => updateEdges(fn(get(baseEdges)))
  }

  onMount(() => {
    ydoc = new Y.Doc()

    const nodesMap = ydoc.getMap("nodes")
    const edgesMap = ydoc.getMap("edges")

    const wsUrl = `${serverUrl}/${canvasId}`

    provider = new HocuspocusProvider({
      url: wsUrl,
      name: canvasId,
      document: ydoc,
      token: token ?? "",
      onConnect: () => {
        status.set("connected")
        error.set(undefined)
      },
      onClose: () => {
        status.set("disconnected")
      },
      onSynced: () => {
        syncFromYjs()
      },
      onAuthenticationFailed: ({ reason }) => {
        status.set("error")
        error.set(reason ?? "Authentication failed")
      },
      onStatus: ({ status: providerStatus }) => {
        if (providerStatus === "connecting") {
          status.set("connecting")
        }
      }
    })

    provider.awareness?.setLocalState({
      user: userInfo,
      cursor: null,
      selection: []
    })

    undoManager = new Y.UndoManager([nodesMap, edgesMap], {
      trackedOrigins: new Set([clientId])
    })

    const updateUndoState = () => {
      canUndo.set(undoManager?.canUndo() ?? false)
      canRedo.set(undoManager?.canRedo() ?? false)
    }
    undoManager.on("stack-item-added", updateUndoState)
    undoManager.on("stack-item-popped", updateUndoState)

    const handleRemoteChange = (transaction: Y.Transaction) => {
      if (transaction.origin === clientId || isLocalUpdate) {
        return
      }
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

    const awarenessHandler = () => {
      if (!provider?.awareness) return

      const states = Array.from(provider.awareness.getStates().entries())
      const otherUsers: UserPresence[] = states
        .filter(([clientId]) => clientId !== provider?.awareness?.clientID)
        .map(([, state]) => ({
          id: (state as { user?: { id?: string } }).user?.id ?? "unknown",
          name: (state as { user?: { name?: string } }).user?.name ?? "Anonymous",
          color: (state as { user?: { color?: string } }).user?.color ?? "#888",
          cursor: (state as { cursor?: { x: number; y: number } }).cursor,
          selection: (state as { selection?: string[] }).selection
        }))

      users.set(otherUsers)
    }

    provider.awareness?.on("change", awarenessHandler)

    const cleanup = () => {
      nodesMap.unobserve(observeNodeChanges)
      edgesMap.unobserve(observeEdgeChanges)
      provider?.awareness?.off("change", awarenessHandler)
      undoManager?.destroy()
      provider?.disconnect()
      provider?.destroy()
      ydoc?.destroy()
    }

    onDestroy(cleanup)
  })

  return {
    nodes,
    edges,
    status,
    users,
    error,
    canUndo,
    canRedo,
    updateNodes,
    updateEdges,
    undo,
    redo,
    updateCursor,
    updateSelection,
    reconnect,
    disconnect
  }
}
