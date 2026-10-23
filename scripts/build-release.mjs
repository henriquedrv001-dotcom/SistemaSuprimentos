import { writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "build"],
  { stdio: "inherit", env: { ...process.env, VITE_APP_MODE: "production" } },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
writeFileSync(
  new URL("../dist/release.json", import.meta.url),
  JSON.stringify({ mode: "production", modules: ["catalog", "expiry"] }),
);
