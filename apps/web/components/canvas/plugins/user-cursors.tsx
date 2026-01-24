"use client"

import type { ReactFlowInstance } from "@xyflow/react"
import type { UserPresence } from "@/hooks/collaboration"

interface UserCursorsProps {
  users: UserPresence[]
  reactFlowInstance: ReactFlowInstance | null
}

/**
 * Renders other users' cursors on the canvas
 * Converts flow coordinates to screen coordinates for accurate positioning
 */
export function UserCursors({ users, reactFlowInstance }: UserCursorsProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
      {users
        .filter((user) => user.cursor)
        .map((user) => {
          const cursor = user.cursor
          if (!cursor) return null

          // Convert flow coordinates to screen coordinates
          const screenPos = reactFlowInstance
            ? reactFlowInstance.flowToScreenPosition(cursor)
            : cursor

          return (
            <div
              key={user.id}
              className="absolute transition-transform duration-75"
              style={{
                transform: `translate(${screenPos.x}px, ${screenPos.y}px)`,
              }}
            >
              {/* Cursor pointer */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ color: user.color }}
                aria-hidden="true"
              >
                <path
                  d="M0 0L16 6L9 9L6 16L0 0Z"
                  fill="currentColor"
                  stroke="white"
                  strokeWidth="1"
                />
              </svg>
              {/* User name label */}
              <div
                className="ml-4 mt-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-white shadow-sm"
                style={{ backgroundColor: user.color }}
              >
                {user.name}
              </div>
            </div>
          )
        })}
    </div>
  )
}
