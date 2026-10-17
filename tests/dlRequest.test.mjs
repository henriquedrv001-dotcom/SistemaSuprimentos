import test from "node:test";
import assert from "node:assert/strict";
import {
  dlObservation,
  dlRequestBrief,
  resolveDLRequestStage,
  reviewDLRequest,
} from "../src/services/dlRequest.ts";
import {
  addDLItems,
  emptyDLWorkspace,
  newDLPlan,
  readDLWorkspace,
  storeDLPlan,
  validateDLPlan,
} from "../src/services/dlPlanning.ts";
import { releaseDLPlan } from "../src/services/dlContract.ts";
const item = {
  id: "sugar",
  code: "000001",
  description: "AÇÚCAR",
  unit: "KG",
  technicalSpecification: "Cristal",
  active: true,
};
function planned() {
  const plan = addDLItems(
    newDLPlan(emptyDLWorkspace(), {
      title: "Gêneros",
      category: "Alimentos",
      openedOn: "2026-10-17",
      deliveryDate: "2026-11-05",
      responsible: "Henrique",
      justification: "Reposição de materiais",
      notes: "Observação antiga",
    }),
    [item],
    [item.id],
  ).plan;
  plan.lines[0].quantityMilli = 1125;
  plan.lines[0].estimatedPriceCents = 500;
  plan.stage = "Planejamento concluído";
  return plan;
}
function analysis() {
  const plan = planned();
  plan.stage = "Gerar requisição";
  plan.request.mxmNumber = "0000123";
  plan.request.date = "2026-10-17";
  return resolveDLRequestStage(plan);
}
test("observação unificada conserva ambos os campos legados, sem duplicar e sem impedir espaços durante edição", () => {
  assert.equal(
    dlObservation({ justification: "Texto", notes: "Antigo" }),
    "Texto\n\nAntigo",
  );
  assert.equal(
    dlObservation({ justification: "Texto", notes: "Texto" }),
    "Texto",
  );
  assert.equal(dlObservation({ justification: "", notes: "Antigo" }), "Antigo");
  assert.equal(
    dlObservation({ justification: "Texto novo ", notes: "" }),
    "Texto novo ",
  );
  assert.equal(
    dlObservation({ justification: "Texto\n", notes: "" }),
    "Texto\n",
  );
});
test("dados anteriores sem entrega permanecem legíveis e não são regravados na leitura", () => {
  const plan = planned();
  delete plan.deliveryDate;
  const workspace = { version: 1, lastNumber: 29, plans: [plan], events: [] };
  const original = JSON.stringify(workspace);
  const restored = readDLWorkspace(original);
  assert.equal(JSON.stringify(restored), original);
  assert.equal(restored.plans[0].notes, "Observação antiga");
  assert.equal(restored.plans[0].deliveryDate, undefined);
});
test("data de entrega opcional em rascunho e exigida ao preparar requisição", () => {
  const plan = planned();
  delete plan.deliveryDate;
  validateDLPlan(plan);
  assert.throws(
    () => validateDLPlan({ ...plan, stage: "Gerar requisição" }),
    /data de entrega/,
  );
  assert.throws(
    () => validateDLPlan({ ...plan, deliveryDate: "2026-02-30" }),
    /entrega válida/,
  );
  validateDLPlan({
    ...plan,
    stage: "Gerar requisição",
    deliveryDate: "2026-11-05",
  });
});
test("número preenchido em Gerar requisição passa automaticamente à análise com zeros preservados", () => {
  const first = storeDLPlan(
    emptyDLWorkspace(),
    { ...planned(), stage: "Gerar requisição" },
    "Gerar",
    "",
  );
  const candidate = {
    ...first.plan,
    request: {
      ...first.plan.request,
      mxmNumber: "0000123",
      date: "2026-10-17",
    },
  };
  const saved = storeDLPlan(
    first.workspace,
    candidate,
    "Requisição preenchida",
    "",
  );
  assert.equal(saved.plan.stage, "Analisar requisição gerada");
  assert.equal(saved.plan.request.mxmNumber, "0000123");
  assert.equal(saved.plan.requestWorkflow, "mxm-review-v1");
  assert.equal(first.plan.stage, "Gerar requisição");
});
test("número sem data e análise sem número são rejeitados", () => {
  const plan = analysis();
  assert.throws(
    () => validateDLPlan({ ...plan, request: { ...plan.request, date: "" } }),
    /número e a data/,
  );
  assert.throws(
    () =>
      validateDLPlan({ ...plan, request: { ...plan.request, mxmNumber: "" } }),
    /número e a data/,
  );
});
test("Em processo depende de confirmação manual e mantém registro de análise", () => {
  const plan = analysis();
  const first = storeDLPlan(emptyDLWorkspace(), plan, "Analisar", "");
  assert.throws(() => reviewDLRequest(first.plan, false), /Confirme/);
  const reviewed = reviewDLRequest(first.plan, true);
  assert.throws(
    () => storeDLPlan(first.workspace, reviewed, "Revisado", ""),
    /confirmação de análise/,
  );
  const saved = storeDLPlan(first.workspace, reviewed, "Revisado", "", {
    reviewRequest: true,
  });
  assert.equal(saved.plan.stage, "Em processo");
  assert.equal(saved.plan.requestReview.mxmNumber, "0000123");
  assert.equal(saved.plan.requestReview.requestDate, "2026-10-17");
  assert.match(saved.plan.requestReview.actor, /Sessão local/);
});
test("alterar número ou data após aprovação invalida análise e devolve à conferência", () => {
  const reviewed = reviewDLRequest(analysis(), true);
  for (const patch of [{ mxmNumber: "0000999" }, { date: "2026-10-18" }]) {
    const changed = resolveDLRequestStage(
      { ...reviewed, request: { ...reviewed.request, ...patch } },
      reviewed,
    );
    assert.equal(changed.stage, "Analisar requisição gerada");
    assert.equal(changed.requestReview, undefined);
    validateDLPlan(changed);
  }
  const cleared = resolveDLRequestStage(
    { ...reviewed, request: { ...reviewed.request, mxmNumber: "", date: "" } },
    reviewed,
  );
  assert.equal(cleared.stage, "Gerar requisição");
  validateDLPlan(cleared);
});
test("não é possível saltar análise diretamente para contratação", () => {
  const first = storeDLPlan(emptyDLWorkspace(), analysis(), "Analisar", "");
  assert.throws(
    () =>
      storeDLPlan(
        first.workspace,
        { ...first.plan, stage: "Aguardando dados finais" },
        "Pular",
        "",
      ),
    /Analise/,
  );
  assert.throws(
    () => releaseDLPlan(first.plan, true, "CONCLUIR"),
    /Conclua o planejamento/,
  );
  assert.throws(
    () => validateDLPlan({ ...first.plan, stage: "Em processo" }),
    /Confirme a análise/,
  );
});
test("mudança do pedido na etapa de dados finais também devolve à análise", () => {
  const reviewed = {
    ...reviewDLRequest(analysis(), true),
    stage: "Aguardando dados finais",
  };
  const result = resolveDLRequestStage(
    { ...reviewed, request: { ...reviewed.request, mxmNumber: "0000444" } },
    reviewed,
  );
  assert.equal(result.stage, "Analisar requisição gerada");
  assert.equal(result.requestReview, undefined);
});
test("informações para MXM usam vínculos centrais, especificação, unidade e quantidade exatas; não criam tarefas", () => {
  const plan = planned();
  const original = JSON.stringify(plan);
  const brief = dlRequestBrief(plan, [item]);
  assert.equal(
    brief.observation,
    "Reposição de materiais\n\nObservação antiga",
  );
  assert.equal(brief.deliveryDate, "2026-11-05");
  assert.equal(brief.items[0].code, "000001");
  assert.equal(brief.items[0].unit, "KG");
  assert.equal(brief.items[0].quantityMilli, 1125);
  assert.equal(brief.items[0].technicalSpecification, "Cristal");
  assert.equal(JSON.stringify(plan), original);
  assert.equal("tasks" in brief, false);
});
test("situações antigas continuam válidas sem inventar análise ou destinatários", () => {
  const plan = planned();
  delete plan.deliveryDate;
  plan.request.mxmNumber = "123";
  plan.request.date = "2026-10-17";
  for (const stage of [
    "Requisição registrada",
    "Em tramitação",
    "Aguardando dados finais",
  ]) {
    const legacy = { ...plan, stage };
    validateDLPlan(legacy);
    assert.equal(resolveDLRequestStage(legacy).stage, stage);
    assert.equal(legacy.requestReview, undefined);
  }
});
test("observação unificada pode justificar cancelamento, mas espaço em branco não basta", () => {
  const plan = planned();
  validateDLPlan({ ...plan, stage: "Cancelado", notes: "" });
  assert.throws(
    () =>
      validateDLPlan({
        ...plan,
        stage: "Cancelado",
        justification: "   ",
        notes: "",
      }),
    /motivo/,
  );
});

test("fluxo aprovado segue aos dados finais e conclusão sem recriar a DL", () => {
  const initial = storeDLPlan(
    emptyDLWorkspace(),
    analysis(),
    "Requisição gerada",
    "",
  );
  const reviewed = storeDLPlan(
    initial.workspace,
    reviewDLRequest(initial.plan, true),
    "Análise confirmada",
    "",
    { reviewRequest: true },
  );
  const candidate = {
    ...reviewed.plan,
    stage: "Aguardando dados finais",
    request: { ...reviewed.plan.request, officialDLNumber: "DL-MXM-0007" },
    contract: {
      awards: [
        {
          id: "award-confirmed",
          lineId: reviewed.plan.lines[0].id,
          supplier: "Fornecedor",
          supplierReference: "001",
          mxmOrder: "0000700",
          orderDate: "2026-10-17",
          quantityMilli: 1125,
          unitPriceCents: 480,
        },
      ],
      notAwarded: [],
      signedOn: "2026-10-17",
      validFrom: "",
      validUntil: "",
      notes: "",
    },
  };
  const result = storeDLPlan(
    reviewed.workspace,
    candidate,
    "Contratação informada",
    "",
  );
  const finished = storeDLPlan(
    result.workspace,
    releaseDLPlan(result.plan, true, "CONCLUIR"),
    "Concluído",
    "",
    { release: true },
  );
  assert.equal(finished.plan.stage, "Concluído");
  assert.equal(finished.plan.id, initial.plan.id);
  assert.equal(finished.workspace.plans.length, 1);
  assert.equal(finished.plan.requestReview.mxmNumber, "0000123");
  assert.equal(finished.plan.deliveryDate, "2026-11-05");
});
