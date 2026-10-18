import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { defineConfig } from "drizzle-kit"

const url = process.env.DATABASE_URL ?? "./data/flowpocus.db"

// better-sqlite3 will not create the directory; a fresh clone has no data/ yet.
mkdirSync(dirname(url), { recursive: true })

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url },
})
