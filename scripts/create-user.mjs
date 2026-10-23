import { stdin, stdout } from "node:process";
import { createPool } from "../server/db.mjs";
import { createUser, hashPassword } from "../server/auth.mjs";
const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((value, i, list) =>
      value.startsWith("--") ? [value.slice(2), list[i + 1]] : null,
    )
    .filter(Boolean),
);
const pool = createPool();
try {
  let password = process.env.BOOTSTRAP_PASSWORD;
  if (!password) {
    if (!stdin.isTTY)
      throw new Error(
        "Informe BOOTSTRAP_PASSWORD por variável secreta ou execute em um terminal interativo.",
      );
    stdout.write("Senha (mínimo 12 caracteres): ");
    stdin.setRawMode(true);
    stdin.resume();
    password = await new Promise((resolve, reject) => {
      let input = "";
      const read = (chunk) => {
        for (const ch of chunk.toString()) {
          if (ch === "\r" || ch === "\n") {
            stdin.off("data", read);
            stdin.setRawMode(false);
            stdin.pause();
            stdout.write("\n");
            resolve(input);
            return;
          }
          if (ch === "\u0003") {
            stdin.off("data", read);
            stdin.setRawMode(false);
            stdin.pause();
            reject(new Error("Cancelado."));
            return;
          }
          if (ch === "\u007f") input = input.slice(0, -1);
          else input += ch;
        }
      };
      stdin.on("data", read);
    });
  }
  if ("reset-password" in args) {
    const hashed = await hashPassword(password);
    const result = await pool.query(
      "UPDATE app_users SET password_hash=$1 WHERE email=$2 RETURNING id",
      [hashed, args.email?.trim().toLowerCase()],
    );
    if (!result.rowCount) throw new Error("Usuário não encontrado.");
    await pool.query("DELETE FROM app_sessions WHERE user_id=$1", [
      result.rows[0].id,
    ]);
    console.log("Senha redefinida e sessões anteriores encerradas.");
  } else {
    const user = await createUser(pool, {
      email: args.email,
      name: args.name,
      password,
      role: args.role || "editor",
    });
    console.log(`Usuário autorizado criado: ${user.email} (${user.role}).`);
  }
} catch (error) {
  console.error(
    error.code === "23505" ? "Este e-mail já está autorizado." : error.message,
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
