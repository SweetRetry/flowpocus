/**
 * Authentication module
 *
 * Production architecture with development mock support.
 * In production, integrate with your auth provider (Supabase, Auth0, Clerk, etc.)
 *
 * Development usage:
 *   /canvas/xxx              → Auto-generated user (persisted in localStorage)
 *   /canvas/xxx?user=alice   → Mock user "alice" (for multi-user testing)
 *   /canvas/xxx?user=bob     → Mock user "bob" (open in another tab)
 */

export interface User {
  id: string
  name: string
  email?: string
  avatarUrl?: string
}

export interface AuthSession {
  user: User
  token: string
}

// ============================================================================
// Production Auth Interface (implement when integrating real auth)
// ============================================================================

/**
 * Get current authenticated session
 * TODO: Replace with real auth provider integration
 *
 * @example Supabase integration:
 * ```ts
 * export async function getSession(): Promise<AuthSession | null> {
 *   const { data: { session } } = await supabase.auth.getSession()
 *   if (!session) return null
 *   return {
 *     user: {
 *       id: session.user.id,
 *       name: session.user.user_metadata.name,
 *       email: session.user.email,
 *     },
 *     token: session.access_token,
 *   }
 * }
 * ```
 */
export async function getSession(): Promise<AuthSession | null> {
  // In production, this would check for a real session
  // For now, return null to trigger mock user flow
  return null
}

// ============================================================================
// Development Mock Users
// ============================================================================

/**
 * Predefined mock users for development/testing
 * Each has a stable ID and distinct color for easy identification
 */
const MOCK_USERS: Record<string, User & { color: string }> = {
  alice: {
    id: "mock-alice-001",
    name: "Alice",
    email: "alice@example.com",
    color: "hsl(210, 70%, 50%)", // Blue
  },
  bob: {
    id: "mock-bob-002",
    name: "Bob",
    email: "bob@example.com",
    color: "hsl(140, 70%, 40%)", // Green
  },
  charlie: {
    id: "mock-charlie-003",
    name: "Charlie",
    email: "charlie@example.com",
    color: "hsl(280, 70%, 50%)", // Purple
  },
  diana: {
    id: "mock-diana-004",
    name: "Diana",
    email: "diana@example.com",
    color: "hsl(20, 70%, 50%)", // Orange
  },
}

const ANONYMOUS_STORAGE_KEY = "flowpocus_anonymous_user"

interface AnonymousUser extends User {
  color: string
}

/**
 * Generate stable color from string (for anonymous users)
 */
function hashStringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 50%)`
}

/**
 * Generate unique anonymous user ID
 */
function generateAnonymousId(): string {
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Generate random anonymous name
 */
function generateAnonymousName(): string {
  const adjectives = ["Happy", "Swift", "Clever", "Bright", "Calm", "Bold", "Quick", "Wise"]
  const nouns = ["Panda", "Eagle", "Fox", "Wolf", "Bear", "Owl", "Tiger", "Hawk"]
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj} ${noun}`
}

/**
 * Get or create anonymous user from localStorage
 */
function getAnonymousUser(): AnonymousUser {
  if (typeof window === "undefined") {
    const id = generateAnonymousId()
    return {
      id,
      name: generateAnonymousName(),
      color: hashStringToColor(id),
    }
  }

  try {
    const stored = localStorage.getItem(ANONYMOUS_STORAGE_KEY)
    if (stored) {
      const user = JSON.parse(stored) as AnonymousUser
      if (user.id && user.name && user.color) {
        return user
      }
    }
  } catch {
    // Invalid data, create new
  }

  const id = generateAnonymousId()
  const user: AnonymousUser = {
    id,
    name: generateAnonymousName(),
    color: hashStringToColor(id),
  }

  try {
    localStorage.setItem(ANONYMOUS_STORAGE_KEY, JSON.stringify(user))
  } catch {
    // Storage unavailable
  }

  return user
}

// ============================================================================
// Mock Session Resolution
// ============================================================================

export interface MockSession {
  user: User & { color: string }
  token: string
}

/**
 * Get mock session for development
 *
 * @param mockUserParam - URL parameter value (e.g., "alice", "bob")
 * @returns Mock session with user and token
 *
 * @example
 * ```ts
 * // In page component:
 * const searchParams = useSearchParams()
 * const mockUser = searchParams.get("user")
 * const session = getMockSession(mockUser)
 * ```
 */
export function getMockSession(mockUserParam?: string | null): MockSession {
  let user: User & { color: string }

  const normalizedParam = mockUserParam?.toLowerCase()
  if (normalizedParam && MOCK_USERS[normalizedParam]) {
    // Use predefined mock user
    user = MOCK_USERS[normalizedParam]
  } else if (mockUserParam) {
    // Custom mock user name provided
    const id = `mock-${mockUserParam.toLowerCase()}-${mockUserParam.length}`
    user = {
      id,
      name: mockUserParam,
      color: hashStringToColor(mockUserParam),
    }
  } else {
    // No mock param, use anonymous user
    user = getAnonymousUser()
  }

  // Generate mock JWT-like token for development
  // Format: mock.<base64-payload>.<signature-placeholder>
  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400, // 24h
  }

  const encodedPayload = btoa(JSON.stringify(payload))
  const token = `mock.${encodedPayload}.dev-signature`

  return { user, token }
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development"
}
