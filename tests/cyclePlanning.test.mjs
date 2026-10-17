import test from "node:test";
import assert from "node:assert/strict";
import {
  addPlanningItems,
  applyGroupTemplate,
  editPlanningLine,
  emptyCycleWorkspace,
  readCycleWorkspace,
  removePlanningItems,
  removeRequestGroup,
  saveGroupTemplate,
  saveRequestGroup,
  validateCycle,
  writeLocalTransaction,
} from "../src/services/cyclePlanning.ts";
const cycle = (id = "nov") => ({
  id,
  name: id,
  solicitationStart: "2026-10-01",
  firstDelivery: "2026-11-01",
  lastDelivery: "2026-11-30",
  closingDate: "2026-12-10",
  status: "Planejamento",
});
const items = [
  {
    id: "a",
    code: "00001",
    description: "AÇÚCAR",
    active: true,
    group: "GRUPO MXM",
    unit: "KG",
  },
  {
    id: "b",
    code: "00002",
    description: "ARROZ",
    active: true,
    group: "OUTRO GRUPO MXM",
    unit: "KG",
  },
  { id: "c", code: "00003", description: "INATIVO", active: false },
];
const cycles = [cycle(), cycle("dez")];

test("permite vários ciclos abertos, nomes únicos e cronologia válida", () => {
  assert.equal(validateCycle(cycle("jan"), cycles).name, "jan");
  assert.throws(() => validateCycle(cycle(), cycles), /Já existe/);
  assert.throws(
    () => validateCycle({ ...cycle("x"), lastDelivery: "2026-10-01" }, cycles),
    /ordem/,
  );
  assert.throws(
    () => validateCycle({ ...cycle("x"), firstDelivery: "2026-02-30" }, cycles),
    /válidos/,
  );
  assert.equal(validateCycle(cycle(), cycles, "nov").name, "nov");
});
test("adição é idempotente no mesmo ciclo, mas permite o item em ciclos simultâneos", () => {
  const first = addPlanningItems(
    emptyCycleWorkspace(),
    cycles,
    items,
    "nov",
    ["a", "a", "b"],
    null,
  );
  assert.equal(first.added.length, 2);
  assert.equal(first.workspace.lines[0].plannedQuantity, null);
  const again = addPlanningItems(
    first.workspace,
    cycles,
    items,
    "nov",
    ["a"],
    null,
  );
  assert.equal(again.duplicateCount, 1);
  assert.equal(again.workspace.lines.length, 2);
  const second = addPlanningItems(
    first.workspace,
    cycles,
    items,
    "dez",
    ["a"],
    null,
  );
  assert.equal(second.workspace.lines.length, 3);
});
test("itens inativos/ausentes não entram e seleção não altera o cadastro", () => {
  const before = structuredClone(items);
  const result = addPlanningItems(
    emptyCycleWorkspace(),
    cycles,
    items,
    "nov",
    ["a", "c", "missing"],
    null,
  );
  assert.equal(result.unavailableCount, 2);
  assert.deepEqual(items, before);
});
test("A definir é diferente de zero, aceita decimal e rejeita números inválidos", () => {
  const workspace = addPlanningItems(
    emptyCycleWorkspace(),
    cycles,
    items,
    "nov",
    ["a"],
    null,
  ).workspace;
  const line = workspace.lines[0];
  assert.equal(line.plannedQuantity, null);
  for (const plannedQuantity of [0, 2.5, null])
    assert.equal(
      editPlanningLine(workspace, cycles, { ...line, plannedQuantity }).lines[0]
        .plannedQuantity,
      plannedQuantity,
    );
  for (const plannedQuantity of [-1, NaN, Infinity])
    assert.throws(
      () => editPlanningLine(workspace, cycles, { ...line, plannedQuantity }),
      /quantidade/,
    );
});
test("grupos de solicitação são próprios de cada ciclo e não alteram grupos MXM", () => {
  const before = structuredClone(items);
  const group = saveRequestGroup(
    emptyCycleWorkspace(),
    cycles,
    "nov",
    "Gêneros",
  );
  assert.throws(
    () => saveRequestGroup(group.workspace, cycles, "nov", " generos "),
    /Já existe/,
  );
  assert.doesNotThrow(() =>
    saveRequestGroup(group.workspace, cycles, "dez", "Gêneros"),
  );
  assert.throws(
    () =>
      addPlanningItems(
        group.workspace,
        cycles,
        items,
        "dez",
        ["a"],
        group.group.id,
      ),
    /não pertence/,
  );
  assert.deepEqual(items, before);
});
test("excluir grupo mantém materiais e quantidades no ciclo, sem grupo", () => {
  const group = saveRequestGroup(
    emptyCycleWorkspace(),
    cycles,
    "nov",
    "Gêneros",
  );
  let workspace = addPlanningItems(
    group.workspace,
    cycles,
    items,
    "nov",
    ["a"],
    group.group.id,
  ).workspace;
  workspace = editPlanningLine(workspace, cycles, {
    ...workspace.lines[0],
    plannedQuantity: 150,
  });
  const result = removeRequestGroup(workspace, cycles, "nov", group.group.id);
  assert.equal(result.lines[0].plannedQuantity, 150);
  assert.equal(result.lines[0].requestGroupId, null);
  assert.equal(result.lines.length, 1);
});
test("modelo reutiliza composição sem quantidades e mantém ciclos independentes", () => {
  const group = saveRequestGroup(
    emptyCycleWorkspace(),
    cycles,
    "nov",
    "Gêneros",
  );
  let workspace = addPlanningItems(
    group.workspace,
    cycles,
    items,
    "nov",
    ["a", "b"],
    group.group.id,
  ).workspace;
  workspace = editPlanningLine(workspace, cycles, {
    ...workspace.lines[0],
    plannedQuantity: 150,
  });
  workspace = saveGroupTemplate(workspace, "Gêneros", ["a", "b"]);
  const applied = applyGroupTemplate(
    workspace,
    cycles,
    items,
    "dez",
    workspace.templates[0].id,
  );
  assert.equal(applied.added.length, 2);
  assert.ok(
    applied.workspace.lines
      .filter((line) => line.cycleId === "dez")
      .every((line) => line.plannedQuantity === null),
  );
  const removed = removePlanningItems(
    applied.workspace,
    cycles,
    "dez",
    applied.workspace.lines
      .filter((line) => line.cycleId === "dez")
      .map((line) => line.id),
  );
  assert.equal(
    removed.workspace.lines.filter((line) => line.cycleId === "nov").length,
    2,
  );
  assert.equal(workspace.templates[0].itemIds.length, 2);
});
test("aplicar modelo preserva grupo e quantidade de materiais que já estavam no ciclo", () => {
  let workspace = addPlanningItems(
    emptyCycleWorkspace(),
    cycles,
    items,
    "nov",
    ["a"],
    null,
  ).workspace;
  workspace = editPlanningLine(workspace, cycles, {
    ...workspace.lines[0],
    plannedQuantity: 80,
  });
  workspace = saveGroupTemplate(workspace, "Gêneros", [
    "a",
    "b",
    "c",
    "missing",
  ]);
  const result = applyGroupTemplate(
    workspace,
    cycles,
    items,
    "nov",
    workspace.templates[0].id,
  );
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.unavailableCount, 2);
  assert.equal(result.workspace.lines[0].plannedQuantity, 80);
  assert.equal(result.workspace.lines[0].requestGroupId, null);
});
test("substituir um modelo exige confirmação explícita e não altera ciclos existentes", () => {
  let workspace = addPlanningItems(
    emptyCycleWorkspace(),
    cycles,
    items,
    "nov",
    ["a"],
    null,
  ).workspace;
  workspace = saveGroupTemplate(workspace, "Gêneros", ["a"]);
  assert.throws(
    () => saveGroupTemplate(workspace, "Gêneros", ["b"]),
    /Confirme/,
  );
  const updated = saveGroupTemplate(workspace, "Gêneros", ["b"], true);
  assert.deepEqual(updated.templates[0].itemIds, ["b"]);
  assert.deepEqual(updated.lines, workspace.lines);
});
test("remoção é limitada ao ciclo e protege materiais com pedidos vinculados", () => {
  let workspace = addPlanningItems(
    emptyCycleWorkspace(),
    cycles,
    items,
    "nov",
    ["a"],
    null,
  ).workspace;
  workspace = addPlanningItems(
    workspace,
    cycles,
    items,
    "dez",
    ["b"],
    null,
  ).workspace;
  const result = removePlanningItems(
    workspace,
    cycles,
    "nov",
    workspace.lines.map((line) => line.id),
  );
  assert.equal(result.workspace.lines.length, 1);
  assert.equal(result.workspace.lines[0].cycleId, "dez");
  workspace = {
    ...workspace,
    lines: workspace.lines.map((line) => ({
      ...line,
      orderReferences: ["order-test"],
    })),
  };
  assert.throws(
    () =>
      removePlanningItems(workspace, cycles, "nov", [workspace.lines[0].id]),
    /pedidos associados/,
  );
  assert.throws(
    () =>
      editPlanningLine(workspace, cycles, {
        ...workspace.lines[0],
        plannedQuantity: 100,
      }),
    /pedidos vinculados/,
  );
});
test("ciclo encerrado precisa ser reaberto para alterar materiais", () => {
  const closed = [{ ...cycle(), status: "Encerrado" }];
  assert.throws(
    () =>
      addPlanningItems(
        emptyCycleWorkspace(),
        closed,
        items,
        "nov",
        ["a"],
        null,
      ),
    /Reabra/,
  );
  assert.throws(
    () => saveRequestGroup(emptyCycleWorkspace(), closed, "nov", "Gêneros"),
    /Reabra/,
  );
});
test("leitura preserva esquema e bloqueia dados inválidos/duplicados", () => {
  assert.deepEqual(readCycleWorkspace(null), emptyCycleWorkspace());
  assert.throws(() => readCycleWorkspace("invalid"));
  assert.throws(() => readCycleWorkspace('{"version":5}'));
  const workspace = addPlanningItems(
    emptyCycleWorkspace(),
    cycles,
    items,
    "nov",
    ["a"],
    null,
  ).workspace;
  assert.deepEqual(readCycleWorkspace(JSON.stringify(workspace)), workspace);
  assert.throws(
    () =>
      readCycleWorkspace(
        JSON.stringify({
          ...workspace,
          lines: [...workspace.lines, ...workspace.lines],
        }),
      ),
    /duplicados/,
  );
});
test("gravação transacional recupera todas as chaves se uma etapa falhar", () => {
  const map = new Map([
    ["cycles", "old-cycles"],
    ["history", "old-history"],
  ]);
  let fail = true;
  const storage = {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      if (key === "history" && fail) {
        fail = false;
        throw Error("quota");
      }
      map.set(key, value);
    },
    removeItem: (key) => map.delete(key),
  };
  assert.throws(
    () =>
      writeLocalTransaction(storage, [
        ["planning", "new"],
        ["cycles", "new-cycles"],
        ["history", "new-history"],
      ]),
    /desfeitas/,
  );
  assert.equal(map.has("planning"), false);
  assert.equal(map.get("cycles"), "old-cycles");
  assert.equal(map.get("history"), "old-history");
  writeLocalTransaction(storage, [
    ["planning", "new"],
    ["cycles", "new-cycles"],
  ]);
  assert.equal(map.get("cycles"), "new-cycles");
});
