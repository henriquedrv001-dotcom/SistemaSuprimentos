import test from "node:test";
import assert from "node:assert/strict";
import {
  initialPreviewFlows,
  startPreviewFlow,
  advancePreviewFlow,
  returnPreviewFlow,
  previewSteps,
} from "../src/services/taskPreview.ts";
test("esboço encaminha requisição do aprendiz ao estoque e depois à compradora", () => {
  const original = initialPreviewFlows()[0],
    before = JSON.stringify(original);
  assert.equal(previewSteps[original.stage].role, "aprendiz");
  assert.throws(() => advancePreviewFlow(original), /Inicie/);
  const analysis = advancePreviewFlow(startPreviewFlow(original));
  assert.equal(analysis.state, "review");
  assert.equal(previewSteps[analysis.stage].role, "estoque");
  const purchase = advancePreviewFlow(analysis);
  assert.equal(purchase.state, "todo");
  assert.equal(previewSteps[purchase.stage].role, "compradora");
  assert.equal(JSON.stringify(original), before);
});
test("devolução exige motivo e retorna a etapa correta ao perfil executor", () => {
  const analysis = advancePreviewFlow(
    startPreviewFlow(initialPreviewFlows()[0]),
  );
  assert.throws(() => returnPreviewFlow(analysis, " "), /observação/);
  const correction = returnPreviewFlow(analysis, " Corrigir quantidade ");
  assert.equal(correction.stage, 1);
  assert.equal(correction.state, "todo");
  assert.equal(correction.returnNote, "Corrigir quantidade");
  assert.equal(previewSteps[correction.stage].role, "aprendiz");
  const again = advancePreviewFlow(startPreviewFlow(correction));
  assert.equal(again.returnNote, undefined);
  assert.equal(again.stage, 2);
  const approval = initialPreviewFlows()[2],
    suppliers = returnPreviewFlow(approval, "Conferir fornecedor");
  assert.equal(suppliers.stage, 4);
  assert.equal(previewSteps[suppliers.stage].role, "aprendiz");
});
test("aprovação encerra somente o exemplo e concluído não avança ou reabre", () => {
  const approval = initialPreviewFlows()[2],
    done = advancePreviewFlow(approval);
  assert.equal(done.stage, 5);
  assert.equal(done.state, "done");
  assert.equal(advancePreviewFlow(done), done);
  assert.equal(startPreviewFlow(done), done);
  assert.throws(() => returnPreviewFlow(done, "Refazer"), /devolução/);
  assert.equal(approval.state, "review");
});
test("reiniciar produz exemplos independentes e identificados como demonstração", () => {
  const a = initialPreviewFlows(),
    b = initialPreviewFlows();
  a[0].object = "Alterado";
  assert.notEqual(a[0].object, b[0].object);
  assert(b.every((flow) => flow.reference.startsWith("EXEMPLO ")));
  assert.deepEqual(
    [...new Set(b.map((flow) => previewSteps[flow.stage].role))].sort(),
    ["aprendiz", "compradora", "estoque"],
  );
});
