"use client"

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  type Edge,
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

import { ImageNode, TextNode, VideoNode } from "@workspace/canvas/components/nodes"
import {
  ConnectionStatusBadge,
  FocusOverlay,
  Toolbar,
  UserCursors,
} from "@workspace/canvas/components/plugins"
import { useKeyboardShortcuts } from "@workspace/canvas/hooks"
import { createImageNode, createTextNode, createVideoNode } from "@workspace/canvas/lib"
import { useYjsCollaboration } from "@/hooks/collaboration"

// Custom node types
const nodeTypes: NodeTypes = {
  image: ImageNode,
  text: TextNode,
  video: VideoNode,
}

// Helper to get CSS variable value at runtime
const getCssVar = (name: string) =>
  typeof document !== "undefined"
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : ""

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
      const newEdge: Edge = {
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

  const handleAddTextNode = useCallback(() => {
    const node = createTextNode({
      position: getCenterPosition(),
      label: `Text ${nodes.length + 1}`,
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
          onAddTextNode={handleAddTextNode}
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
            return selectedByOthers ? getCssVar("--warning") : getCssVar("--secondary")
          }}
        />
        <FocusOverlay />
      </ReactFlow>
    </div>
  )
}
