"use client"

import { useState } from "react"
import { cn } from "../../lib/utils"

interface PresenceAvatarProps {
  name: string
  color: string
  /** Image the collaborator claims as their avatar; the initial shows when it is absent or fails. */
  url?: string
  className?: string
}

/** A collaborator's avatar, shared by the cursor label and the header stack. */
export function PresenceAvatar({ name, color, url, className }: PresenceAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string>()
  const base = "size-4 shrink-0 rounded-full ring-2 ring-white"

  return url && url !== failedUrl ? (
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailedUrl(url)}
      className={cn(base, "bg-white object-cover", className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        base,
        "flex items-center justify-center font-semibold text-[10px] text-white leading-none",
        className
      )}
      style={{ backgroundColor: color }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}
