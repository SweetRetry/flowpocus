import { enterFocusMode, exitFocusMode, focusInfo } from "../stores/focus-mode-store"

/** Node components use this - only access actions */
export function useFocusModeActions() {
  return { enterFocusMode, exitFocusMode }
}

/** FocusOverlay uses this - subscribes to focus info (nodeId + animation position) */
export function useFocusModeState() {
  return focusInfo
}
