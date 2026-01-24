"use client"

import { useReactFlow } from "@xyflow/react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useFocusModeActions, useFocusModeState } from "../../hooks/use-focus-mode"
import { FocusContent } from "./focus-content"

function FocusOverlayContent() {
  const focusInfo = useFocusModeState()
  const { exitFocusMode } = useFocusModeActions()
  const { getNode } = useReactFlow()

  const node = useMemo(() => {
    if (!focusInfo) return null
    return getNode(focusInfo.nodeId)
  }, [focusInfo, getNode])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) exitFocusMode()
    },
    [exitFocusMode]
  )

  useEffect(() => {
    if (!focusInfo) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitFocusMode()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [focusInfo, exitFocusMode])

  const shouldRender = focusInfo && node

  return (
    <AnimatePresence>
      {shouldRender && (
        <motion.div
          key="focus-overlay"
          className="fixed inset-0 z-[9999]"
          initial={{ backgroundColor: "rgba(0, 0, 0, 0)" }}
          animate={{ backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
          exit={{ backgroundColor: "rgba(0, 0, 0, 0)" }}
          transition={{ duration: 0.3 }}
          onClick={handleBackdropClick}
        >
          <motion.div
            className="absolute overflow-hidden"
            initial={{
              width: 0,
              height: 0,
              x: focusInfo.startX,
              y: focusInfo.startY,
              translateX: "-50%",
              translateY: "-50%",
              opacity: 1,
            }}
            animate={{
              width: window.innerWidth * 0.8,
              height: window.innerHeight * 0.8,
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
              translateX: "-50%",
              translateY: "-50%",
              opacity: 1,
            }}
            exit={{
              opacity: 0,
              transition: { duration: 0.2 },
            }}
            transition={{
              duration: 0.3,
              ease: "easeOut",
            }}
          >
            <FocusContent />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function FocusOverlay() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return createPortal(<FocusOverlayContent />, document.body)
}
