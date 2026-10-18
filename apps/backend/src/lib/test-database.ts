import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

/**
 * Point @workspace/database at a fresh, migrated schema of DATABASE_URL, so
 * test files run in parallel without sharing rows. Call it before the first
 * query (node-postgres reads PGOPTIONS per connection), and call `drop` when
 * the file is done.
 */
export async function useTestDatabase() {
  const schema = `test_${randomUUID().replaceAll("-", "")}`
  // node-postgres sends PGOPTIONS on every pooled connection
  process.env.PGOPTIONS = `-c search_path=${schema}`
  const { db, migrationsFolder } = await import("@workspace/database")

  await db.execute(sql.raw(`CREATE SCHEMA "${schema}"`))
  await migrate(db, { migrationsFolder, migrationsSchema: schema })

  return {
    db,
    async drop() {
      await db.execute(sql.raw(`DROP SCHEMA "${schema}" CASCADE`))
      await db.$client.end()
    },
  }
}
