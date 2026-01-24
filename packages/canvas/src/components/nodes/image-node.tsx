"use client"

import type { Node, NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"
import { memo } from "react"
import { cn } from "../../lib/utils"

interface ImageNodeData extends Record<string, unknown> {
  label?: string
  imageUrl?: string
  width?: number
  height?: number
}

function ImageNodeComponent({ data, selected }: NodeProps<Node<ImageNodeData>>) {
  const width = data.width ?? 200
  const height = data.height ?? 150

  return (
    <div className="relative">
      {data.label && (
        <div className="absolute -top-6 left-0 truncate text-xs text-muted-foreground">
          {data.label}
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-lg border-2 bg-card shadow-canvas-node transition-shadow",
          selected
            ? "border-canvas-node-selected shadow-canvas-node-selected"
            : "border-canvas-node"
        )}
        style={{ width, height }}
      >
        <Handle type="target" position={Position.Left} className="!bg-canvas-handle" />

        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={data.label ?? "Image"}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            No image
          </div>
        )}

        <Handle type="source" position={Position.Right} className="!bg-canvas-handle" />
      </div>
    </div>
  )
}

export const ImageNode = memo(ImageNodeComponent)
