"use client"

import type { Node, NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"
import { memo } from "react"
import Markdown from "react-markdown"
import { cn } from "../../lib/utils"

interface TextNodeData extends Record<string, unknown> {
  label?: string
  content?: string
}

function TextNodeComponent({ data, selected }: NodeProps<Node<TextNodeData>>) {
  const content = data.content ?? ""

  return (
    <div className="relative h-full w-full">
      {data.label && (
        <div className="absolute -top-6 left-0 truncate text-xs text-muted-foreground">
          {data.label}
        </div>
      )}

      <div
        className={cn(
          "h-full w-full overflow-hidden rounded-lg border-2 bg-card shadow-canvas-node transition-shadow",
          selected
            ? "border-canvas-node-selected shadow-canvas-node-selected"
            : "border-canvas-node"
        )}
      >
        <Handle type="target" position={Position.Left} className="!bg-canvas-handle" />

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

        <Handle type="source" position={Position.Right} className="!bg-canvas-handle" />
      </div>
    </div>
  )
}

export const TextNode = memo(TextNodeComponent)
