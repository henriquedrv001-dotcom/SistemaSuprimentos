import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { ApiError } from "./store.mjs";
const scrypt = promisify(scryptCallback);
export const hashToken = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  )
    throw new Error("A senha deve ter entre 12 e 256 caracteres.");
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 3,
    maxmem: 67108864,
  });
  return `scrypt$32768$8$3$${salt}$${hash.toString("hex")}`;
}
async function verifyPassword(password, stored) {
  if (
    typeof password !== "string" ||
    password.length > 256 ||
    typeof stored !== "string"
  )
    return false;
  const [name, n, r, p, salt, expected] = stored.split("$");
  if (
    name !== "scrypt" ||
    n !== "32768" ||
    r !== "8" ||
    p !== "3" ||
    !salt ||
    !expected
  )
    return false;
  const hash = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 3,
    maxmem: 67108864,
  });
  const comparison = Buffer.from(expected, "hex");
  return hash.length === comparison.length && timingSafeEqual(hash, comparison);
}
export async function createUser(
  pool,
  { email, name, password, role = "editor" },
) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 200 ||
    !["admin", "editor", "reader"].includes(role)
  )
    throw new Error("Informe e-mail, nome e perfil válidos.");
  const hash = await hashPassword(password);
  const user = {
    id: randomUUID(),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    role,
  };
  await pool.query(
    "INSERT INTO app_users(id,email,name,password_hash,role) VALUES($1,$2,$3,$4,$5)",
    [user.id, user.email, user.name, hash, role],
  );
  return user;
}
export async function login(pool, email, password, ip) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length > 256
  )
    throw new ApiError(400, "Informe e-mail e senha.");
  const normalized = email.trim().toLowerCase();
  const buckets = [hashToken(`email:${normalized}`), hashToken(`ip:${ip}`)];
  for (const bucket of buckets) {
    const limit = (
      await pool.query(
        "INSERT INTO app_login_limits(bucket,attempts,expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN app_login_limits.expires_at<now() THEN 1 ELSE app_login_limits.attempts+1 END,expires_at=CASE WHEN app_login_limits.expires_at<now() THEN now()+interval '15 minutes' ELSE app_login_limits.expires_at END RETURNING attempts",
        [bucket],
      )
    ).rows[0];
    if (limit.attempts > (bucket === buckets[0] ? 10 : 50))
      throw new ApiError(
        429,
        "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
      );
  }
  const record = (
    await pool.query("SELECT * FROM app_users WHERE email=$1 AND active=true", [
      normalized,
    ])
  ).rows[0];
  // Mesmo custo de derivação para usuários inexistentes, sem revelar e-mails cadastrados.
  const dummy =
    "scrypt$32768$8$3$00000000000000000000000000000000$" + "00".repeat(64);
  const valid = await verifyPassword(password, record?.password_hash || dummy);
  if (!record || !valid) throw new ApiError(401, "E-mail ou senha inválidos.");
  await pool.query("DELETE FROM app_login_limits WHERE bucket=$1", [
    buckets[0],
  ]);
  await pool.query("DELETE FROM app_sessions WHERE expires_at<now()");
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    "INSERT INTO app_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '12 hours')",
    [hashToken(token), record.id],
  );
  return {
    token,
    user: {
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
    },
  };
}
export function tokenFromRequest(req) {
  const entry = (req.headers.cookie || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith("suprimentos_session="));
  return entry?.slice("suprimentos_session=".length);
}
export async function sessionUser(pool, req) {
  const token = tokenFromRequest(req);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return (
    (
      await pool.query(
        "SELECT u.id,u.name,u.email,u.role FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true",
        [hashToken(token)],
      )
    ).rows[0] || null
  );
}
