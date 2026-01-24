"use client"

import { cn } from "../../lib/utils"
import type { ConnectionStatus } from "../../types/collaboration"

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus
  userCount: number
  error?: string
}

const statusConfig: Record<
  ConnectionStatus,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  disconnected: {
    label: "Offline",
    badgeClassName: "bg-muted text-muted-foreground",
    dotClassName: "bg-muted-foreground",
  },
  connecting: {
    label: "Connecting...",
    badgeClassName: "bg-warning/15 text-warning-foreground dark:text-warning",
    dotClassName: "animate-pulse bg-warning",
  },
  connected: {
    label: "Connected",
    badgeClassName: "bg-success/15 text-success-foreground dark:text-success",
    dotClassName: "bg-success",
  },
  error: {
    label: "Error",
    badgeClassName: "bg-destructive/15 text-destructive",
    dotClassName: "bg-destructive",
  },
}

/**
 * Shows collaboration connection status
 */
export function ConnectionStatusBadge({ status, userCount, error }: ConnectionStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          config.badgeClassName
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", config.dotClassName)} />
        {config.label}
        {error && <span className="ml-1 text-xs opacity-75">({error})</span>}
      </div>

      {status === "connected" && userCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{userCount + 1}</span>
        </div>
      )}
    </div>
  )
}
