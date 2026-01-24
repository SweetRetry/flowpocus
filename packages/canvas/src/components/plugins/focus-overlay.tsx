"use client"

import { useReactFlow } from "@xyflow/react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import Markdown from "react-markdown"
import { useFocusModeActions, useFocusModeState } from "../../hooks/use-focus-mode"

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-40 w-60 items-center justify-center bg-muted text-muted-foreground">
      {children}
    </div>
  )
}

interface FocusContentProps {
  type: string
  data: Record<string, unknown>
}

function FocusContent({ type, data }: FocusContentProps) {
  switch (type) {
    case "image":
      return data.imageUrl ? (
        <img
          src={data.imageUrl as string}
          alt={(data.label as string) ?? "Image"}
          className="h-full w-full object-contain"
          draggable={false}
        />
      ) : (
        <Placeholder>No image</Placeholder>
      )

    case "video":
      return data.videoUrl ? (
        <video
          src={data.videoUrl as string}
          className="h-full w-full object-contain"
          controls
          autoPlay
          muted
          loop
          playsInline
        />
      ) : (
        <Placeholder>No video</Placeholder>
      )

    case "text":
      return (
        <div className="prose prose-sm dark:prose-invert h-full w-full max-w-none overflow-auto p-6 text-foreground bg-card">
          <Markdown
            components={{
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-primary underline hover:no-underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
            }}
          >
            {(data.content as string) || "_Empty_"}
          </Markdown>
        </div>
      )

    default:
      return <Placeholder>Unsupported node type</Placeholder>
  }
}

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
            <FocusContent type={node.type ?? "unknown"} data={node.data as Record<string, unknown>} />
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
