<script lang="ts">
  import type { Node, NodeProps } from "@xyflow/svelte"
  import { useSvelteFlow } from "@xyflow/svelte"
  import BaseNodeWrapper from "../base-node-wrapper.svelte"
  import TextContent from "./text-content.svelte"

  interface TextNodeData extends Record<string, unknown> {
    label?: string
    content?: string
  }

  interface Props {
    id: NodeProps<Node<TextNodeData>>["id"]
    data: TextNodeData
    selected?: NodeProps<Node<TextNodeData>>["selected"]
    width?: NodeProps<Node<TextNodeData>>["width"]
    height?: NodeProps<Node<TextNodeData>>["height"]
  }

  let { id, data, selected = false, width, height }: Props = $props()

  const { updateNodeData } = useSvelteFlow()

  const handleContentChange = (newContent: string) => {
    updateNodeData(id, { content: newContent })
  }
</script>

<BaseNodeWrapper
  nodeId={id}
  {selected}
  label={data.label}
  {width}
  {height}
  containerClassName="bg-card"
>
  <TextContent content={data.content ?? ""} onContentChange={handleContentChange} />
</BaseNodeWrapper>
