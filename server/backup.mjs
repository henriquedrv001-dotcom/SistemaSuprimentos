import { randomUUID } from "node:crypto";
import { normalizeItem } from "./catalog.mjs";
import { readExpiryWorkspace } from "../src/services/expiry.ts";
/** Restauração administrativa somente em banco vazio, nunca substitui dados existentes. */
export async function restoreBackup(pool, backup, actor) {
  if (
    backup?.format !== "suprimentos-production-backup-v1" ||
    !Array.isArray(backup.items) ||
    !Array.isArray(backup.history)
  )
    throw new Error("Backup de produção inválido.");
  const items = backup.items.map(normalizeItem);
  const archivedItems = (backup.archivedItems || []).map(normalizeItem);
  const expiry = readExpiryWorkspace(JSON.stringify(backup.expiry));
  const ids = new Set([...items, ...archivedItems].map((item) => item.id));
  if (
    ids.size !== items.length + archivedItems.length ||
    expiry.lots.some((lot) => !items.some((item) => item.id === lot.itemId))
  )
    throw new Error("Vínculos do backup inválidos.");
  for (const event of backup.history)
    if (
      !event ||
      !ids.has(event.itemId) ||
      typeof event.id !== "string" ||
      typeof event.timestamp !== "string"
    )
      throw new Error("Histórico do backup inválido.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT revision FROM app_workspace WHERE id=1 FOR UPDATE",
    );
    const rows = (
      await client.query(
        "SELECT (SELECT count(*) FROM catalog_items)+(SELECT count(*) FROM catalog_history)+(SELECT count(*) FROM expiry_lots)+(SELECT count(*) FROM expiry_movements) AS total",
      )
    ).rows[0];
    if (rows.total !== "0")
      throw new Error(
        "A restauração exige um banco vazio. Os dados existentes foram preservados.",
      );
    for (const item of archivedItems)
      await client.query(
        "INSERT INTO catalog_items(id,code,unit,payload,deleted_at) VALUES($1,$2,$3,$4,now())",
        [item.id, item.code, item.unit, item],
      );
    for (const item of items)
      await client.query(
        "INSERT INTO catalog_items(id,code,unit,payload) VALUES($1,$2,$3,$4)",
        [item.id, item.code, item.unit, item],
      );
    for (const event of [...backup.history].reverse())
      await client.query(
        "INSERT INTO catalog_history(id,item_id,actor_id,payload) VALUES($1,$2,$3,$4)",
        [event.id, event.itemId, actor.id, event],
      );
    for (const lot of expiry.lots)
      await client.query(
        "INSERT INTO expiry_lots(id,item_id,initial_milli,remaining_milli,payload) VALUES($1,$2,$3,$4,$5)",
        [lot.id, lot.itemId, lot.initialMilli, lot.remainingMilli, lot],
      );
    for (const event of expiry.movements)
      await client.query(
        "INSERT INTO expiry_movements(id,lot_id,counterpart_lot_id,actor_id,reference_id,transfer_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          event.id,
          event.lotId,
          event.counterpartLotId || null,
          actor.id,
          event.referenceId || null,
          event.transferId || null,
          event,
        ],
      );
    await client.query(
      "UPDATE app_workspace SET revision=revision+1 WHERE id=1",
    );
    await client.query(
      "INSERT INTO app_audit(id,actor_id,action,revision) SELECT $1,$2,'backup:restore',revision FROM app_workspace WHERE id=1",
      [randomUUID(), actor.id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
