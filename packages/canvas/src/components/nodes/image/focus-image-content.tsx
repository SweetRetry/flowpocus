"use client"

import { useReactFlow } from "@xyflow/react"
import { useFocusModeState } from "../../../hooks/use-focus-mode"
import { ImageContent } from "./image-content"

export function FocusImageContent() {
  const focusInfo = useFocusModeState()
  const { getNode } = useReactFlow()

  const node = focusInfo ? getNode(focusInfo.nodeId) : null

  return (
    <ImageContent
      imageUrl={node?.data.imageUrl as string}
      label={node?.data.label as string}
      variant="focus"
    />
  )
}
