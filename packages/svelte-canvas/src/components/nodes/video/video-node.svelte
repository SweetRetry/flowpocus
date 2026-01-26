<script lang="ts">
  import type { Node, NodeProps } from "@xyflow/svelte"
  import BaseNodeWrapper from "../base-node-wrapper.svelte"
  import VideoContent from "./video-content.svelte"

  interface VideoNodeData extends Record<string, unknown> {
    label?: string
    videoUrl?: string
  }

  interface Props {
    id: NodeProps<Node<VideoNodeData>>["id"]
    data: VideoNodeData
    selected?: NodeProps<Node<VideoNodeData>>["selected"]
    width?: NodeProps<Node<VideoNodeData>>["width"]
    height?: NodeProps<Node<VideoNodeData>>["height"]
  }

  let { id, data, selected = false, width, height }: Props = $props()
</script>

<BaseNodeWrapper
  nodeId={id}
  {selected}
  label={data.label}
  {width}
  {height}
  containerClassName="bg-black"
>
  <VideoContent videoUrl={data.videoUrl} />
</BaseNodeWrapper>
