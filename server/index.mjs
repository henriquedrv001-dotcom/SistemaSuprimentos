import { readFile } from "node:fs/promises";
import { createPool } from "./db.mjs";
import { createApp } from "./app.mjs";
const pool = createPool();
const production = process.env.NODE_ENV === "production";
if (production) {
  const marker = JSON.parse(
    await readFile(
      new URL("../dist/release.json", import.meta.url),
      "utf8",
    ).catch(() => {
      throw new Error(
        "Use npm run build:release antes de iniciar em produção.",
      );
    }),
  );
  if (marker.mode !== "production")
    throw new Error("Build de produção inválido.");
}
const app = createApp({ pool, production, origin: process.env.APP_ORIGIN });
const server = app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log("API de Suprimentos iniciada."),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
