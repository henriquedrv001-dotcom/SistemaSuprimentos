import test from "node:test";
import assert from "node:assert/strict";
import {
  isDLLowBalance,
  dlControlAlertGroups,
  selectDLControlRows,
  dlControlRows,
  DEFAULT_DL_LOW_BALANCE_PERCENT,
} from "../src/services/dlControl.ts";
import { newDLPlan, emptyDLWorkspace } from "../src/services/dlPlanning.ts";

const today = "2026-10-18";
function row({
  id = "a",
  sequence = 29,
  item = "Material",
  supplier = "Fornecedor",
  quantity = 100000,
  remaining = 20000,
  unit = "UN",
  validUntil = "2027-01-18",
} = {}) {
  const plan = newDLPlan(
    { ...emptyDLWorkspace(), lastNumber: sequence - 1 },
    {
      title: "Aquisição",
      category: "Gêneros",
      openedOn: today,
      responsible: "Henrique",
      justification: "",
      notes: "",
    },
  );
  plan.id = `dl-${sequence}`;
  plan.sequenceNumber = sequence;
  plan.code = `DL-${String(sequence).padStart(4, "0")}`;
  plan.contract = {
    awards: [],
    notAwarded: [],
    signedOn: today,
    validFrom: today,
    validUntil,
    notes: "",
    release: {
      timestamp: today + "T12:00:00Z",
      actor: "Henrique",
      reference: "Confirmado",
      confirmedOn: today,
    },
  };
  return {
    plan,
    item: { id, code: id, description: item, unit, active: true },
    origin: {
      id,
      planId: plan.id,
      lineId: id,
      itemId: id,
      unit,
      supplier,
      supplierReference: "",
      mxmOrder: "00123",
      quantityMilli: quantity,
      unitPriceCents: 100,
      remainingMilli: remaining,
      availableMilli: remaining,
      receivedMilli: 0,
      reservedMilli: 0,
    },
  };
}
test("saldo baixo usa limite exato, positivo e relativo à quantidade contratada", () => {
  assert.equal(DEFAULT_DL_LOW_BALANCE_PERCENT, 20);
  assert.equal(isDLLowBalance(row({ remaining: 20000 })), true);
  assert.equal(isDLLowBalance(row({ remaining: 20001 })), false);
  assert.equal(isDLLowBalance(row({ remaining: 0 })), false);
  assert.equal(isDLLowBalance(row({ quantity: 0, remaining: 0 })), false);
  assert.equal(
    isDLLowBalance(row({ quantity: 1125, remaining: 225, unit: "KG" })),
    true,
  );
  assert.equal(
    isDLLowBalance(row({ quantity: 1125, remaining: 226, unit: "KG" })),
    false,
  );
  const quantity = Number.MAX_SAFE_INTEGER,
    remaining = Number((BigInt(quantity) * 20n) / 100n);
  assert.equal(isDLLowBalance(row({ quantity, remaining })), true);
  assert.equal(
    isDLLowBalance(row({ quantity, remaining: remaining + 1 })),
    false,
  );
});
test("alerta agrupa DL uma única vez e não soma quantidades de unidades diferentes", () => {
  const a = row({ id: "a", remaining: 20000 }),
    b = row({ id: "b", quantity: 1125, remaining: 100, unit: "KG" }),
    c = row({ id: "c", sequence: 30, remaining: 0 }),
    d = row({ id: "d", sequence: 31, remaining: 50000 });
  const groups = dlControlAlertGroups([a, b, c, d], "lowBalance", today);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].plan.id, a.plan.id);
  assert.deepEqual(
    groups[0].rows.map((r) => r.origin.id),
    ["a", "b"],
  );
  const zero = dlControlAlertGroups([a, b, c, d], "zeroBalance", today);
  assert.equal(zero.length, 1);
  assert.equal(zero[0].rows[0], c);
});
test("limite pode ser fornecido futuramente pelas configurações sem alterar o padrão", () => {
  const r = row({ remaining: 25000 });
  assert.equal(dlControlAlertGroups([r], "lowBalance", today).length, 0);
  assert.equal(dlControlAlertGroups([r], "lowBalance", today, 30).length, 1);
  assert.equal(DEFAULT_DL_LOW_BALANCE_PERCENT, 20);
  for (const bad of [-1, 101, 20.5, NaN])
    assert.throws(() => isDLLowBalance(r, bad), /percentual inteiro/);
});
test("ordena DL por número, fornecedor e item em português e saldo nos dois sentidos", () => {
  const a = row({
      id: "a",
      sequence: 10,
      item: "Item 10",
      supplier: "Zeca",
      remaining: 1000,
    }),
    b = row({
      id: "b",
      sequence: 2,
      item: "Item 2",
      supplier: "Ágata",
      remaining: 500,
    }),
    c = row({
      id: "c",
      sequence: 3,
      item: "Item 3",
      supplier: "Bruno",
      remaining: 2000,
    });
  const rows = [a, b, c],
    ids = (rs) => rs.map((r) => r.origin.id);
  assert.deepEqual(ids(selectDLControlRows(rows, { sortBy: "dl" }, today)), [
    "b",
    "c",
    "a",
  ]);
  assert.deepEqual(
    ids(selectDLControlRows(rows, { sortBy: "dl", direction: "desc" }, today)),
    ["a", "c", "b"],
  );
  assert.deepEqual(
    ids(selectDLControlRows(rows, { sortBy: "supplier" }, today)),
    ["b", "c", "a"],
  );
  assert.deepEqual(ids(selectDLControlRows(rows, { sortBy: "item" }, today)), [
    "b",
    "c",
    "a",
  ]);
  assert.deepEqual(
    ids(selectDLControlRows(rows, { sortBy: "balance" }, today)),
    ["b", "a", "c"],
  );
  assert.deepEqual(
    ids(
      selectDLControlRows(
        rows,
        { sortBy: "balance", direction: "desc" },
        today,
      ),
    ),
    ["c", "a", "b"],
  );
  assert.deepEqual(rows, [a, b, c]);
});
test("mostrar zerados combina com os demais filtros sem alterar os dados ou os alertas globais", () => {
  const a = row({ id: "a", item: "Açúcar", supplier: "Ana", remaining: 0 }),
    b = row({ id: "b", item: "Arroz", supplier: "Ana", remaining: 1000 }),
    c = row({ id: "c", supplier: "Outro", remaining: 5000 });
  const rows = [a, b, c],
    before = JSON.stringify(rows);
  assert.equal(selectDLControlRows(rows, {}, today).length, 3);
  assert.deepEqual(
    selectDLControlRows(
      rows,
      { supplier: "Ana", showZeroBalances: false },
      today,
    ),
    [b],
  );
  assert.deepEqual(
    selectDLControlRows(
      rows,
      { query: "AÇÚCAR", showZeroBalances: false },
      today,
    ),
    [],
  );
  assert.deepEqual(
    selectDLControlRows(
      rows,
      { query: "AÇÚCAR", showZeroBalances: true },
      today,
    ),
    [a],
  );
  assert.equal(
    dlControlAlertGroups(rows, "zeroBalance", today)[0].rows.length,
    1,
  );
  assert.equal(JSON.stringify(rows), before);
});
test("indicador de vencimento usa vigência real e não inclui DL futura ou já vencida", () => {
  const a = row({ id: "a", sequence: 29, validUntil: today }),
    b = row({ id: "b", sequence: 30, validUntil: "2026-11-17" }),
    c = row({ id: "c", sequence: 31, validUntil: "2026-11-18" }),
    d = row({ id: "d", sequence: 32, validUntil: "2026-10-17" });
  assert.deepEqual(
    dlControlAlertGroups([a, b, c, d], "expiring", today).map((g) => g.plan.id),
    [a.plan.id, b.plan.id],
  );
});
test("projeção do Controle não cria origem de rascunho nem modifica a aquisição", () => {
  const plan = newDLPlan(emptyDLWorkspace(), {
      title: "Rascunho",
      category: "",
      openedOn: today,
      responsible: "",
      justification: "",
      notes: "",
    }),
    before = JSON.stringify(plan);
  assert.deepEqual(dlControlRows([plan], []), []);
  assert.equal(JSON.stringify(plan), before);
});
