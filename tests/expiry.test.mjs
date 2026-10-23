import { expiryCsv } from "../src/services/expiryReports.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  groupExpiryLots,
  expiryQuantity,
  addExpiryEntry,
  countExpiry,
  expiryFirstToUse,
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
test("nova chegada soma ao mesmo lote e validade sem duplicar o material nem a operação", () => {
  const original = registerExpiry(emptyExpiryWorkspace(), items, entry());
  const before = JSON.stringify(original);
  const result = registerExpiry(
    original,
    items,
    entry({ id: "receipt-2", batch: "a", quantityMilli: 5000 }),
  );
  assert.equal(result.lots.length, 1);
  assert.equal(result.lots[0].initialMilli, 20000);
  assert.equal(result.lots[0].remainingMilli, 25000);
  assert.equal(result.movements.length, 2);
  assert.equal(result.movements[1].beforeMilli, 20000);
  assert.equal(result.movements[1].afterMilli, 25000);
  assert.equal(JSON.stringify(original), before);
  assert.throws(
    () =>
      registerExpiry(
        result,
        items,
        entry({ id: "receipt-2", quantityMilli: 5000 }),
      ),
    /já foi salvo/,
  );
  assert.throws(() => registerExpiry(result, items, entry()), /já foi salvo/);
  assert.doesNotThrow(() => readExpiryWorkspace(JSON.stringify(result)));
});
test("baixa parcial e total preservam entrada e histórico e encerram sem saldo negativo", () => {
  let ws = registerExpiry(emptyExpiryWorkspace(), items, entry());
  ws = debitExpiry(ws, {
    today: "2026-10-22",
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
        today: "2026-10-22",
        lotId: "lot-1",
        quantityMilli: qty,
        actor: "Henrique",
        kind: "Consumo",
        reason: "Uso",
      }),
    );
  assert.equal(JSON.stringify(ws), original);
  ws = debitExpiry(ws, {
    today: "2026-10-22",
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
        today: "2026-10-22",
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

test("entrada reabre lote encerrado e preserva entradas e baixas anteriores", () => {
  let ws = registerExpiry(emptyExpiryWorkspace(), items, entry());
  ws = debitExpiry(ws, {
    today: "2026-10-22",
    lotId: "lot-1",
    quantityMilli: 20000,
    actor: "Henrique",
    reason: "Uso",
    kind: "Consumo",
    today: "2026-10-22",
  });
  ws = addExpiryEntry(ws, items, {
    id: "new-receipt",
    lotId: "lot-1",
    quantityMilli: 3000,
    actor: "Henrique",
    expectedUnit: "L",
  });
  assert.equal(ws.lots.length, 1);
  assert.equal(ws.lots[0].remainingMilli, 3000);
  assert.equal(ws.movements.length, 3);
  assert.doesNotThrow(() => readExpiryWorkspace(JSON.stringify(ws)));
});
test("mesmo lote com outra validade, unidade divergente e saldo acima do limite são bloqueados", () => {
  const ws = registerExpiry(emptyExpiryWorkspace(), items, entry());
  assert.throws(
    () =>
      registerExpiry(ws, items, entry({ id: "new", expiresOn: "2027-02-10" })),
    /outra validade/,
  );
  assert.throws(
    () =>
      addExpiryEntry(ws, [{ ...items[0], unit: "KG" }], {
        id: "new",
        lotId: "lot-1",
        quantityMilli: 1000,
        actor: "Henrique",
        expectedUnit: "L",
      }),
    /unidade/,
  );
  assert.throws(
    () =>
      registerExpiry(
        ws,
        items,
        entry({ id: "new", quantityMilli: Number.MAX_SAFE_INTEGER }),
      ),
    /limite/,
  );
});
test("conferência guarda contagem igual, menor, maior e zero sem confundir com entrada ou consumo", () => {
  let ws = registerExpiry(emptyExpiryWorkspace(), items, entry());
  const original = JSON.stringify(ws);
  ws = countExpiry(
    ws,
    [{ lotId: "lot-1", expectedMilli: 20000, countedMilli: 20000 }],
    "Henrique",
    "",
  );
  assert.equal(ws.movements.at(-1).quantityMilli, 0);
  assert.equal(ws.movements.at(-1).kind, "Conferência");
  ws = countExpiry(
    ws,
    [{ lotId: "lot-1", expectedMilli: 20000, countedMilli: 17500 }],
    "Henrique",
    "Contagem física",
  );
  assert.equal(ws.lots[0].remainingMilli, 17500);
  assert.equal(ws.movements.at(-1).beforeMilli, 20000);
  assert.equal(ws.movements.at(-1).afterMilli, 17500);
  ws = countExpiry(
    ws,
    [{ lotId: "lot-1", expectedMilli: 17500, countedMilli: 25000 }],
    "Henrique",
    "Correção de contagem",
  );
  assert.equal(ws.lots[0].initialMilli, 20000);
  assert.equal(ws.lots[0].remainingMilli, 25000);
  ws = countExpiry(
    ws,
    [{ lotId: "lot-1", expectedMilli: 25000, countedMilli: 0 }],
    "Henrique",
    "Nada encontrado",
  );
  assert.equal(ws.lots[0].remainingMilli, 0);
  assert.equal(ws.movements.length, 5);
  assert.doesNotThrow(() => readExpiryWorkspace(original));
  assert.doesNotThrow(() => readExpiryWorkspace(JSON.stringify(ws)));
});
test("conferência exige motivo para divergência, saldo esperado e contagem válida; lote não contado fica intacto", () => {
  const ws = registerExpiryBatch(emptyExpiryWorkspace(), items, [
    entry(),
    entry({ id: "lot-2", batch: "B" }),
  ]);
  const before = JSON.stringify(ws);
  for (const row of [
    { lotId: "lot-1", expectedMilli: 20000, countedMilli: -1 },
    { lotId: "lot-1", expectedMilli: 20000, countedMilli: 1.5 },
    { lotId: "lot-1", expectedMilli: 0, countedMilli: 20000 },
    { lotId: "other", expectedMilli: 0, countedMilli: 1 },
  ])
    assert.throws(() => countExpiry(ws, [row], "Henrique", "Conferência"));
  assert.throws(
    () =>
      countExpiry(
        ws,
        [{ lotId: "lot-1", expectedMilli: 20000, countedMilli: 1000 }],
        "Henrique",
        "",
      ),
    /motivo/,
  );
  assert.throws(() => countExpiry(ws, [], "Henrique", ""));
  const result = countExpiry(
    ws,
    [{ lotId: "lot-1", expectedMilli: 20000, countedMilli: 0 }],
    "Henrique",
    "Não encontrado",
  );
  assert.equal(result.lots[1].remainingMilli, 20000);
  assert.equal(JSON.stringify(ws), before);
});
test("conferência em lote é atômica quando alguma linha está inválida ou repetida", () => {
  const ws = registerExpiryBatch(emptyExpiryWorkspace(), items, [
    entry(),
    entry({ id: "lot-2", batch: "B" }),
  ]);
  const before = JSON.stringify(ws);
  for (const second of [
    { lotId: "lot-2", expectedMilli: 0, countedMilli: 10000 },
    { lotId: "lot-1", expectedMilli: 20000, countedMilli: 10000 },
  ])
    assert.throws(() =>
      countExpiry(
        ws,
        [{ lotId: "lot-1", expectedMilli: 20000, countedMilli: 10000 }, second],
        "Henrique",
        "Contagem",
      ),
    );
  assert.equal(JSON.stringify(ws), before);
});
test("histórico antigo continua legível e alteração indevida de contagem/snapshot é detectada", () => {
  const ws = registerExpiry(emptyExpiryWorkspace(), items, entry());
  for (const event of ws.movements) {
    delete event.referenceId;
    delete event.beforeMilli;
    delete event.afterMilli;
  }
  assert.doesNotThrow(() => readExpiryWorkspace(JSON.stringify(ws)));
  const counted = countExpiry(
    ws,
    [{ lotId: "lot-1", expectedMilli: 20000, countedMilli: 15000 }],
    "Henrique",
    "Contagem",
  );
  for (const mutation of [
    (w) => w.movements.at(-1).beforeMilli++,
    (w) => w.movements.at(-1).afterMilli++,
    (w) => w.movements.at(-1).quantityMilli++,
    (w) => delete w.movements.at(-1).afterMilli,
  ]) {
    const broken = structuredClone(counted);
    mutation(broken);
    assert.throws(() => readExpiryWorkspace(JSON.stringify(broken)));
  }
});
test("prioridade usa vencimento mais próximo com saldo, ignora vencidos e bloqueia consumo vencido", () => {
  const ws = registerExpiryBatch(emptyExpiryWorkspace(), items, [
    entry({ expiresOn: "2026-10-21" }),
    entry({ id: "lot-2", batch: "B", expiresOn: "2026-10-22" }),
    entry({ id: "lot-3", batch: "C", expiresOn: "2026-11-01" }),
  ]);
  assert.equal(expiryFirstToUse(ws, "item-1", "2026-10-22").id, "lot-2");
  const input = {
    lotId: "lot-1",
    quantityMilli: 1000,
    actor: "Henrique",
    reason: "Vencimento",
    today: "2026-10-22",
  };
  assert.throws(
    () => debitExpiry(ws, { ...input, kind: "Consumo" }),
    /vencido/,
  );
  const discarded = debitExpiry(ws, { ...input, kind: "Descarte" });
  assert.equal(discarded.lots[0].remainingMilli, 19000);
  assert.doesNotThrow(() => readExpiryWorkspace(JSON.stringify(discarded)));
});

test("capa agrupa lotes do mesmo material, soma 900 KG e prioriza a validade com 120 KG", () => {
  const ws = registerExpiryBatch(emptyExpiryWorkspace(), items, [
    entry({ quantityMilli: 120000, expiresOn: "2027-09-10" }),
    entry({
      id: "lot-2",
      batch: "B",
      quantityMilli: 300000,
      expiresOn: "2027-09-30",
    }),
    entry({
      id: "lot-3",
      batch: "C",
      quantityMilli: 480000,
      expiresOn: "2028-08-19",
    }),
  ]);
  const before = JSON.stringify(ws);
  const groups = groupExpiryLots(ws);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].totalMilli, 900000n);
  assert.equal(groups[0].nearest.id, "lot-1");
  assert.equal(groups[0].nearestMilli, 120000n);
  assert.equal(groups[0].lots.length, 3);
  assert.equal(JSON.stringify(ws), before);
});
test("capa soma lotes da mesma data e ignora lotes zerados na prioridade, sem misturar materiais ou unidades", () => {
  const ws = registerExpiryBatch(emptyExpiryWorkspace(), items, [
    entry(),
    entry({ id: "lot-2", batch: "B" }),
    entry({ id: "lot-3", batch: "C", expiresOn: "2027-03-10" }),
  ]);
  let groups = groupExpiryLots(ws);
  assert.equal(groups[0].nearestMilli, 40000n);
  const reduced = countExpiry(
    ws,
    [
      { lotId: "lot-1", expectedMilli: 20000, countedMilli: 0 },
      { lotId: "lot-2", expectedMilli: 20000, countedMilli: 0 },
    ],
    "Henrique",
    "Contagem",
  );
  groups = groupExpiryLots(reduced);
  assert.equal(groups[0].lots.length, 3);
  assert.equal(groups[0].nearest.id, "lot-3");
  assert.equal(groups[0].totalMilli, 20000n);
  const mixed = structuredClone(ws);
  mixed.lots.push(
    { ...ws.lots[0], id: "other", itemId: "item-2" },
    { ...ws.lots[0], id: "legacy", unit: "KG" },
  );
  assert.equal(groupExpiryLots(mixed).length, 3);
  assert.equal(expiryQuantity(-2500), "-2,5");
  assert.equal(expiryQuantity(900000n), "900");
});
test("CSV de lotes e histórico exporta contagens, saldos anterior/atual e protege delimitadores", () => {
  let ws = registerExpiry(emptyExpiryWorkspace(), items, entry());
  ws = countExpiry(
    ws,
    [{ lotId: "lot-1", expectedMilli: 20000, countedMilli: 17500 }],
    "Henrique",
    'Contagem; "conferida"',
  );
  const csv = expiryCsv(ws, items, "history", "2026-10-22");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"Conferência";"2,5";"L";"20";"17,5"/);
  assert.ok(csv.includes('"Contagem; ""conferida"""'));
  const report = expiryCsv(ws, items, "lots", "2026-10-22");
  assert.match(report, /"17,5";"Acima de 30 dias"/);
  assert.ok(report.includes(ws.movements.at(-1).timestamp));
});
