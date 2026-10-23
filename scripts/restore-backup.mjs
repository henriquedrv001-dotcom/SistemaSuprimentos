import { readFile } from "node:fs/promises";
import { createPool } from "../server/db.mjs";
import { restoreBackup } from "../server/backup.mjs";
const [file, email] = process.argv.slice(2);
if (!file || !email)
  throw new Error(
    "Uso: npm run db:restore -- arquivo.json email-do-administrador",
  );
const pool = createPool();
try {
  const actor = (
    await pool.query(
      "SELECT id,name FROM app_users WHERE email=$1 AND role='admin' AND active=true",
      [email.trim().toLowerCase()],
    )
  ).rows[0];
  if (!actor)
    throw new Error("Administrador ativo não encontrado neste banco.");
  await restoreBackup(pool, JSON.parse(await readFile(file, "utf8")), actor);
  console.log("Backup restaurado no banco vazio.");
} finally {
  await pool.end();
}
