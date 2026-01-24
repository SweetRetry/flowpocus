"use client"

import type { Node, NodeProps } from "@xyflow/react"
import { memo } from "react"
import { BaseNodeWrapper } from "./base-node-wrapper"

interface VideoNodeData extends Record<string, unknown> {
  label?: string
  videoUrl?: string
}

function VideoNodeComponent({ data, selected, width, height }: NodeProps<Node<VideoNodeData>>) {
  return (
    <BaseNodeWrapper
      selected={selected}
      label={data.label}
      width={width}
      height={height}
      containerClassName="bg-black"
    >
      {data.videoUrl ? (
        <video
          src={data.videoUrl}
          className="h-full w-full object-cover"
          controls
          muted
          loop
          playsInline
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-secondary text-muted-foreground">
          No video
        </div>
      )}
    </BaseNodeWrapper>
  )
}

export const VideoNode = memo(VideoNodeComponent)
