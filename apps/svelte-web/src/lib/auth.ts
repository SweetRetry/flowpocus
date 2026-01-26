/**
 * Authentication module (Svelte)
 * Mirrors apps/web/lib/auth.ts behavior for mock sessions.
 */

export interface User {
  id: string
  name: string
  email?: string
  avatarUrl?: string
}

export interface MockSession {
  user: User & { color: string }
  token: string
}

const MOCK_USERS: Record<string, User & { color: string }> = {
  alice: {
    id: "mock-alice-001",
    name: "Alice",
    email: "alice@example.com",
    color: "hsl(210, 70%, 50%)"
  },
  bob: {
    id: "mock-bob-002",
    name: "Bob",
    email: "bob@example.com",
    color: "hsl(140, 70%, 40%)"
  },
  charlie: {
    id: "mock-charlie-003",
    name: "Charlie",
    email: "charlie@example.com",
    color: "hsl(280, 70%, 50%)"
  },
  diana: {
    id: "mock-diana-004",
    name: "Diana",
    email: "diana@example.com",
    color: "hsl(20, 70%, 50%)"
  }
}

const ANONYMOUS_STORAGE_KEY = "flowpocus_anonymous_user"

interface AnonymousUser extends User {
  color: string
}

function hashStringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 50%)`
}

function generateAnonymousId(): string {
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function generateAnonymousName(): string {
  const adjectives = ["Happy", "Swift", "Clever", "Bright", "Calm", "Bold", "Quick", "Wise"]
  const nouns = ["Panda", "Eagle", "Fox", "Wolf", "Bear", "Owl", "Tiger", "Hawk"]
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj} ${noun}`
}

function getAnonymousUser(): AnonymousUser {
  if (typeof window === "undefined") {
    const id = generateAnonymousId()
    return {
      id,
      name: generateAnonymousName(),
      color: hashStringToColor(id)
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
    color: hashStringToColor(id)
  }

  try {
    localStorage.setItem(ANONYMOUS_STORAGE_KEY, JSON.stringify(user))
  } catch {
    // Storage unavailable
  }

  return user
}

export function getMockSession(mockUserParam?: string | null): MockSession {
  let user: User & { color: string }

  const normalizedParam = mockUserParam?.toLowerCase()
  if (normalizedParam && MOCK_USERS[normalizedParam]) {
    user = MOCK_USERS[normalizedParam]
  } else if (mockUserParam) {
    const id = `mock-${mockUserParam.toLowerCase()}-${mockUserParam.length}`
    user = {
      id,
      name: mockUserParam,
      color: hashStringToColor(mockUserParam)
    }
  } else {
    user = getAnonymousUser()
  }

  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400
  }

  const encodedPayload = btoa(JSON.stringify(payload))
  const token = `mock.${encodedPayload}.dev-signature`

  return { user, token }
}
