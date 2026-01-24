"use client"

import type { Node, NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"
import { memo } from "react"
import { cn } from "../../lib/utils"

interface VideoNodeData extends Record<string, unknown> {
  label?: string
  videoUrl?: string
}

function VideoNodeComponent({ data, selected, width, height }: NodeProps<Node<VideoNodeData>>) {
  return (
    <div className="relative">
      {data.label && (
        <div className="absolute -top-6 left-0 truncate text-xs text-muted-foreground">
          {data.label}
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-lg border-2 bg-black shadow-canvas-node transition-shadow",
          selected
            ? "border-canvas-node-selected shadow-canvas-node-selected"
            : "border-canvas-node"
        )}
        style={{ width, height }}
      >
        <Handle type="target" position={Position.Left} className="!bg-canvas-handle" />

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

        <Handle type="source" position={Position.Right} className="!bg-canvas-handle" />
      </div>
    </div>
  )
}

export const VideoNode = memo(VideoNodeComponent)
