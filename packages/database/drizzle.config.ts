import { defineConfig } from "drizzle-kit"
import { defaultDatabaseUrl } from "./src/client.ts"

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? defaultDatabaseUrl },
})
