import pg from "pg";
export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString)
    throw new Error("Configure DATABASE_URL somente no servidor.");
  const url = new URL(connectionString);
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    url.hostname,
  );
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:")
    throw new Error("DATABASE_URL deve usar PostgreSQL.");
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  const pool = new pg.Pool({
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true },
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    application_name: "suprimentos-v1",
  });
  pool.on("error", (error) =>
    console.error("Conexão PostgreSQL indisponível.", error.code || "DB_ERROR"),
  );
  return pool;
}
