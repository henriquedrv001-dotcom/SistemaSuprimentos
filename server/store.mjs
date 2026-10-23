import { randomUUID } from "node:crypto";
import { readExpiryWorkspace } from "../src/services/expiry.ts";
import { applyExpiryCommand } from "../src/services/expiryCommands.ts";
import { applyCatalogCommand } from "./catalog.mjs";
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
async function readState(client) {
  const revision = (
    await client.query("SELECT revision::text FROM app_workspace WHERE id=1")
  ).rows[0]?.revision;
  if (revision === undefined)
    throw new ApiError(503, "O banco ainda não foi preparado.");
  const items = (
    await client.query(
      "SELECT payload FROM catalog_items WHERE deleted_at IS NULL ORDER BY code,id",
    )
  ).rows.map((row) => row.payload);
  const history = (
    await client.query(
      "SELECT payload FROM catalog_history ORDER BY position DESC",
    )
  ).rows.map((row) => row.payload);
  const lots = (
    await client.query("SELECT payload FROM expiry_lots ORDER BY id")
  ).rows.map((row) => row.payload);
  const movements = (
    await client.query("SELECT payload FROM expiry_movements ORDER BY position")
  ).rows.map((row) => row.payload);
  const expiry = readExpiryWorkspace(
    JSON.stringify({ version: 1, lots, movements }),
  );
  if (lots.some((lot) => !items.some((item) => item.id === lot.itemId)))
    throw new ApiError(
      503,
      "Os vínculos precisam de conferência. Nenhum dado foi alterado.",
    );
  return { revision, items, history, expiry };
}
export async function snapshot(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const state = await readState(client);
    await client.query("COMMIT");
    return state;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function mutate(pool, expectedRevision, resource, command, user) {
  if (!["admin", "editor"].includes(user.role))
    throw new ApiError(403, "Seu acesso permite somente consulta.");
  if (typeof expectedRevision !== "string" || !/^\d+$/.test(expectedRevision))
    throw new ApiError(400, "Revisão dos dados inválida. Recarregue a página.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = (
      await client.query(
        "SELECT revision::text FROM app_workspace WHERE id=1 FOR UPDATE",
      )
    ).rows[0];
    if (current?.revision !== expectedRevision)
      throw new ApiError(
        409,
        "Os dados mudaram por outro usuário ou aba. Recarregue antes de salvar; seu preenchimento foi mantido.",
      );
    const state = await readState(client);
    let next;
    try {
      next =
        resource === "catalog"
          ? applyCatalogCommand(state, command, user)
          : {
              ...state,
              expiry: applyExpiryCommand(
                state.expiry,
                state.items,
                command,
                user.name,
              ),
            };
    } catch (error) {
      throw new ApiError(
        422,
        error instanceof Error ? error.message : "Confira os dados informados.",
      );
    }
    const oldItems = new Map(state.items.map((item) => [item.id, item]));
    const changedItems = next.items.filter(
      (item) => JSON.stringify(item) !== JSON.stringify(oldItems.get(item.id)),
    );
    const newIds = changedItems
      .filter((item) => !oldItems.has(item.id))
      .map((item) => item.id);
    if (
      newIds.length &&
      (
        await client.query(
          "SELECT 1 FROM catalog_items WHERE id=ANY($1::text[]) LIMIT 1",
          [newIds],
        )
      ).rowCount
    )
      throw new ApiError(409, "Identificador de material já utilizado.");
    if (changedItems.length)
      await client.query(
        "INSERT INTO catalog_items(id,code,unit,payload) SELECT value->>'id',value->>'code',value->>'unit',value FROM jsonb_array_elements($1::jsonb) ON CONFLICT(id) DO UPDATE SET code=EXCLUDED.code,unit=EXCLUDED.unit,payload=EXCLUDED.payload,updated_at=now()",
        [JSON.stringify(changedItems)],
      );
    const nextIds = new Set(next.items.map((item) => item.id));
    const removedIds = state.items
      .filter((item) => !nextIds.has(item.id))
      .map((item) => item.id);
    if (removedIds.length)
      await client.query(
        "UPDATE catalog_items SET deleted_at=now() WHERE id=ANY($1::text[])",
        [removedIds],
      );
    const historyIds = new Set(state.history.map((event) => event.id));
    const newHistory = next.history.filter(
      (event) => !historyIds.has(event.id),
    );
    if (newHistory.length)
      await client.query(
        "INSERT INTO catalog_history(id,item_id,actor_id,payload) SELECT value->>'id',value->>'itemId',$2,value FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY ORDER BY ordinality",
        [JSON.stringify(newHistory), user.id],
      );
    const oldLots = new Map(state.expiry.lots.map((lot) => [lot.id, lot]));
    const changedLots = next.expiry.lots.filter(
      (lot) => JSON.stringify(lot) !== JSON.stringify(oldLots.get(lot.id)),
    );
    if (changedLots.length)
      await client.query(
        "INSERT INTO expiry_lots(id,item_id,initial_milli,remaining_milli,payload) SELECT value->>'id',value->>'itemId',(value->>'initialMilli')::bigint,(value->>'remainingMilli')::bigint,value FROM jsonb_array_elements($1::jsonb) ON CONFLICT(id) DO UPDATE SET remaining_milli=EXCLUDED.remaining_milli,payload=EXCLUDED.payload",
        [JSON.stringify(changedLots)],
      );
    const eventIds = new Set(state.expiry.movements.map((event) => event.id));
    const newEvents = next.expiry.movements.filter(
      (event) => !eventIds.has(event.id),
    );
    if (newEvents.length)
      await client.query(
        "INSERT INTO expiry_movements(id,lot_id,counterpart_lot_id,actor_id,reference_id,transfer_id,payload) SELECT value->>'id',value->>'lotId',value->>'counterpartLotId',$2,value->>'referenceId',value->>'transferId',value FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY ORDER BY ordinality",
        [JSON.stringify(newEvents), user.id],
      );
    await client.query(
      "UPDATE app_workspace SET revision=revision+1 WHERE id=1",
    );
    const result = await readState(client);
    await client.query(
      "INSERT INTO app_audit(id,actor_id,action,revision) VALUES($1,$2,$3,$4)",
      [randomUUID(), user.id, `${resource}:${command.kind}`, result.revision],
    );
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505")
      throw new ApiError(
        409,
        "Código ou operação já registrado. Recarregue para conferir.",
      );
    throw error;
  } finally {
    client.release();
  }
}
export async function backupSnapshot(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const state = await readState(client);
    const archivedItems = (
      await client.query(
        "SELECT payload FROM catalog_items WHERE deleted_at IS NOT NULL ORDER BY id",
      )
    ).rows.map((row) => row.payload);
    await client.query("COMMIT");
    return {
      format: "suprimentos-production-backup-v1",
      createdAt: new Date().toISOString(),
      ...state,
      archivedItems,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
