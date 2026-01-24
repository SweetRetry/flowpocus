"use client"

import { Handle, NodeResizer, type NodeResizerProps, Position } from "@xyflow/react"
import type { ReactNode } from "react"
import { cn } from "../../lib/utils"

interface ResizeOptions extends Omit<NodeResizerProps, "isVisible"> {
  /** Enable resize functionality */
  enabled?: boolean
}

interface BaseNodeWrapperProps {
  /** Whether the node is currently selected */
  selected: boolean
  /** Optional label displayed above the node */
  label?: string
  /** Width of the node (from NodeProps) */
  width?: number
  /** Height of the node (from NodeProps) */
  height?: number
  /** Additional class names for the container */
  containerClassName?: string
  /** Resize options, pass false to disable resizing */
  resizeOptions?: ResizeOptions | false
  /** The node content */
  children: ReactNode
}

const defaultResizeOptions: ResizeOptions = {
  enabled: true,
  minWidth: 100,
  minHeight: 50,
  lineClassName: "!border-primary",
  handleClassName: "!h-2.5 !w-2.5 !rounded-sm !border-2 !border-primary !bg-background",
}

export function BaseNodeWrapper({
  selected,
  label,
  width,
  height,
  containerClassName,
  resizeOptions = defaultResizeOptions,
  children,
}: BaseNodeWrapperProps) {
  const mergedResizeOptions =
    resizeOptions === false ? null : { ...defaultResizeOptions, ...resizeOptions }

  return (
    <div className="relative h-full w-full">
      {mergedResizeOptions?.enabled && (
        <NodeResizer isVisible={selected} {...mergedResizeOptions} />
      )}

      {label && (
        <div className="absolute -top-6 left-0 truncate text-xs text-muted-foreground">{label}</div>
      )}

      <div
        className={cn(
          "overflow-hidden rounded-lg border-2 shadow-sm transition-shadow",
          selected ? "border-ring shadow-md" : "border-border",
          containerClassName
        )}
        style={{
          width: width ?? "100%",
          height: height ?? "100%",
        }}
      >
        <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />

        {children}

        <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
      </div>
    </div>
  )
}
