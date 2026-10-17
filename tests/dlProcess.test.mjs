import test from "node:test";
import assert from "node:assert/strict";
import {
  newDLPlan,
  emptyDLWorkspace,
  addDLItems,
  storeDLPlan,
  readDLWorkspace,
} from "../src/services/dlPlanning.ts";
import {
  emptyDLContract,
  releaseDLPlan,
  contractOrigins,
} from "../src/services/dlContract.ts";
import {
  processFlow,
  submitDLSuppliers,
  returnDLSuppliers,
} from "../src/services/dlProcess.ts";
import { reopenDLPlanning } from "../src/services/dlRequest.ts";
function fixture() {
  let plan = addDLItems(
    newDLPlan(emptyDLWorkspace(), {
      title: "Administrativo",
      category: "Materiais",
      openedOn: "2026-10-17",
      responsible: "Solicitante",
      justification: "Reposição",
      notes: "",
    }),
    [{ id: "a", code: "00001", unit: "KG", active: true }],
    ["a"],
  ).plan;
  plan.stage = "Aguardando dados finais";
  plan.request.mxmNumber = "000123";
  plan.request.date = "2026-10-17";
  plan.lines[0].quantityMilli = 1200;
  plan.lines[0].estimatedPriceCents = 100;
  plan.contract = {
    ...emptyDLContract(),
    signedOn: "2026-10-17",
    awards: [
      {
        id: "award-1",
        lineId: plan.lines[0].id,
        supplier: "Fornecedor",
        supplierReference: "",
        mxmOrder: "000987",
        orderDate: "2026-10-17",
        quantityMilli: 1200,
        unitPriceCents: 80,
      },
    ],
  };
  return plan;
}
const doc = () => ({
  id: crypto.randomUUID(),
  name: "Pedido MXM.pdf",
  type: "application/pdf",
  size: 100,
  timestamp: new Date().toISOString(),
  actor: "Sessão local",
});
function registered() {
  const p = fixture();
  p.processFlow = { version: 1, purchaseOrder: doc() };
  return p;
}
function workspace(plan) {
  return { ...emptyDLWorkspace(), lastNumber: 29, plans: [plan] };
}
test("pedido registrado e dados preenchidos não criam saldos; só aprovação final libera uma origem", () => {
  const p = registered();
  assert.deepEqual(contractOrigins(p), []);
  const sent = storeDLPlan(workspace(p), submitDLSuppliers(p), "Enviado", "", {
    processAction: "submitSuppliers",
  });
  assert.deepEqual(contractOrigins(sent.plan), []);
  const done = storeDLPlan(
    sent.workspace,
    releaseDLPlan(sent.plan, true, "CONCLUIR"),
    "Aprovado",
    "",
    { release: true },
  );
  assert.equal(contractOrigins(done.plan).length, 1);
  assert.equal(done.plan.lines[0].estimatedPriceCents, 100);
  assert.equal(
    readDLWorkspace(JSON.stringify(done.workspace)).plans[0].processFlow
      .purchaseOrder.name,
    "Pedido MXM.pdf",
  );
  assert.throws(
    () => releaseDLPlan(done.plan, true, "CONCLUIR"),
    /já foi concluída/,
  );
});
test("pedido ausente ou resultados incompletos bloqueiam envio e conclusão", () => {
  const p = fixture();
  p.processFlow = { version: 1 };
  assert.throws(() => submitDLSuppliers(p), /pedido anexado/);
  assert.throws(() => releaseDLPlan(p, true, "CONCLUIR"), /pedido/);
  p.processFlow.purchaseOrder = doc();
  p.contract.awards[0].supplier = "";
  assert.throws(() => submitDLSuppliers(p), /fornecedor/i);
});
test("envio congela fornecedores, valores e anexo até devolução com motivo", () => {
  const sent = submitDLSuppliers(registered());
  const ws = workspace(sent);
  const edited = structuredClone(sent);
  edited.contract.awards[0].supplier = "Outro";
  assert.throws(() => storeDLPlan(ws, edited, "Editar", ""), /bloqueados/);
  const replaced = structuredClone(sent);
  replaced.processFlow.purchaseOrder = doc();
  assert.throws(
    () =>
      storeDLPlan(ws, replaced, "Trocar anexo", "", {
        processAction: "registerOrder",
      }),
    /pedido só pode/,
  );
  assert.throws(() => returnDLSuppliers(sent, "   "), /observação/);
  const back = storeDLPlan(
    ws,
    returnDLSuppliers(sent, "Corrigir preço"),
    "Devolvido",
    "",
    { processAction: "returnSuppliers" },
  );
  assert.equal(back.plan.processFlow.suppliersSubmitted, undefined);
  assert.equal(back.plan.processFlow.suppliersReturn.reason, "Corrigir preço");
  const fixed = structuredClone(back.plan);
  fixed.contract.awards[0].unitPriceCents = 70;
  const saved = storeDLPlan(back.workspace, fixed, "Correção", "");
  const again = submitDLSuppliers(saved.plan);
  assert(again.processFlow.suppliersSubmitted);
  assert.equal(
    again.processFlow.purchaseOrder.id,
    sent.processFlow.purchaseOrder.id,
  );
});
test("justificativa própria não altera observação MXM, e fica bloqueada após envio", () => {
  const p = fixture();
  p.stage = "Planejamento concluído";
  p.contract = undefined;
  const next = {
    ...p,
    processFlow: {
      version: 1,
      justification: {
        text: "Texto físico",
        completedAt: new Date().toISOString(),
      },
    },
  };
  const saved = storeDLPlan(workspace(p), next, "Justificativa", "", {
    processAction: "justification",
  });
  assert.equal(saved.plan.justification, "Reposição");
  const locked = fixture();
  locked.processFlow = next.processFlow;
  assert.throws(
    () =>
      storeDLPlan(
        workspace(locked),
        {
          ...locked,
          processFlow: {
            ...locked.processFlow,
            justification: { text: "Outro" },
          },
        },
        "Editar",
        "",
        { processAction: "justification" },
      ),
    /justificativa está bloqueada/,
  );
});
test("reabrir invalida aprovação de fornecedores e mantém documento, orçamento e dados finais", () => {
  const p = submitDLSuppliers(registered());
  const reopened = reopenDLPlanning(p, true);
  const saved = storeDLPlan(workspace(p), reopened, "Reaberto", "", {
    reopenPlanning: true,
  });
  assert.equal(saved.plan.processFlow.suppliersSubmitted, undefined);
  assert.deepEqual(
    saved.plan.processFlow.purchaseOrder,
    p.processFlow.purchaseOrder,
  );
  assert.deepEqual(saved.plan.contract, p.contract);
  assert.throws(() => submitDLSuppliers(saved.plan), /pedido anexado/);
});
test("ações de etapas não podem alterar outros campos nem forjar aprovação", () => {
  const p = registered();
  const next = {
    ...p,
    title: "Alterado",
    processFlow: { ...processFlow(p), purchaseOrder: doc() },
  };
  assert.throws(
    () =>
      storeDLPlan(workspace(p), next, "Troca", "", {
        processAction: "registerOrder",
      }),
    /demais dados/,
  );
  const sent = submitDLSuppliers(p);
  assert.throws(
    () => storeDLPlan(workspace(p), sent, "Envio sem ação", ""),
    /ação da etapa/,
  );
  const forged = structuredClone(releaseDLPlan(sent, true, "CONCLUIR"));
  forged.contract.awards[0].unitPriceCents = 999;
  assert.throws(
    () =>
      storeDLPlan(workspace(sent), forged, "Aprovado", "", { release: true }),
    /preservar os fornecedores/,
  );
});
test("arquivo inválido é rejeitado e registros antigos continuam legíveis sem exigir anexos retroativos", () => {
  const p = registered();
  p.processFlow.purchaseOrder.size = 21 * 1024 * 1024;
  assert.throws(
    () => readDLWorkspace(JSON.stringify(workspace(p))),
    /Documento do pedido inválido/,
  );
  const legacy = fixture();
  const finished = releaseDLPlan(legacy, true, "CONCLUIR");
  assert.equal(
    readDLWorkspace(JSON.stringify(workspace(finished))).plans[0].stage,
    "Concluído",
  );
});
