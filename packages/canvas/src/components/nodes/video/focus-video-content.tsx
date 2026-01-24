"use client"

import { useReactFlow } from "@xyflow/react"
import { useFocusModeState } from "../../../hooks/use-focus-mode"
import { VideoContent } from "./video-content"

export function FocusVideoContent() {
  const focusInfo = useFocusModeState()
  const { getNode } = useReactFlow()

  const node = focusInfo ? getNode(focusInfo.nodeId) : null

  return <VideoContent videoUrl={node?.data.videoUrl as string} variant="focus" />
}
