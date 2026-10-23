import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError, snapshot, mutate, backupSnapshot } from "./store.mjs";
import { login, sessionUser, tokenFromRequest, hashToken } from "./auth.mjs";
export function createApp({
  pool,
  production = false,
  origin,
  serveStatic = production,
}) {
  if (production && (!origin || new URL(origin).protocol !== "https:"))
    throw new Error("Configure APP_ORIGIN com o endereço HTTPS da aplicação.");
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    res.set("X-Frame-Options", "DENY");
    if (production) {
      res.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
      res.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      );
    }
    next();
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(req.method)) {
      let requestOrigin;
      try {
        requestOrigin = new URL(req.headers.origin);
      } catch {
        throw new ApiError(403, "Origem da requisição inválida.");
      }
      const valid = production
        ? requestOrigin.origin === new URL(origin).origin
        : requestOrigin.host === req.headers.host;
      if (!valid) throw new ApiError(403, "Origem da requisição inválida.");
      if (!req.is("application/json"))
        throw new ApiError(415, "Envie os dados em JSON.");
    }
    next();
  });
  app.use(express.json({ limit: "8mb" }));
  const cookie = (res, token, maxAge = 43200000) =>
    res.cookie("suprimentos_session", token, {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      path: "/",
      maxAge,
    });
  app.get("/api/health", async (req, res) => {
    await pool.query("SELECT 1 FROM app_workspace WHERE id=1");
    res.json({ ok: true });
  });
  app.post("/api/auth/login", async (req, res) => {
    const result = await login(
      pool,
      req.body?.email,
      req.body?.password,
      req.socket.remoteAddress || "unknown",
    );
    cookie(res, result.token);
    res.json({ user: result.user });
  });
  app.get("/api/auth/me", async (req, res) => {
    const user = await sessionUser(pool, req);
    if (!user) throw new ApiError(401, "Entre para acessar o sistema.");
    res.json({ user });
  });
  app.post("/api/auth/logout", async (req, res) => {
    const token = tokenFromRequest(req);
    if (token)
      await pool.query("DELETE FROM app_sessions WHERE token_hash=$1", [
        hashToken(token),
      ]);
    cookie(res, "", 0);
    res.json({ ok: true });
  });
  app.use("/api", async (req, res, next) => {
    const user = await sessionUser(pool, req);
    if (!user) throw new ApiError(401, "Sua sessão expirou. Entre novamente.");
    req.appUser = user;
    next();
  });
  app.get("/api/backup", async (req, res) =>
    res.json(await backupSnapshot(pool)),
  );
  app.get("/api/workspace", async (req, res) => res.json(await snapshot(pool)));
  for (const resource of ["catalog", "expiry"])
    app.post(`/api/${resource}`, async (req, res) => {
      if (!req.body?.command || typeof req.body.command !== "object")
        throw new ApiError(400, "Operação inválida.");
      res.json(
        await mutate(
          pool,
          req.body.revision,
          resource,
          req.body.command,
          req.appUser,
        ),
      );
    });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Rota não disponível." }),
  );
  if (serveStatic) {
    const root = fileURLToPath(new URL("../dist/", import.meta.url));
    app.use(express.static(root, { index: false }));
    app.get(["/", "/login"], (req, res) =>
      res.sendFile(path.join(root, "index.html")),
    );
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    res
      .status(status >= 400 && status < 600 ? status : 500)
      .json({
        error:
          error instanceof ApiError
            ? error.message
            : status === 413
              ? "Arquivo acima do tamanho permitido."
              : status === 400
                ? "Dados inválidos."
                : "Não foi possível concluir a operação. Seus dados não foram substituídos.",
      });
    if (status >= 500)
      console.error("Erro na API", error.code || error.name || "ERROR");
  });
  return app;
}
