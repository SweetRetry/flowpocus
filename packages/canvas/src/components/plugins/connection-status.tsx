"use client"

import { cn } from "../../lib/utils"
import type { ConnectionStatus, UserPresence } from "../../types/collaboration"
import { PresenceAvatar } from "./presence-avatar"

/** Avatars shown before the rest collapse into "+n". */
const MAX_AVATARS = 3

type Person = Pick<UserPresence, "name" | "color" | "model" | "avatarUrl">

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus
  /** Everyone on the canvas, the current user first. */
  people: (Person & { key: string | number })[]
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
export function ConnectionStatusBadge({ status, people, error }: ConnectionStatusBadgeProps) {
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

      {status === "connected" && people.length > 1 && (
        <div className="flex items-center -space-x-1.5">
          {people.slice(0, MAX_AVATARS).map(({ key, name, color, model, avatarUrl }) => (
            <span key={key} title={model ? `${name} (${model})` : name}>
              <PresenceAvatar
                name={name}
                color={color}
                url={avatarUrl}
                className="size-6 text-xs ring-background"
              />
            </span>
          ))}
          {people.length > MAX_AVATARS && (
            <span
              title={people
                .slice(MAX_AVATARS)
                .map((person) => person.name)
                .join(", ")}
              className="flex size-6 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-xs ring-2 ring-background"
            >
              +{people.length - MAX_AVATARS}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
