<script lang="ts">
  import {
    Background,
    Controls,
    MiniMap,
    PanOnScrollMode,
    SelectionMode,
    SvelteFlow,
    addEdge,
    useSvelteFlow
  } from "@xyflow/svelte";
  import type { Connection, Node, Edge, NodeTypes } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import { get } from "svelte/store";
  import { createImageNode, createTextNode, createVideoNode } from "../lib";
  import { useKeyboardShortcuts } from "../hooks/use-keyboard-shortcuts";
  import { useYjsCollaboration } from "../hooks/use-yjs-collaboration";
  import { ImageNode, TextNode, VideoNode } from "./nodes";
  import { ConnectionStatusBadge, FocusOverlay, Toolbar, UserCursors } from "./plugins";

  interface Props {
    canvasId: string
    serverUrl: string
    token?: string
    user?: {
      id: string
      name: string
      color?: string
    }
  }

  let { canvasId, serverUrl, token, user }: Props = $props()

  const nodeTypes: NodeTypes = {
    image: ImageNode,
    text: TextNode,
    video: VideoNode
  }

  const getCssVar = (name: string) =>
    typeof document !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      : ""

  const collaboration = useYjsCollaboration(() => ({ serverUrl, canvasId, token, user }))
  const {
    nodes,
    edges,
    status,
    users,
    error,
    canUndo,
    canRedo,
    updateCursor,
    updateSelection,
    undo,
    redo
  } = collaboration

  const { screenToFlowPosition } = useSvelteFlow()

  useKeyboardShortcuts({ onUndo: undo, onRedo: redo })

  const getCenterPosition = () => {
    if (typeof window !== "undefined") {
      return screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2
      })
    }
    return { x: 100 + get(nodes).length * 50, y: 100 + get(nodes).length * 50 }
  }

  const handleAddImageNode = () => {
    const node = createImageNode({
      position: getCenterPosition(),
      label: `Image ${get(nodes).length + 1}`
    })
    nodes.update((current) => [...current, node])
  }

  const handleAddVideoNode = () => {
    const node = createVideoNode({
      position: getCenterPosition(),
      label: `Video ${get(nodes).length + 1}`
    })
    nodes.update((current) => [...current, node])
  }

  const handleAddTextNode = () => {
    const node = createTextNode({
      position: getCenterPosition(),
      label: `Text ${get(nodes).length + 1}`
    })
    nodes.update((current) => [...current, node])
  }

  const handleConnect = (connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `edge-${Date.now()}-${Math.random().toString(36).slice(2)}`
    }
    edges.update((current) => addEdge(newEdge, current))
  }

  const handleSelectionChange = ({ nodes: selectedNodes }: { nodes: Node[] }) => {
    updateSelection(selectedNodes.map((node) => node.id))
  }

  const handleNodeDragStop = ({
    targetNode,
    nodes: draggedNodes
  }: {
    targetNode: Node | null
    nodes: Node[]
    event: MouseEvent | TouchEvent
  }) => {
    nodes.update((current) => {
      return current.map((n) => {
        const updated = draggedNodes.find((d) => d.id === n.id)
        if (updated) {
          return { ...n, position: updated.position }
        }
        return n
      })
    })
  }

  const handleMouseMove = (event: MouseEvent) => {
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const position = screenToFlowPosition({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top
    })
    updateCursor(position)
  }

  const handleMouseLeave = () => {
    updateCursor(null)
  }

  const userList = $derived($users)

  const getNodeColor = (node: Node) => {
    const selectedByOthers = userList.some((u) => u.selection?.includes(node.id))
    return selectedByOthers ? getCssVar("--warning") : getCssVar("--secondary")
  }
</script>

<div
  class="relative h-full w-full"
  onmousemove={handleMouseMove}
  onmouseleave={handleMouseLeave}
  role="application"
>
  <div class="absolute left-4 top-4 z-10">
    <Toolbar
      canUndo={$canUndo}
      canRedo={$canRedo}
      onUndo={undo}
      onRedo={redo}
      onAddImageNode={handleAddImageNode}
      onAddVideoNode={handleAddVideoNode}
      onAddTextNode={handleAddTextNode}
    />
  </div>

  <div class="absolute right-4 top-4 z-10">
    <ConnectionStatusBadge status={$status} userCount={$users.length} error={$error} />
  </div>

  <UserCursors users={$users} />

  <SvelteFlow
    nodes={$nodes}
    edges={$edges}
    {nodeTypes}
    onconnect={handleConnect}
    onselectionchange={handleSelectionChange}
    onnodedragstop={handleNodeDragStop}
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
    <MiniMap nodeColor={getNodeColor} />
  </SvelteFlow>
    <FocusOverlay />

</div>
