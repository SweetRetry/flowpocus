<script lang="ts">
  import type { Node, NodeProps } from "@xyflow/svelte"
  import BaseNodeWrapper from "../base-node-wrapper.svelte"
  import ImageContent from "./image-content.svelte"

  interface Props {
    id: NodeProps<Node>["id"]
    data: { label?: string; imageUrl?: string }
    selected?: NodeProps<Node>["selected"]
    width?: NodeProps<Node>["width"]
    height?: NodeProps<Node>["height"]
  }

  let { id, data, selected = false, width, height }: Props = $props()
</script>

<BaseNodeWrapper
  nodeId={id}
  {selected}
  label={data.label}
  {width}
  {height}
  containerClassName="bg-card"
>
  <ImageContent imageUrl={data.imageUrl} label={data.label} />
</BaseNodeWrapper>
