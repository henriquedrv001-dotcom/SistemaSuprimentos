import test from "node:test";
import assert from "node:assert/strict";
import {
  dlActivityType,
  dlActivitySummary,
  dlActivityDetails,
  dlActivityDate,
} from "../src/services/dlActivity.ts";
import { dlProcessProgress } from "../src/services/dlProgress.ts";
import { newDLPlan, emptyDLWorkspace } from "../src/services/dlPlanning.ts";
const event = (action) => ({
  id: "e",
  planId: "p",
  action,
  details: "",
  actor: "Henrique",
  timestamp: "2026-10-17T18:00:00Z",
});
test("histórico diferencia envio pendente de aprovação efetiva e reconhece associação a pedido", () => {
  assert.equal(
    dlActivityType("Fornecedores enviados para aprovação"),
    "submission",
  );
  assert.equal(
    dlActivityType("Requisição aprovada e enviada para processo"),
    "approval",
  );
  assert.equal(
    dlActivityType("DL concluída e disponibilizada no Controle"),
    "approval",
  );
  assert.equal(dlActivityType("Associação a pedido PDL-0030"), "order");
  assert.equal(dlActivityType("Anexos do pedido adicionados"), "attachment");
  assert.equal(
    dlActivityType("Fornecedores devolvidos para correção"),
    "return",
  );
  assert.equal(dlActivityType("Planejamento concluído"), "planning");
  assert.equal(dlActivityType("Cronograma atualizado"), "schedule");
  assert.equal(dlActivityType("Ação desconhecida"), "other");
});
test("resumos não exibem snapshots JSON nem atribuem aprovação a um envio", () => {
  assert.match(
    dlActivitySummary(event("Fornecedores enviados para aprovação")),
    /enviados/i,
  );
  assert.match(
    dlActivitySummary(event("DL concluída e disponibilizada no Controle")),
    /saldos iniciais liberados/,
  );
  assert.equal(
    dlActivitySummary(
      event("Fornecedores devolvidos para correção: Rever o item 4"),
    ),
    "Rever o item 4",
  );
  assert.equal(
    dlActivitySummary(event("Pedido registrado: Documento.pdf")),
    "Pedido de compra registrado.",
  );
});
test("snapshots antigos viram detalhes legíveis sem regravar os eventos", () => {
  const before = { version: 1, justification: { text: "Texto antigo" } };
  const after = {
    version: 1,
    justification: {
      text: "Novo texto → complemento",
      completedAt: "2026-10-17T18:00:00Z",
    },
    purchaseOrders: [{ id: "doc-123", name: "Pedido.pdf" }],
    orderRegistered: { timestamp: "2026-10-17T18:00:00Z", actor: "Compradora" },
    suppliersSubmitted: {
      timestamp: "2026-10-17T19:00:00Z",
      actor: "Aprendiz",
    },
  };
  const details = `Situação: Em processo → Pedido gerado\nEtapas do processo: ${JSON.stringify(before)} → ${JSON.stringify(after)}`;
  const original = structuredClone({ before, after, details });
  const lines = dlActivityDetails(details);
  assert.deepEqual(
    dlActivityDetails(
      details.replace("Etapas do processo:", "Etapes do processo:"),
    ),
    lines,
  );
  assert(lines.some((line) => line === "Anexo adicionado: Pedido.pdf."));
  assert(lines.some((line) => line.includes("Novo texto → complemento")));
  assert(lines.some((line) => line.includes("Compradora")));
  assert(lines.some((line) => line.includes("Aprendiz")));
  assert(
    lines.every(
      (line) => !line.includes('"version"') && !line.includes("doc-123"),
    ),
  );
  assert.deepEqual({ before, after, details }, original);
});
test("detalhes desconhecidos e registros incompletos continuam disponíveis", () => {
  const text = "Etapas do processo: formato antigo não reconhecido";
  assert.deepEqual(dlActivityDetails(text), [text]);
  assert.equal(dlActivityDate("data inválida"), "Data não informada");
  assert.deepEqual(dlActivityDetails(""), []);
});
function plan() {
  return newDLPlan(emptyDLWorkspace(), {
    title: "Materiais",
    category: "Teste",
    openedOn: "2026-10-17",
    responsible: "Solicitante",
    justification: "",
    notes: "",
  });
}
test("avanço segue as confirmações reais e retorna ao fornecedor quando devolvido", () => {
  const p = plan();
  p.stage = "Gerar requisição";
  assert.equal(dlProcessProgress(p).current, 1);
  p.stage = "Analisar requisição gerada";
  p.requestSubmission = {
    timestamp: "2026-10-17T18:00:00Z",
    actor: "Aprendiz",
    mxmNumber: "1",
    requestDate: "2026-10-17",
  };
  assert.equal(dlProcessProgress(p).steps[1].state, "completed");
  assert.equal(dlProcessProgress(p).steps[2].state, "current");
  p.stage = "Em processo";
  p.requestReview = { ...p.requestSubmission };
  assert.equal(dlProcessProgress(p).current, 3);
  p.stage = "Pedido gerado";
  p.contract = { signedOn: "2026-10-17" };
  p.processFlow = {
    version: 1,
    purchaseOrders: [{ id: "d", name: "Pedido.pdf" }],
  };
  assert.equal(dlProcessProgress(p).current, 4);
  p.processFlow.suppliersSubmitted = {
    timestamp: "2026-10-17T18:00:00Z",
    actor: "Aprendiz",
  };
  assert.equal(dlProcessProgress(p).current, 5);
  delete p.processFlow.suppliersSubmitted;
  assert.equal(dlProcessProgress(p).current, 4);
});
test("avanço não inventa justificativa ou análise para dados legados concluídos", () => {
  const p = plan();
  p.stage = "Concluído";
  p.contract = { release: { timestamp: "2026-10-17T18:00:00Z" } };
  const progress = dlProcessProgress(p);
  assert.equal(progress.label, "DL concluída");
  assert.equal(progress.current, -1);
  assert.equal(progress.steps[0].state, "pending");
  assert.equal(progress.steps[2].state, "pending");
  assert.equal(progress.steps[5].state, "completed");
  p.stage = "Cancelado";
  delete p.contract;
  assert.equal(dlProcessProgress(p).current, -1);
});
