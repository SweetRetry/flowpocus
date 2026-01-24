"use client"

import { useReactFlow } from "@xyflow/react"
import { useCallback } from "react"
import { useFocusModeState } from "../../../hooks/use-focus-mode"
import { TextContent } from "./text-content"

export function FocusTextContent() {
  const focusInfo = useFocusModeState()
  const { getNode, updateNodeData } = useReactFlow()

  const node = focusInfo ? getNode(focusInfo.nodeId) : null
  const content = (node?.data.content as string) ?? ""

  const handleContentChange = useCallback(
    (newContent: string) => {
      if (focusInfo) {
        updateNodeData(focusInfo.nodeId, { content: newContent })
      }
    },
    [focusInfo, updateNodeData]
  )

  return <TextContent content={content} onContentChange={handleContentChange} variant="focus" />
}
