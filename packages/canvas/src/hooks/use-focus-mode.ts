"use client"

import { useFocusModeStore } from "../stores/focus-mode-store"

/** Node components use this - only subscribes to actions, no re-renders on state change */
export function useFocusModeActions() {
  const enterFocusMode = useFocusModeStore((s) => s.enterFocusMode)
  const exitFocusMode = useFocusModeStore((s) => s.exitFocusMode)
  return { enterFocusMode, exitFocusMode }
}

/** FocusOverlay uses this - subscribes to focus info (nodeId + animation position) */
export function useFocusModeState() {
  return useFocusModeStore((s) => s.focusInfo)
}
