/**
 * Color utilities for user presence and theming
 */

const USER_COLORS = [
  "#f87171", // red
  "#fb923c", // orange
  "#fbbf24", // amber
  "#a3e635", // lime
  "#34d399", // emerald
  "#22d3ee", // cyan
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#f472b6", // pink
] as const

/**
 * Generate stable color from string (for consistent user colors)
 */
export function hashStringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 50%)`
}

/**
 * Get random color from predefined palette
 */
export function getRandomUserColor(): string {
  const index = Math.floor(Math.random() * USER_COLORS.length)
  return USER_COLORS[index] ?? "#888888"
}
