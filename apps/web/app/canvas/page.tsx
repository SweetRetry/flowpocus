"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo } from "react"
import { CanvasEditor } from "@/components/canvas/canvas-editor"
import { getMockSession } from "@/lib/auth"

const DEFAULT_CANVAS_ID = "showcase"

/**
 * Generate a random user ID
 */
function generateUserId(): string {
  return `user-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Canvas editor page - open source showcase
 *
 * Each visit generates a new random userId and adds it to the URL.
 * This allows testing multi-user collaboration in different tabs.
 */
export default function CanvasPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const userParam = searchParams.get("user")

  // Redirect to URL with random userId if not present
  useEffect(() => {
    if (!userParam) {
      const newUserId = generateUserId()
      router.replace(`/canvas?user=${newUserId}`)
    }
  }, [userParam, router])

  // Get session based on URL param
  const session = useMemo(() => getMockSession(userParam), [userParam])

  // Don't render until we have a user param
  if (!userParam) {
    return null
  }

  return (
    <div className="h-screen w-screen">
      <CanvasEditor
        canvasId={DEFAULT_CANVAS_ID}
        serverUrl={process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/collaboration"}
        token={session.token}
        user={session.user}
      />
    </div>
  )
}
