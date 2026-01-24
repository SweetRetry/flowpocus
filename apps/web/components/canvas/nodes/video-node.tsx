"use client"

import type { Node, NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"
import { memo } from "react"

interface VideoNodeData extends Record<string, unknown> {
  label?: string
  videoUrl?: string
  width?: number
  height?: number
}

/**
 * Video node component for displaying videos
 */
function VideoNodeComponent({ data, selected }: NodeProps<Node<VideoNodeData>>) {
  const width = data.width ?? 320
  const height = data.height ?? 180

  return (
    <div className="relative">
      {data.label && (
        <div className="absolute -top-6 left-0 truncate text-xs text-zinc-600 dark:text-zinc-400">
          {data.label}
        </div>
      )}

      <div
        className={`overflow-hidden rounded-lg border-2 bg-black shadow-md transition-shadow ${
          selected ? "border-blue-500 shadow-lg" : "border-zinc-200"
        }`}
        style={{ width, height }}
      >
        <Handle type="target" position={Position.Left} className="!bg-zinc-400" />

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
          <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-zinc-400">
            No video
          </div>
        )}

        <Handle type="source" position={Position.Right} className="!bg-zinc-400" />
      </div>
    </div>
  )
}

export const VideoNode = memo(VideoNodeComponent)
