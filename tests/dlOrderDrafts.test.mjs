import test from "node:test";
import assert from "node:assert/strict";
import {
  readDLOrderDrafts,
  validateDLOrderDraft,
  draftTotalCents,
  persistDLOrderDrafts,
  dlOrderDraftsKey,
} from "../src/services/dlOrderDrafts.ts";

const row = (planId = "dl-a", price = 250) => ({
  plan: { id: planId },
  origin: {
    id: "same-award",
    itemId: "same-item",
    availableMilli: 10000,
    unitPriceCents: price,
  },
  item: { description: "Material" },
});
const draft = () => ({
  id: "draft-a",
  requester: "Henrique",
  cycleId: "",
  expectedDelivery: "2026-10-30",
  notes: "",
  createdAt: "2026-10-19T12:00:00Z",
  updatedAt: "2026-10-19T12:00:00Z",
  lines: [{ planId: "dl-a", originId: "same-award", quantityMilli: 1500 }],
});
test("validates exact DL origin and preserves quantities and contract prices", () => {
  const rows = [row(), row("dl-b", 900)];
  const before = JSON.stringify(rows);
  const next = draft();
  next.lines.push({
    planId: "dl-b",
    originId: "same-award",
    quantityMilli: 500,
  });
  validateDLOrderDraft(next, rows);
  assert.equal(draftTotalCents(next, rows), 825);
  assert.equal(JSON.stringify(rows), before);
  next.lines[0].planId = "missing-dl";
  assert.throws(() => validateDLOrderDraft(next, rows), /origem liberada/);
  assert.equal(draftTotalCents(next, rows), null);
});
test("rejects excess, missing, duplicate and fractional milli-unit quantities", () => {
  for (const quantityMilli of [
    0,
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    10001,
  ]) {
    const next = draft();
    next.lines[0].quantityMilli = quantityMilli;
    assert.throws(() => validateDLOrderDraft(next, [row()]));
  }
  const next = draft();
  next.lines.push({ ...next.lines[0] });
  assert.throws(() => validateDLOrderDraft(next, [row()]), /inválida/);
  next.lines = [];
  assert.throws(() => validateDLOrderDraft(next, [row()]), /ao menos um/);
});
test("validates requester and real calendar dates without prohibiting optional dates", () => {
  const next = draft();
  next.requester = " ";
  assert.throws(() => validateDLOrderDraft(next, [row()]), /solicitante/);
  next.requester = "Henrique";
  next.expectedDelivery = "2026-02-30";
  assert.throws(() => validateDLOrderDraft(next, [row()]), /data/);
  next.expectedDelivery = "";
  validateDLOrderDraft(next, [row()]);
});
test("storage preserves concurrent writes, rejects corrupted versions and only writes draft key", () => {
  const values = new Map([["suprimentos:dl-planning:v1", "do-not-change"]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const ws = { version: 1, drafts: [draft()] };
  const first = persistDLOrderDrafts(storage, null, ws);
  assert.deepEqual(readDLOrderDrafts(first), ws);
  storage.setItem(dlOrderDraftsKey, "other-tab");
  assert.throws(() => persistDLOrderDrafts(storage, first, ws), /outra aba/);
  assert.equal(storage.getItem(dlOrderDraftsKey), "other-tab");
  assert.equal(storage.getItem("suprimentos:dl-planning:v1"), "do-not-change");
  assert.throws(
    () => readDLOrderDrafts('{"version":2,"drafts":[]}'),
    /não reconhecido/,
  );
  assert.throws(() => readDLOrderDrafts("{broken"));
  assert.throws(
    () =>
      readDLOrderDrafts(
        JSON.stringify({ version: 1, drafts: [draft(), draft()] }),
      ),
    /inválido/,
  );
});
