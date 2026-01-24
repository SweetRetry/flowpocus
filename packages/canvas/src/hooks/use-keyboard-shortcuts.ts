"use client"

import { useEffect } from "react"

export interface KeyboardShortcutsOptions {
  onUndo?: () => void
  onRedo?: () => void
}

/**
 * Hook for canvas keyboard shortcuts
 * - Ctrl/Cmd + Z: Undo
 * - Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
 */
export function useKeyboardShortcuts({ onUndo, onRedo }: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.ctrlKey || event.metaKey

      // Undo: Ctrl/Cmd + Z
      if (isMod && event.key === "z" && !event.shiftKey) {
        event.preventDefault()
        onUndo?.()
        return
      }

      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if ((isMod && event.shiftKey && event.key === "z") || (isMod && event.key === "y")) {
        event.preventDefault()
        onRedo?.()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onUndo, onRedo])
}
