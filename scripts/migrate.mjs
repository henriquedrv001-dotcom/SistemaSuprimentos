import { readdir, readFile } from "node:fs/promises";
import { createPool } from "../server/db.mjs";
export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7241001)");
    await client.query(
      "CREATE TABLE IF NOT EXISTS app_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const files = (
      await readdir(new URL("../server/migrations/", import.meta.url))
    )
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const name of files)
      if (
        !(
          await client.query("SELECT 1 FROM app_migrations WHERE name=$1", [
            name,
          ])
        ).rowCount
      ) {
        await client.query(
          await readFile(
            new URL(`../server/migrations/${name}`, import.meta.url),
            "utf8",
          ),
        );
        await client.query("INSERT INTO app_migrations(name) VALUES($1)", [
          name,
        ]);
      }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  const pool = createPool();
  try {
    await migrate(pool);
    console.log("Migrações aplicadas.");
  } finally {
    await pool.end();
  }
}
