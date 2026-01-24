"use client"

import { cn } from "../../../lib/utils"

interface VideoContentProps {
  videoUrl?: string
  variant?: "node" | "focus"
}

const EmptyPlaceholder = (
  <div className="flex h-full w-full items-center justify-center bg-secondary text-muted-foreground">
    No video
  </div>
)

export function VideoContent({ videoUrl, variant = "node" }: VideoContentProps) {
  if (!videoUrl) {
    return EmptyPlaceholder
  }

  const isFocus = variant === "focus"

  return (
    <video
      src={videoUrl}
      className={cn(
        "h-full w-full",
        isFocus ? "object-contain" : "object-cover",
        !isFocus && "pointer-events-none"
      )}
      controls={isFocus}
      autoPlay
      muted
      loop
      playsInline
    />
  )
}
