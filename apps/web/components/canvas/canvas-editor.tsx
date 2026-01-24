"use client"

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  PanOnScrollMode,
  ReactFlow,
  type ReactFlowInstance,
  SelectionMode,
} from "@xyflow/react"
import { useCallback, useRef } from "react"
import "@xyflow/react/dist/style.css"

import { useYjsCollaboration } from "@/hooks/collaboration"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { createImageNode, createVideoNode } from "@/lib/node-factory"
import { ImageNode } from "./nodes/image-node"
import { VideoNode } from "./nodes/video-node"
import { ConnectionStatusBadge } from "./plugins/connection-status"
import { Toolbar } from "./plugins/toolbar"
import { UserCursors } from "./plugins/user-cursors"

// Custom node types
const nodeTypes: NodeTypes = {
  image: ImageNode,
  video: VideoNode,
}

// MiniMap theme colors
const MINIMAP_COLORS = {
  selected: "oklch(0.681 0.162 75.834)",
  default: "oklch(0.97 0 0)",
} as const

interface CanvasEditorProps {
  canvasId: string
  serverUrl?: string
  token?: string
  user?: {
    id: string
    name: string
    color?: string
  }
}

/**
 * Collaborative canvas editor with React Flow + Yjs
 */
export function CanvasEditor({
  canvasId,
  serverUrl = "ws://localhost:3001/collaboration",
  token,
  user,
}: CanvasEditorProps) {
  const reactFlowRef = useRef<ReactFlowInstance | null>(null)

  const {
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
  } = useYjsCollaboration({ serverUrl, canvasId, token, user })

  // Keyboard shortcuts
  useKeyboardShortcuts({ onUndo: undo, onRedo: redo })

  // Get center position for new nodes
  const getCenterPosition = useCallback(() => {
    if (reactFlowRef.current) {
      return reactFlowRef.current.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      })
    }
    return { x: 100 + nodes.length * 50, y: 100 + nodes.length * 50 }
  }, [nodes.length])

  // Node change handlers
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => updateNodes(applyNodeChanges(changes, nodes)),
    [nodes, updateNodes]
  )

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => updateEdges(applyEdgeChanges(changes, edges)),
    [edges, updateEdges]
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      const newEdge = {
        ...connection,
        id: `edge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }
      updateEdges(addEdge(newEdge, edges))
    },
    [edges, updateEdges]
  )

  // Selection and cursor handlers
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      updateSelection(selectedNodes.map((n) => n.id))
    },
    [updateSelection]
  )

  const onMouseMove = useCallback(
    (event: React.MouseEvent) => {
      if (!reactFlowRef.current) return
      const bounds = event.currentTarget.getBoundingClientRect()
      const position = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })
      updateCursor(position)
    },
    [updateCursor]
  )

  const onMouseLeave = useCallback(() => updateCursor(null), [updateCursor])

  // Add node handlers
  const handleAddImageNode = useCallback(() => {
    const node = createImageNode({
      position: getCenterPosition(),
      label: `Image ${nodes.length + 1}`,
    })
    updateNodes([...nodes, node])
  }, [nodes, updateNodes, getCenterPosition])

  const handleAddVideoNode = useCallback(() => {
    const node = createVideoNode({
      position: getCenterPosition(),
      label: `Video ${nodes.length + 1}`,
    })
    updateNodes([...nodes, node])
  }, [nodes, updateNodes, getCenterPosition])

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-4 top-4 z-10">
        <Toolbar
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
          onAddImageNode={handleAddImageNode}
          onAddVideoNode={handleAddVideoNode}
        />
      </div>

      <div className="absolute right-4 top-4 z-10">
        <ConnectionStatusBadge status={status} userCount={users.length} error={error} />
      </div>

      <UserCursors users={users} reactFlowInstance={reactFlowRef.current} />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onInit={(instance) => {
          reactFlowRef.current = instance
        }}
        fitView
        proOptions={{ hideAttribution: true }}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const selectedByOthers = users.some((u) => u.selection?.includes(node.id))
            return selectedByOthers ? MINIMAP_COLORS.selected : MINIMAP_COLORS.default
          }}
        />
      </ReactFlow>
    </div>
  )
}
