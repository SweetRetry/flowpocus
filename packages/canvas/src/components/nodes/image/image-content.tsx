"use client"

import { cn } from "../../../lib/utils"

interface ImageContentProps {
  imageUrl?: string
  label?: string
  variant?: "node" | "focus"
}

const EmptyPlaceholder = (
  <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
    No image
  </div>
)

export function ImageContent({ imageUrl, label, variant = "node" }: ImageContentProps) {
  if (!imageUrl) {
    return EmptyPlaceholder
  }

  return (
    <img
      src={imageUrl}
      alt={label ?? "Image"}
      className={cn("h-full w-full", variant === "focus" ? "object-contain" : "object-cover")}
      draggable={false}
    />
  )
}
