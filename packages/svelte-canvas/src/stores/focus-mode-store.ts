import { writable } from "svelte/store"

export interface FocusModeInfo {
  nodeId: string
  /** Animation start position (screen coordinates, center point) */
  startX: number
  startY: number
}

export const focusInfo = writable<FocusModeInfo | null>(null)

export function enterFocusMode(info: FocusModeInfo) {
  focusInfo.set(info)
}

export function exitFocusMode() {
  focusInfo.set(null)
}
