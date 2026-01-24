"use client"

import { create } from "zustand"

export interface FocusModeInfo {
  nodeId: string
  /** Animation start position (screen coordinates, center point) */
  startX: number
  startY: number
}

interface FocusModeState {
  focusInfo: FocusModeInfo | null
  enterFocusMode: (info: FocusModeInfo) => void
  exitFocusMode: () => void
}

export const useFocusModeStore = create<FocusModeState>((set) => ({
  focusInfo: null,
  enterFocusMode: (info) => set({ focusInfo: info }),
  exitFocusMode: () => set({ focusInfo: null }),
}))
