import { dlOrderDocuments } from "../src/services/dlOrderDocuments.ts";
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
  registerDLOrder,
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

test("vários anexos registram Pedido gerado e fecham o processo sem liberar saldo", () => {
  const p = fixture();
  const documents = [
    doc(),
    { ...doc(), name: "Página 2.png", type: "image/png" },
  ];
  const next = registerDLOrder(p, documents);
  const saved = storeDLPlan(workspace(p), next, "Pedido gerado", "", {
    processAction: "registerOrder",
  });
  assert.equal(saved.plan.stage, "Pedido gerado");
  assert(saved.plan.processFlow.orderRegistered.timestamp);
  assert.deepEqual(dlOrderDocuments(saved.plan), documents);
  assert.deepEqual(contractOrigins(saved.plan), []);
  assert.deepEqual(
    dlOrderDocuments(readDLWorkspace(JSON.stringify(saved.workspace)).plans[0]),
    documents,
  );
  assert(submitDLSuppliers(saved.plan).processFlow.suppliersSubmitted);
});
test("registro preserva anexo antigo e novos anexos mantêm o primeiro fechamento", () => {
  const p = registered();
  const oldDocument = p.processFlow.purchaseOrder;
  const first = storeDLPlan(
    workspace(p),
    registerDLOrder(p, [doc()]),
    "Registrado",
    "",
    { processAction: "registerOrder" },
  );
  assert.deepEqual(first.plan.processFlow.purchaseOrder, oldDocument);
  assert.equal(dlOrderDocuments(first.plan).length, 2);
  const second = storeDLPlan(
    first.workspace,
    registerDLOrder(first.plan, [doc()]),
    "Novo anexo",
    "",
    { processAction: "registerOrder" },
  );
  assert.equal(dlOrderDocuments(second.plan).length, 3);
  assert.deepEqual(
    second.plan.processFlow.orderRegistered,
    first.plan.processFlow.orderRegistered,
  );
  assert.throws(
    () => registerDLOrder(submitDLSuppliers(second.plan), [doc()]),
    /antes do envio/,
  );
});
test("não fecha sem anexos nem muda o status sem registrar; não permite apagar anexos anteriores", () => {
  const p = fixture();
  assert.throws(() => registerDLOrder(p, []), /ao menos um/);
  const registeredPlan = registerDLOrder(p, [doc()]);
  assert.throws(
    () => storeDLPlan(workspace(p), registeredPlan, "Status manual", ""),
    /Use Registrar pedido/,
  );
  const dropped = registerDLOrder(registeredPlan, [doc()]);
  dropped.processFlow.purchaseOrders.shift();
  assert.throws(
    () =>
      storeDLPlan(workspace(registeredPlan), dropped, "Apagar", "", {
        processAction: "registerOrder",
      }),
    /Preserve os anexos/,
  );
});
test("reabertura mantém anexos mas exige registrar novamente antes do novo envio dos fornecedores", () => {
  const p = registerDLOrder(fixture(), [doc(), doc()]);
  const reopened = reopenDLPlanning(p, true);
  const saved = storeDLPlan(workspace(p), reopened, "Reaberto", "", {
    reopenPlanning: true,
  });
  assert.equal(dlOrderDocuments(saved.plan).length, 2);
  const reviewed = { ...saved.plan, stage: "Aguardando dados finais" };
  assert.throws(() => submitDLSuppliers(reviewed), /fechar o processo/);
  const registeredAgain = registerDLOrder(reviewed, []);
  assert.equal(registeredAgain.stage, "Pedido gerado");
  assert.equal(dlOrderDocuments(registeredAgain).length, 2);
  assert(submitDLSuppliers(registeredAgain).processFlow.suppliersSubmitted);
});
