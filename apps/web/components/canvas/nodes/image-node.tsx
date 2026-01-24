"use client"

import type { Node, NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"
import { memo } from "react"

interface ImageNodeData extends Record<string, unknown> {
  label?: string
  imageUrl?: string
  width?: number
  height?: number
}

/**
 * Image node component for displaying Unsplash images
 */
function ImageNodeComponent({ data, selected }: NodeProps<Node<ImageNodeData>>) {
  const width = data.width ?? 200
  const height = data.height ?? 150

  return (
    <div className="relative">
      {data.label && (
        <div className="absolute -top-6 left-0 truncate text-xs text-zinc-600 dark:text-zinc-400">
          {data.label}
        </div>
      )}

      <div
        className={`overflow-hidden rounded-lg border-2 bg-white shadow-md transition-shadow ${
          selected ? "border-blue-500 shadow-lg" : "border-zinc-200"
        }`}
        style={{ width, height }}
      >
        <Handle type="target" position={Position.Left} className="!bg-zinc-400" />

        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={data.label ?? "Image"}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-zinc-400">
            No image
          </div>
        )}

        <Handle type="source" position={Position.Right} className="!bg-zinc-400" />
      </div>
    </div>
  )
}

export const ImageNode = memo(ImageNodeComponent)
