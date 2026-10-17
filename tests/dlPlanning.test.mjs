import test from "node:test";
import assert from "node:assert/strict";
import {
  addDLItems,
  decimalInput,
  emptyDLWorkspace,
  newDLPlan,
  nextDLNumber,
  parseScaledInput,
  planBudget,
  readDLWorkspace,
  storeDLPlan,
  validateDLPlan,
} from "../src/services/dlPlanning.ts";
const draft = {
  title: "Aquisição de alimentos",
  category: "Gêneros",
  openedOn: "2026-10-17",
  responsible: "Henrique",
  justification: "",
  notes: "",
};
const items = ["a", "b", "c"].map((id) => ({
  id,
  code: `000${id}`,
  description: id,
  unit: "KG",
  active: true,
}));
function fullPlan() {
  const plan = addDLItems(newDLPlan(emptyDLWorkspace(), draft), items, [
    "a",
    "b",
    "c",
  ]).plan;
  plan.lines.forEach((line, i) => {
    line.quantityMilli = [90000, 90000, 100000][i];
    line.estimatedPriceCents = [500, 250, 300][i];
  });
  return plan;
}
test("numeração começa em 29, cancelamento de formulário não consome número e registro cancelado não reutiliza", () => {
  let workspace = emptyDLWorkspace();
  assert.equal(newDLPlan(workspace, draft).code, "DL-0029");
  assert.equal(newDLPlan(workspace, draft).code, "DL-0029");
  workspace = storeDLPlan(
    workspace,
    { ...fullPlan(), stage: "Cancelado", notes: "Sem necessidade" },
    "Cancelado",
    "Motivo",
  ).workspace;
  assert.equal(nextDLNumber(workspace), 30);
  assert.equal(newDLPlan(workspace, draft).code, "DL-0030");
});
test("quantidades e moedas calculadas sem erros de ponto flutuante", () => {
  assert.equal(planBudget(fullPlan().lines).totalCents, 97500);
  assert.equal(parseScaledInput("1,125", 3, "Qtd"), 1125);
  assert.equal(parseScaledInput("0.10", 2, "Preço"), 10);
  assert.equal(decimalInput(1125, 3), "1,125");
  assert.equal(
    planBudget([{ quantityMilli: 1125, estimatedPriceCents: 10 }]).totalCents,
    11,
  );
});
test("rascunho distingue branco de zero, conclusão exige orçamento completo", () => {
  const plan = addDLItems(newDLPlan(emptyDLWorkspace(), draft), items, [
    "a",
  ]).plan;
  assert.equal(planBudget(plan.lines).incomplete, 1);
  validateDLPlan(plan);
  assert.throws(
    () => validateDLPlan({ ...plan, stage: "Planejamento concluído" }),
    /Complete/,
  );
  plan.lines[0].quantityMilli = 0;
  assert.throws(() => validateDLPlan(plan), /maiores que zero/);
  plan.lines[0].quantityMilli = 1000;
  plan.lines[0].estimatedPriceCents = 0;
  validateDLPlan({ ...plan, stage: "Planejamento concluído" });
});
test("decimal inválido e excesso de precisão ou limite não passam", () => {
  for (const value of [
    "-1",
    "1.000,00",
    "1e5",
    "abc",
    "1,2345",
    "9007199254740992",
  ])
    assert.throws(() => parseScaledInput(value, 3, "Qtd"));
  assert.equal(parseScaledInput("", 3, "Qtd"), null);
  assert.throws(
    () =>
      planBudget([
        {
          quantityMilli: Number.MAX_SAFE_INTEGER,
          estimatedPriceCents: Number.MAX_SAFE_INTEGER,
        },
      ]),
    /limite/,
  );
});
test("inclusão preserva identidade, unidade e personalizações sem duplicar", () => {
  const plan = fullPlan();
  const result = addDLItems(
    plan,
    [...items, { id: "off", unit: "UN", active: false }],
    ["a", "a", "off", "missing"],
  );
  assert.equal(result.added.length, 0);
  assert.equal(result.plan.lines.length, 3);
  assert.equal(result.plan.lines[0].quantityMilli, 90000);
  assert.equal(result.plan.lines[0].unit, "KG");
  assert.throws(
    () =>
      addDLItems(
        plan,
        [{ id: "d", code: "004", unit: "", active: true }],
        ["d"],
      ),
    /sem unidade/,
  );
});
test("histórico, revisão e número protegidos ao salvar", () => {
  const first = storeDLPlan(
    emptyDLWorkspace(),
    fullPlan(),
    "Criado",
    "Materiais",
  );
  const second = storeDLPlan(
    first.workspace,
    { ...first.plan, title: "Novo título" },
    "Alterado",
    "Objeto",
  );
  assert.equal(second.plan.revision, 2);
  assert.equal(second.workspace.events.length, 2);
  assert.throws(
    () => storeDLPlan(second.workspace, first.plan, "Antigo", ""),
    /mudou/,
  );
  assert.throws(
    () =>
      storeDLPlan(
        first.workspace,
        { ...first.plan, code: "DL-0999" },
        "Número",
        "",
      ),
    /mudou/,
  );
});
test("planejamento finalizado bloqueia edição de orçamento até reabrir", () => {
  const first = storeDLPlan(
    emptyDLWorkspace(),
    { ...fullPlan(), stage: "Planejamento concluído" },
    "Concluído",
    "",
  );
  const changed = structuredClone(first.plan);
  changed.lines[0].quantityMilli = 10;
  assert.throws(
    () => storeDLPlan(first.workspace, changed, "Editar", ""),
    /Reabra/,
  );
  storeDLPlan(
    first.workspace,
    { ...first.plan, stage: "Em planejamento" },
    "Reaberto",
    "",
    { reopenPlanning: true },
  );
});
test("tramitação requer dados MXM e cancelamento exige motivo", () => {
  const plan = fullPlan();
  assert.throws(
    () => validateDLPlan({ ...plan, stage: "Em tramitação" }),
    /número e a data/,
  );
  validateDLPlan({
    ...plan,
    stage: "Em tramitação",
    request: { ...plan.request, mxmNumber: "00123", date: "2026-10-17" },
  });
  assert.throws(
    () => validateDLPlan({ ...plan, stage: "Cancelado" }),
    /motivo/,
  );
  assert.throws(
    () => validateDLPlan({ ...plan, openedOn: "2026-02-30" }),
    /data/,
  );
});
test("leitura rejeita dados corrompidos e preserva sequência de registros salvos", () => {
  const saved = storeDLPlan(emptyDLWorkspace(), fullPlan(), "Criado", "");
  assert.deepEqual(
    readDLWorkspace(JSON.stringify(saved.workspace)),
    saved.workspace,
  );
  assert.throws(() => readDLWorkspace("{"));
  assert.throws(
    () =>
      readDLWorkspace(
        JSON.stringify({ ...saved.workspace, plans: [saved.plan, saved.plan] }),
      ),
    /repetidos/,
  );
  assert.equal("balances" in saved.workspace, false);
});
