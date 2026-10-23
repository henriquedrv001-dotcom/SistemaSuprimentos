import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPool } from "../server/db.mjs";
import { createApp } from "../server/app.mjs";
import { migrate } from "../scripts/migrate.mjs";
import { createUser } from "../server/auth.mjs";
import { restoreBackup } from "../server/backup.mjs";
const connection = process.env.TEST_DATABASE_URL;
test(
  "API PostgreSQL: autenticação, perfis, persistência, concorrência, atomicidade e histórico",
  { skip: !connection },
  async () => {
    const pool = createPool(connection);
    await migrate(pool);
    const suffix = randomUUID();
    const editor = await createUser(pool, {
      email: `editor-${suffix}@test.invalid`,
      name: "Operador de teste",
      password: "Senha de teste 123!",
      role: "editor",
    });
    await createUser(pool, {
      email: `reader-${suffix}@test.invalid`,
      name: "Consulta",
      password: "Senha de teste 123!",
      role: "reader",
    });
    const app = createApp({ pool });
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (
      path,
      { method = "GET", body, cookie, origin = base } = {},
    ) => {
      const response = await fetch(base + path, {
        method,
        headers: {
          Origin: origin,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { response, body: await response.json() };
    };
    try {
      assert.equal((await request("/api/workspace")).response.status, 401);
      assert.equal(
        (
          await request("/api/auth/login", {
            method: "POST",
            origin: "https://evil.invalid",
            body: { email: editor.email, password: "Senha de teste 123!" },
          })
        ).response.status,
        403,
      );
      assert.equal(
        (
          await request("/api/auth/login", {
            method: "POST",
            body: { email: editor.email, password: "wrong" },
          })
        ).response.status,
        401,
      );
      const signed = await request("/api/auth/login", {
        method: "POST",
        body: { email: editor.email, password: "Senha de teste 123!" },
      });
      assert.equal(signed.response.status, 200);
      assert.ok(signed.response.headers.get("set-cookie").includes("HttpOnly"));
      assert.ok(
        signed.response.headers.get("set-cookie").includes("SameSite=Strict"),
      );
      const cookie = signed.response.headers.get("set-cookie").split(";")[0];
      let state = (await request("/api/workspace", { cookie })).body;
      const item = {
        id: `item-${suffix}`,
        code: `ES1306-${suffix}`,
        description: "BEBIDA DE TESTE",
        unit: "UN",
        type: "GÊNEROS ALIMENTÍCIOS",
        group: "BEBIDAS NAO ALCOOLICAS",
        criterion: "Mensal",
        active: true,
        visible: true,
      };
      const created = await request("/api/catalog", {
        method: "POST",
        cookie,
        body: {
          revision: state.revision,
          command: { kind: "create", items: [item] },
        },
      });
      assert.equal(created.response.status, 200);
      state = created.body;
      assert.ok(state.items.some((row) => row.id === item.id));
      assert.equal(state.history[0].actor, editor.name);
      const stale = await request("/api/catalog", {
        method: "POST",
        cookie,
        body: {
          revision: "0",
          command: {
            kind: "create",
            items: [{ ...item, id: "conflict", code: "DUP" }],
          },
        },
      });
      assert.equal(stale.response.status, 409);
      const readerLogin = await request("/api/auth/login", {
        method: "POST",
        body: {
          email: `reader-${suffix}@test.invalid`,
          password: "Senha de teste 123!",
        },
      });
      const readerCookie = readerLogin.response.headers
        .get("set-cookie")
        .split(";")[0];
      assert.equal(
        (
          await request("/api/catalog", {
            method: "POST",
            cookie: readerCookie,
            body: {
              revision: state.revision,
              command: { kind: "delete", ids: [item.id] },
            },
          })
        ).response.status,
        403,
      );
      assert.equal(
        (await request("/api/workspace", { cookie: readerCookie })).response
          .status,
        200,
      );
      const entries = [
        {
          id: `lot-${suffix}`,
          itemId: item.id,
          batch: "A",
          expiresOn: "2099-09-10",
          quantityMilli: 100000,
          expectedUnit: "UN",
          category: "Bebidas",
          location: "Almoxarifado",
          actor: "FORGED",
        },
      ];
      const registered = await request("/api/expiry", {
        method: "POST",
        cookie,
        body: {
          revision: state.revision,
          command: { kind: "register", entries },
        },
      });
      assert.equal(registered.response.status, 200);
      state = registered.body;
      assert.equal(state.expiry.movements.at(-1).actor, editor.name);
      const revision = state.revision;
      const parallel = await Promise.all(
        [1, 2].map((n) =>
          request("/api/expiry", {
            method: "POST",
            cookie,
            body: {
              revision,
              command: {
                kind: "entry",
                input: {
                  id: `entry-${suffix}-${n}`,
                  lotId: entries[0].id,
                  quantityMilli: 1000,
                  expectedUnit: "UN",
                },
              },
            },
          }),
        ),
      );
      assert.deepEqual(
        parallel.map((r) => r.response.status).sort(),
        [200, 409],
      );
      state = (await request("/api/workspace", { cookie })).body;
      assert.equal(
        state.expiry.lots.find((lot) => lot.id === entries[0].id)
          .remainingMilli,
        101000,
      );
      const before = JSON.stringify(state);
      const invalid = await request("/api/expiry", {
        method: "POST",
        cookie,
        body: {
          revision: state.revision,
          command: {
            kind: "register",
            entries: [
              { ...entries[0], id: `valid-${suffix}`, batch: "B" },
              {
                ...entries[0],
                id: `bad-${suffix}`,
                batch: "C",
                quantityMilli: 0,
              },
            ],
          },
        },
      });
      assert.equal(invalid.response.status, 422);
      assert.equal(
        JSON.stringify((await request("/api/workspace", { cookie })).body),
        before,
      );
      const moved = await request("/api/expiry", {
        method: "POST",
        cookie,
        body: {
          revision: state.revision,
          command: {
            kind: "transfer",
            input: {
              id: `move-${suffix}`,
              lotId: entries[0].id,
              quantityMilli: 30000,
            },
          },
        },
      });
      assert.equal(moved.response.status, 200);
      state = moved.body;
      const bar = state.expiry.lots.find(
        (lot) => lot.itemId === item.id && lot.location === "Lanchonete",
      );
      assert.equal(bar.remainingMilli, 30000);
      assert.equal(
        state.expiry.lots
          .filter((lot) => lot.itemId === item.id)
          .reduce((total, lot) => total + lot.remainingMilli, 0),
        101000,
      );
      const counted = await request("/api/expiry", {
        method: "POST",
        cookie,
        body: {
          revision: state.revision,
          command: {
            kind: "count",
            counts: [{ lotId: bar.id, expectedMilli: 30000, countedMilli: 0 }],
            reason: "Contagem física",
          },
        },
      });
      assert.equal(counted.response.status, 200);
      state = counted.body;
      assert.equal(
        state.expiry.lots.find((lot) => lot.id === bar.id).remainingMilli,
        0,
      );
      const deletion = await request("/api/catalog", {
        method: "POST",
        cookie,
        body: {
          revision: state.revision,
          command: { kind: "delete", ids: [item.id] },
        },
      });
      assert.equal(deletion.response.status, 422);
      const unit = await request("/api/catalog", {
        method: "POST",
        cookie,
        body: {
          revision: state.revision,
          command: { kind: "update", items: [{ ...item, unit: "KG" }] },
        },
      });
      assert.equal(unit.response.status, 422);
      await assert.rejects(
        pool.query(
          "UPDATE expiry_movements SET payload=payload WHERE lot_id=$1",
          [entries[0].id],
        ),
        /append-only/,
      );
      const secondPool = createPool(connection);
      try {
        assert.equal(
          (
            await secondPool.query(
              "SELECT remaining_milli::text AS balance FROM expiry_lots WHERE id=$1",
              [bar.id],
            )
          ).rows[0].balance,
          "0",
        );
      } finally {
        await secondPool.end();
      }
      assert.equal(
        (await request("/api/orders", { cookie })).response.status,
        404,
      );
      const temporary = {
        ...item,
        id: `archived-${suffix}`,
        code: `ARCHIVE-${suffix}`,
      };
      state = (
        await request("/api/catalog", {
          method: "POST",
          cookie,
          body: {
            revision: state.revision,
            command: { kind: "create", items: [temporary] },
          },
        })
      ).body;
      state = (
        await request("/api/catalog", {
          method: "POST",
          cookie,
          body: {
            revision: state.revision,
            command: { kind: "delete", ids: [temporary.id] },
          },
        })
      ).body;
      const backup = (await request("/api/backup", { cookie })).body;
      assert.ok(backup.archivedItems.some((row) => row.id === temporary.id));
      assert.ok(!JSON.stringify(backup).includes("password_hash"));
      const schema = `restore_${suffix.replaceAll("-", "")}`;
      await pool.query(`CREATE SCHEMA ${schema}`);
      const restoreUrl = new URL(connection);
      restoreUrl.searchParams.set("options", `-csearch_path=${schema}`);
      const recovery = createPool(restoreUrl.toString());
      try {
        await migrate(recovery);
        const admin = await createUser(recovery, {
          email: "admin@test.invalid",
          name: "Administrador",
          password: "Senha de teste 123!",
          role: "admin",
        });
        await restoreBackup(recovery, backup, admin);
        assert.equal(
          (
            await recovery.query(
              "SELECT remaining_milli::text AS balance FROM expiry_lots WHERE id=$1",
              [bar.id],
            )
          ).rows[0].balance,
          "0",
        );
        assert.equal(
          (
            await recovery.query(
              "SELECT count(*) AS n FROM catalog_items WHERE deleted_at IS NOT NULL AND id=$1",
              [temporary.id],
            )
          ).rows[0].n,
          "1",
        );
        await assert.rejects(
          restoreBackup(recovery, backup, admin),
          /banco vazio/,
        );
      } finally {
        await recovery.end();
        await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      }

      await request("/api/auth/logout", { method: "POST", cookie, body: {} });
      assert.equal(
        (await request("/api/workspace", { cookie })).response.status,
        401,
      );
      const privateApp = createApp({
        pool,
        production: true,
        origin: "https://suprimentos.test.invalid",
        serveStatic: false,
      });
      const secure = privateApp.listen(0, "127.0.0.1");
      await new Promise((resolve) => secure.once("listening", resolve));
      try {
        const res = await fetch(
          `http://127.0.0.1:${secure.address().port}/api/auth/login`,
          {
            method: "POST",
            headers: {
              Origin: "https://suprimentos.test.invalid",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: editor.email,
              password: "Senha de teste 123!",
            }),
          },
        );
        assert.equal(res.status, 200);
        assert.ok(res.headers.get("set-cookie").includes("Secure"));
        assert.ok(res.headers.get("content-security-policy"));
      } finally {
        await new Promise((resolve) => secure.close(resolve));
      }
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    }
  },
);
