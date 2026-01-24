"use client"

import type { Node, NodeProps } from "@xyflow/react"
import { memo } from "react"
import { BaseNodeWrapper } from "../base-node-wrapper"
import { ImageContent } from "./image-content"

interface ImageNodeData extends Record<string, unknown> {
  label?: string
  imageUrl?: string
}

function ImageNodeComponent({ id, data, selected, width, height }: NodeProps<Node<ImageNodeData>>) {
  return (
    <BaseNodeWrapper
      nodeId={id}
      selected={selected}
      label={data.label}
      width={width}
      height={height}
      containerClassName="bg-card"
    >
      <ImageContent imageUrl={data.imageUrl} label={data.label} />
    </BaseNodeWrapper>
  )
}

export const ImageNode = memo(ImageNodeComponent)
