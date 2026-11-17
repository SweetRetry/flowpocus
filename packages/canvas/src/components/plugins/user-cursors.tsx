"use client"

import { useViewportStore, ViewportPortal } from "@xyflow/react"
import type { UserPresence } from "../../types/collaboration"
import { PresenceAvatar } from "./presence-avatar"

interface UserCursorsProps {
  users: UserPresence[]
}

/** A person's pointer tracks the mouse; an agent's glides between targets like a hand would. */
const GLIDE: Record<UserPresence["kind"], string> = {
  user: "transform 80ms linear",
  agent: "transform 700ms cubic-bezier(0.45, 0, 0.2, 1)",
}

/**
 * Renders other collaborators' cursors in flow coordinates, so they stay on the
 * same spot of the canvas while the viewport pans and zooms.
 */
export function UserCursors({ users }: UserCursorsProps) {
  const zoom = useViewportStore((state) => state.transform[2])

  return (
    <ViewportPortal>
      {users.map(({ clientId, cursor, color, name, kind, model, avatarUrl, activity }) =>
        cursor ? (
          <div
            key={clientId}
            className="pointer-events-none absolute left-0 top-0 z-50"
            style={{
              transform: `translate(${cursor.x}px, ${cursor.y}px)`,
              transition: GLIDE[kind],
            }}
          >
            {/* Counter-scale so the cursor keeps its screen size at any zoom */}
            <div style={{ transform: `scale(${1 / zoom})`, transformOrigin: "0 0" }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ color }}
                aria-hidden="true"
              >
                <path
                  d="M0 0L16 6L9 9L6 16L0 0Z"
                  fill="currentColor"
                  stroke="white"
                  strokeWidth="1"
                />
              </svg>
              <div
                className="ml-4 mt-1 flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-white text-xs shadow-sm"
                style={{ backgroundColor: color }}
              >
                {kind === "agent" && <PresenceAvatar name={name} color={color} url={avatarUrl} />}
                <span>{name}</span>
                {kind === "agent" && model && model !== name && (
                  <span className="opacity-70">{model}</span>
                )}
                {kind === "agent" && activity && <span>· {activity}</span>}
              </div>
            </div>
          </div>
        ) : null
      )}
    </ViewportPortal>
  )
}
