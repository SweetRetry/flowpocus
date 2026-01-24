"use client"

import { useReactFlow } from "@xyflow/react"
import { useFocusModeState } from "../../hooks/use-focus-mode"
import { FocusImageContent } from "../nodes/image"
import { FocusTextContent } from "../nodes/text"
import { FocusVideoContent } from "../nodes/video"

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
      {children}
    </div>
  )
}

export function FocusContent() {
  const focusInfo = useFocusModeState()
  const { getNode } = useReactFlow()

  const node = focusInfo ? getNode(focusInfo.nodeId) : null

  if (!node) return <Placeholder>No content</Placeholder>

  switch (node.type) {
    case "text":
      return <FocusTextContent />
    case "image":
      return <FocusImageContent />
    case "video":
      return <FocusVideoContent />
    default:
      return <Placeholder>Unsupported node type</Placeholder>
  }
}
