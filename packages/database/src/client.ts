import { existsSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Resolve database path relative to this package, not CWD
const defaultDbPath = resolve(__dirname, "../data/flowpocus.db")
const DATABASE_URL = process.env.DATABASE_URL ?? defaultDbPath

// Ensure directory exists
const dbDir = dirname(DATABASE_URL)
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true })
}

const sqlite = new Database(DATABASE_URL)

// Enable WAL mode for better concurrent read/write performance
sqlite.pragma("journal_mode = WAL")

export const db = drizzle(sqlite, { schema })

export type DatabaseClient = typeof db
