import test from "node:test";
import assert from "node:assert/strict";
import {
  registerExpiry,
  registerExpiryBatch,
  debitExpiry,
  emptyExpiryWorkspace,
  readExpiryWorkspace,
  expiryStatus,
  expiryDays,
  expiryKey,
} from "../src/services/expiry.ts";
import { LocalExpiryRepository } from "../src/repositories/expiryRepository.ts";
import { normalizeCatalogUnit } from "../src/services/catalogUnits.ts";
import { buildImportPreview } from "../src/services/catalogImport.ts";
const items = [
  {
    id: "item-1",
    code: "001",
    description: "Álcool 70%",
    unit: "L",
    active: true,
    type: "Limpeza",
    group: "Higiene",
    criterion: "Mensal",
    visible: true,
  },
];
const entry = (overrides = {}) => ({
  id: "lot-1",
  itemId: "item-1",
  batch: " A ",
  expiresOn: "2027-01-10",
  quantityMilli: 20000,
  actor: "Henrique",
  expectedUnit: "L",
  ...overrides,
});
test("unidades padronizam apenas grafia e não convertem quantidades nem embalagens", () => {
  assert.equal(normalizeCatalogUnit(" kg "), "KG");
  assert.equal(normalizeCatalogUnit("Unidade"), "UN");
  assert.equal(normalizeCatalogUnit("mililitros"), "ML");
  for (const unit of ["CX", "PCT", "KG", "UN", "L", "ML"])
    assert.equal(normalizeCatalogUnit(unit), unit);
  assert.equal(normalizeCatalogUnit(""), "");
});
test("importação normaliza aliases explícitos de unidade e preserva códigos", () => {
  const result = buildImportPreview(
    "Código;Descrição;Unidade\n0001;Material;quilogramas",
    [],
    "itens.csv",
  );
  assert.equal(result.newItems[0].unit, "KG");
  assert.equal(result.newItems[0].code, "0001");
  assert.equal(items[0].unit, "L");
});
test("um item central possui vários lotes sem criar materiais duplicados", () => {
  const before = JSON.stringify(items);
  let ws = registerExpiry(emptyExpiryWorkspace(), items, entry());
  ws = registerExpiry(
    ws,
    items,
    entry({
      id: "lot-2",
      batch: "B",
      expiresOn: "2027-03-20",
      quantityMilli: 15000,
    }),
  );
  assert.equal(ws.lots.length, 2);
  assert.ok(ws.lots.every((l) => l.itemId === "item-1"));
  assert.equal(ws.lots[0].unit, "L");
  assert.equal(JSON.stringify(items), before);
  assert.doesNotThrow(() => readExpiryWorkspace(JSON.stringify(ws)));
});
test("validades bloqueiam unidade ausente, item inativo, unidade alterada e datas/quantidades inválidas", () => {
  for (const change of [
    { quantityMilli: 0 },
    { quantityMilli: -1 },
    { quantityMilli: 1.5 },
    { expiresOn: "2027-02-30" },
    { actor: "" },
    { batch: "" },
    { itemId: "outro" },
    { expectedUnit: "KG" },
  ])
    assert.throws(() =>
      registerExpiry(emptyExpiryWorkspace(), items, entry(change)),
    );
  assert.throws(() =>
    registerExpiry(
      emptyExpiryWorkspace(),
      [{ ...items[0], active: false }],
      entry(),
    ),
  );
  assert.throws(() =>
    registerExpiry(
      emptyExpiryWorkspace(),
      [{ ...items[0], unit: "" }],
      entry(),
    ),
  );
});
test("repetir id ou o mesmo item/lote/validade não duplica a entrada", () => {
  const ws = registerExpiry(emptyExpiryWorkspace(), items, entry());
  assert.throws(() => registerExpiry(ws, items, entry()), /já foi salvo/);
  assert.throws(
    () => registerExpiry(ws, items, entry({ id: "lot-2", batch: "a" })),
    /mesmo lote/,
  );
  assert.equal(ws.lots.length, 1);
});
test("baixa parcial e total preservam entrada e histórico e encerram sem saldo negativo", () => {
  let ws = registerExpiry(emptyExpiryWorkspace(), items, entry());
  ws = debitExpiry(ws, {
    lotId: "lot-1",
    quantityMilli: 5000,
    actor: "Henrique",
    kind: "Consumo",
    reason: "Uso na unidade",
  });
  assert.equal(ws.lots[0].remainingMilli, 15000);
  assert.equal(ws.lots[0].initialMilli, 20000);
  const original = JSON.stringify(ws);
  for (const qty of [15001, 0, -1, 1.1])
    assert.throws(() =>
      debitExpiry(ws, {
        lotId: "lot-1",
        quantityMilli: qty,
        actor: "Henrique",
        kind: "Consumo",
        reason: "Uso",
      }),
    );
  assert.equal(JSON.stringify(ws), original);
  ws = debitExpiry(ws, {
    lotId: "lot-1",
    quantityMilli: 15000,
    actor: "Henrique",
    kind: "Descarte",
    reason: "Prazo encerrado",
  });
  assert.equal(expiryStatus(ws.lots[0], "2027-03-01"), "Encerrado");
  assert.equal(ws.movements.length, 3);
  assert.doesNotThrow(() => readExpiryWorkspace(JSON.stringify(ws)));
});
test("baixa exige motivo e responsável", () => {
  const ws = registerExpiry(emptyExpiryWorkspace(), items, entry());
  for (const override of [{ reason: "" }, { actor: "" }, { kind: "Outro" }])
    assert.throws(() =>
      debitExpiry(ws, {
        lotId: "lot-1",
        quantityMilli: 1000,
        actor: "Henrique",
        kind: "Ajuste",
        reason: "Correção conferida",
        ...override,
      }),
    );
});
test("faixas de vencimento consideram hoje, 7 e 30 dias sem misturar lotes zerados", () => {
  const lot = registerExpiry(emptyExpiryWorkspace(), items, entry()).lots[0];
  for (const [date, status] of [
    ["2026-10-21", "Vencido"],
    ["2026-10-22", "Até 7 dias"],
    ["2026-10-29", "Até 7 dias"],
    ["2026-10-30", "8 a 30 dias"],
    ["2026-11-21", "8 a 30 dias"],
    ["2026-11-22", "Acima de 30 dias"],
  ])
    assert.equal(
      expiryStatus({ ...lot, expiresOn: date }, "2026-10-22"),
      status,
    );
  assert.equal(expiryDays("2028-03-01", "2028-02-28"), 2);
});
test("leitura não aceita saldo sem histórico, referências quebradas ou duplicidades", () => {
  const ws = registerExpiry(emptyExpiryWorkspace(), items, entry());
  for (const change of [
    (w) => w.lots[0].remainingMilli--,
    (w) => (w.movements = []),
    (w) => (w.movements[0].lotId = "outro"),
    (w) => w.lots.push(w.lots[0]),
    (w) => w.movements.push(w.movements[0]),
  ]) {
    const broken = structuredClone(ws);
    change(broken);
    assert.throws(() => readExpiryWorkspace(JSON.stringify(broken)));
  }
});
test("repositório detecta outra aba e não sobrescreve dados em conflito", () => {
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
  const repo = new LocalExpiryRepository(storage);
  const first = repo.read();
  const ws = registerExpiry(first.workspace, items, entry());
  repo.save(ws, first.revision);
  const before = store.get(expiryKey);
  assert.throws(() => repo.save(ws, first.revision), /outra aba/);
  assert.equal(store.get(expiryKey), before);
});
test("falha de armazenamento não retorna confirmação de gravação", () => {
  const repo = new LocalExpiryRepository({
    getItem: () => null,
    setItem: () => {
      throw new Error("Sem espaço");
    },
  });
  assert.throws(
    () =>
      repo.save(registerExpiry(emptyExpiryWorkspace(), items, entry()), null),
    /Sem espaço/,
  );
});

test("vários lotes do material são preparados juntos para uma única gravação", () => {
  const original = emptyExpiryWorkspace();
  const result = registerExpiryBatch(original, items, [
    entry(),
    entry({ id: "lot-2", batch: "B", quantityMilli: 15000 }),
  ]);
  assert.equal(result.lots.length, 2);
  assert.equal(result.movements.length, 2);
  assert.ok(result.lots.every((lot) => lot.itemId === items[0].id));
  assert.equal(original.lots.length, 0);
  assert.doesNotThrow(() => readExpiryWorkspace(JSON.stringify(result)));
});
test("lote inválido ou repetido bloqueia o conjunto sem alterar os registros anteriores", () => {
  const original = registerExpiry(emptyExpiryWorkspace(), items, entry());
  const before = JSON.stringify(original);
  for (const second of [
    entry({ id: "lot-3", batch: "C", quantityMilli: 0 }),
    entry({ id: "lot-3", batch: "B" }),
  ]) {
    assert.throws(
      () =>
        registerExpiryBatch(original, items, [
          entry({ id: "lot-2", batch: "B" }),
          second,
        ]),
      /Lote 2:/,
    );
    assert.equal(JSON.stringify(original), before);
  }
  assert.throws(
    () => registerExpiryBatch(original, items, []),
    /ao menos um lote/,
  );
});
