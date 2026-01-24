"use client"

import type { Node, NodeProps } from "@xyflow/react"
import { useReactFlow } from "@xyflow/react"
import { memo, useCallback } from "react"
import { BaseNodeWrapper } from "../base-node-wrapper"
import { TextContent } from "./text-content"

interface TextNodeData extends Record<string, unknown> {
  label?: string
  content?: string
}

function TextNodeComponent({ id, data, selected, width, height }: NodeProps<Node<TextNodeData>>) {
  const content = data.content ?? ""
  const { updateNodeData } = useReactFlow()

  const handleContentChange = useCallback(
    (newContent: string) => {
      updateNodeData(id, { content: newContent })
    },
    [id, updateNodeData]
  )

  return (
    <BaseNodeWrapper
      nodeId={id}
      selected={selected}
      label={data.label}
      width={width}
      height={height}
      containerClassName="bg-card"
    >
      <TextContent content={content} onContentChange={handleContentChange} />
    </BaseNodeWrapper>
  )
}

export const TextNode = memo(TextNodeComponent)
