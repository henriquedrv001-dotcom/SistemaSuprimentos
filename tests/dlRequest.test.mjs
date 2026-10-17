import test from "node:test";
import assert from "node:assert/strict";
import {
  dlObservation,
  dlRequestBrief,
  resolveDLRequestStage,
  reviewDLRequest,
  submitDLRequest,
  returnDLRequest,
  reopenDLPlanning,
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
function generating() {
  const plan = planned();
  plan.stage = "Gerar requisição";
  plan.request.mxmNumber = "0000123";
  plan.request.date = "2026-10-17";
  return resolveDLRequestStage(plan);
}
function analysis() {
  return submitDLRequest(generating(), true);
}
function storedGeneration() {
  return storeDLPlan(emptyDLWorkspace(), generating(), "Gerar", "");
}
function storedAnalysis() {
  const first = storedGeneration();
  return storeDLPlan(
    first.workspace,
    submitDLRequest(first.plan, true),
    "Enviado",
    "",
    { submitRequest: true },
  );
}
test("observação unificada conserva ambos os campos legados e espaços durante edição", () => {
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
test("dados anteriores sem entrega permanecem intactos e legíveis", () => {
  const plan = planned();
  delete plan.deliveryDate;
  const workspace = { version: 1, lastNumber: 29, plans: [plan], events: [] };
  const raw = JSON.stringify(workspace);
  assert.equal(JSON.stringify(readDLWorkspace(raw)), raw);
});
test("entrega é exigida na geração, sem bloquear leitura de planejamento anterior", () => {
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
});
test("salvar número e data não envia rascunho automaticamente", () => {
  const first = storedGeneration();
  const saved = storeDLPlan(
    first.workspace,
    { ...first.plan, request: { ...first.plan.request, mxmNumber: "0000999" } },
    "Rascunho",
    "",
  );
  assert.equal(saved.plan.stage, "Gerar requisição");
  assert.equal(saved.plan.request.mxmNumber, "0000999");
  assert.equal(saved.plan.requestSubmission, undefined);
  const partial = storeDLPlan(
    saved.workspace,
    { ...saved.plan, request: { ...saved.plan.request, date: "" } },
    "Parcial",
    "",
  );
  assert.equal(partial.plan.stage, "Gerar requisição");
  assert.throws(() => submitDLRequest(partial.plan, true), /Preencha/);
});
test("envio explícito registra os identificadores e bloqueia a geração", () => {
  const first = storedGeneration();
  assert.throws(() => submitDLRequest(first.plan, false), /Confirme/);
  const candidate = submitDLRequest(first.plan, true);
  assert.throws(
    () => storeDLPlan(first.workspace, candidate, "Enviar", ""),
    /Enviar para análise/,
  );
  const saved = storeDLPlan(first.workspace, candidate, "Enviado", "", {
    submitRequest: true,
  });
  assert.equal(saved.plan.stage, "Analisar requisição gerada");
  assert.equal(saved.plan.requestSubmission.mxmNumber, "0000123");
  assert.equal(saved.plan.requestWorkflow, "mxm-review-v2");
  assert.throws(() => submitDLRequest(saved.plan, true), /bloqueada/);
});
test("após enviar, nem número nem data podem ser alterados", () => {
  const saved = storedAnalysis();
  for (const patch of [{ mxmNumber: "0000999" }, { date: "2026-10-18" }]) {
    assert.throws(
      () =>
        storeDLPlan(
          saved.workspace,
          { ...saved.plan, request: { ...saved.plan.request, ...patch } },
          "Alterar",
          "",
        ),
      /bloqueada/,
    );
  }
  assert.throws(
    () =>
      storeDLPlan(
        saved.workspace,
        { ...saved.plan, stage: "Gerar requisição" },
        "Voltar",
        "",
      ),
    /Devolva/,
  );
});
test("devolução exige observação e somente então libera correção e novo envio", () => {
  const sent = storedAnalysis();
  assert.throws(() => returnDLRequest(sent.plan, "   "), /observação/);
  const candidate = returnDLRequest(sent.plan, "Corrigir a unidade no MXM");
  assert.throws(
    () => storeDLPlan(sent.workspace, candidate, "Devolver", ""),
    /Devolva/,
  );
  const returned = storeDLPlan(sent.workspace, candidate, "Devolvido", "", {
    returnRequest: true,
  });
  assert.equal(returned.plan.stage, "Gerar requisição");
  assert.equal(returned.plan.requestReturn.reason, "Corrigir a unidade no MXM");
  assert.equal(returned.plan.request.mxmNumber, "0000123");
  const corrected = storeDLPlan(
    returned.workspace,
    {
      ...returned.plan,
      request: { ...returned.plan.request, mxmNumber: "0000456" },
    },
    "Corrigido",
    "",
  );
  assert.equal(corrected.plan.stage, "Gerar requisição");
  const resent = storeDLPlan(
    corrected.workspace,
    submitDLRequest(corrected.plan, true),
    "Reenviado",
    "",
    { submitRequest: true },
  );
  assert.equal(resent.plan.requestSubmission.mxmNumber, "0000456");
  assert.equal(resent.plan.stage, "Analisar requisição gerada");
  assert.equal(resent.plan.requestReturn.reason, "Corrigir a unidade no MXM");
  assert.equal(resent.workspace.events.length, 5);
});
test("aprovação é explícita e encerra a análise em Em processo", () => {
  const sent = storedAnalysis();
  assert.throws(() => reviewDLRequest(sent.plan, false), /Confirme/);
  const approved = reviewDLRequest(sent.plan, true);
  assert.throws(
    () => storeDLPlan(sent.workspace, approved, "Aprovar", ""),
    /confirmação de análise/,
  );
  const saved = storeDLPlan(sent.workspace, approved, "Aprovado", "", {
    reviewRequest: true,
  });
  assert.equal(saved.plan.stage, "Em processo");
  assert.equal(saved.plan.requestReview.mxmNumber, "0000123");
  assert.equal(saved.plan.requestReview.requestDate, "2026-10-17");
  assert.throws(
    () => returnDLRequest(saved.plan, "Corrigir"),
    /aguardando análise/,
  );
  assert.throws(
    () =>
      storeDLPlan(
        saved.workspace,
        {
          ...saved.plan,
          request: { ...saved.plan.request, mxmNumber: "outro" },
        },
        "Editar",
        "",
      ),
    /bloqueada/,
  );
});
test("todas as informações do planejamento ficam bloqueadas depois de fechar", () => {
  const first = storeDLPlan(emptyDLWorkspace(), planned(), "Concluído", "");
  for (const key of [
    "title",
    "category",
    "openedOn",
    "responsible",
    "justification",
    "notes",
    "deliveryDate",
  ])
    assert.throws(
      () =>
        storeDLPlan(
          first.workspace,
          { ...first.plan, [key]: "Alterado" },
          "Alterar",
          "",
        ),
      /planejamento está fechado/,
    );
  const changed = structuredClone(first.plan);
  changed.lines[0].quantityMilli = 99;
  assert.throws(
    () => storeDLPlan(first.workspace, changed, "Alterar", ""),
    /planejamento está fechado/,
  );
});
test("reabertura explícita libera dados e exige novo envio e análise", () => {
  const sent = storedAnalysis();
  const approved = storeDLPlan(
    sent.workspace,
    reviewDLRequest(sent.plan, true),
    "Aprovado",
    "",
    { reviewRequest: true },
  );
  assert.throws(() => reopenDLPlanning(approved.plan, false), /Confirme/);
  const candidate = reopenDLPlanning(approved.plan, true);
  assert.throws(
    () => storeDLPlan(approved.workspace, candidate, "Reabrir", ""),
    /Reabrir planejamento/,
  );
  const reopened = storeDLPlan(approved.workspace, candidate, "Reaberto", "", {
    reopenPlanning: true,
  });
  assert.equal(reopened.plan.stage, "Em planejamento");
  assert.equal(reopened.plan.requestReview, undefined);
  assert.equal(reopened.plan.requestSubmission, undefined);
  assert.equal(reopened.plan.request.mxmNumber, "0000123");
  const edited = storeDLPlan(
    reopened.workspace,
    { ...reopened.plan, title: "Novo objeto" },
    "Editado",
    "",
  );
  assert.equal(edited.plan.title, "Novo objeto");
  const closed = storeDLPlan(
    edited.workspace,
    { ...edited.plan, stage: "Planejamento concluído" },
    "Fechado",
    "",
  );
  const start = storeDLPlan(
    closed.workspace,
    { ...closed.plan, stage: "Gerar requisição" },
    "Gerar",
    "",
    { startRequest: true },
  );
  assert.equal(start.plan.requestSubmission, undefined);
  assert.equal(start.plan.stage, "Gerar requisição");
});
test("não é possível saltar análise diretamente para contratação", () => {
  const sent = storedAnalysis();
  assert.throws(
    () =>
      storeDLPlan(
        sent.workspace,
        { ...sent.plan, stage: "Aguardando dados finais" },
        "Pular",
        "",
      ),
    /Analise/,
  );
  assert.throws(
    () => releaseDLPlan(sent.plan, true, "CONCLUIR"),
    /Conclua o planejamento/,
  );
  assert.throws(
    () => validateDLPlan({ ...sent.plan, stage: "Em processo" }),
    /Confirme a análise/,
  );
});
test("informações para MXM usam os mesmos itens e não criam tarefas", () => {
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
test("situações anteriores continuam válidas sem inventar análise retroativa", () => {
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
test("fluxo aprovado segue à contratação e conclusão sem duplicar a DL", () => {
  const initial = storedAnalysis();
  const reviewed = storeDLPlan(
    initial.workspace,
    reviewDLRequest(initial.plan, true),
    "Aprovado",
    "",
    { reviewRequest: true },
  );
  const candidate = {
    ...reviewed.plan,
    stage: "Aguardando dados finais",
    contract: {
      awards: [
        {
          id: "award-confirmed",
          lineId: reviewed.plan.lines[0].id,
          supplier: "Fornecedor",
          supplierReference: "",
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
  const result = storeDLPlan(reviewed.workspace, candidate, "Contratação", "");
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
  assert.throws(() => reopenDLPlanning(finished.plan, true), /protegida/);
});
test("metadados de envio e devolução não podem ser falsamente editados pela gravação comum", () => {
  const sent = storedAnalysis();
  assert.throws(
    () =>
      storeDLPlan(
        sent.workspace,
        {
          ...sent.plan,
          requestSubmission: { ...sent.plan.requestSubmission, actor: "Outro" },
        },
        "Editar",
        "",
      ),
    /registro de envio/,
  );
  const partial = {
    ...sent.plan,
    stage: "Gerar requisição",
    requestReturn: {
      timestamp: new Date().toISOString(),
      actor: "Sessão local",
      reason: "",
      mxmNumber: "0000123",
      requestDate: "2026-10-17",
    },
  };
  assert.throws(() => validateDLPlan(partial), /observação/);
});
