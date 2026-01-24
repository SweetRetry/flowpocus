"use client"

import type { Node, NodeProps } from "@xyflow/react"
import { memo } from "react"
import Markdown from "react-markdown"
import { BaseNodeWrapper } from "./base-node-wrapper"

interface TextNodeData extends Record<string, unknown> {
  label?: string
  content?: string
}

function TextNodeComponent({ data, selected, width, height }: NodeProps<Node<TextNodeData>>) {
  const content = data.content ?? ""

  return (
    <BaseNodeWrapper
      selected={selected}
      label={data.label}
      width={width}
      height={height}
      containerClassName="bg-card"
    >
      <div className="prose prose-sm dark:prose-invert h-full w-full max-w-none overflow-auto p-3 text-foreground">
        <Markdown
          components={{
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-primary underline hover:no-underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
          }}
        >
          {content || "_Empty_"}
        </Markdown>
      </div>
    </BaseNodeWrapper>
  )
}

export const TextNode = memo(TextNodeComponent)
