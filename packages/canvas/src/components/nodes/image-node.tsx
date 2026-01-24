"use client"

import type { Node, NodeProps } from "@xyflow/react"
import { memo } from "react"
import { BaseNodeWrapper } from "./base-node-wrapper"

interface ImageNodeData extends Record<string, unknown> {
  label?: string
  imageUrl?: string
}

function ImageNodeComponent({ data, selected, width, height }: NodeProps<Node<ImageNodeData>>) {
  return (
    <BaseNodeWrapper
      selected={selected}
      label={data.label}
      width={width}
      height={height}
      containerClassName="bg-card"
    >
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
    </BaseNodeWrapper>
  )
}

export const ImageNode = memo(ImageNodeComponent)
