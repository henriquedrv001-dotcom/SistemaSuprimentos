import test from "node:test";
import assert from "node:assert/strict";
import {
  awardTotal,
  contractTotal,
  contractOrigins,
  contractedQuantity,
  contractStatus,
  emptyDLContract,
  releaseDLPlan,
  validateDLContract,
} from "../src/services/dlContract.ts";
import {
  addDLItems,
  emptyDLWorkspace,
  newDLPlan,
  planBudget,
  readDLWorkspace,
  storeDLPlan,
  validateDLPlan,
} from "../src/services/dlPlanning.ts";
function planWithResult(workspace = emptyDLWorkspace()) {
  const plan = addDLItems(
    newDLPlan(workspace, {
      title: "Gêneros",
      category: "Alimentos",
      openedOn: "2026-10-17",
      responsible: "Henrique",
      justification: "",
      notes: "",
    }),
    ["a", "b", "c"].map((id) => ({ id, code: id, unit: "KG", active: true })),
    ["a", "b", "c"],
  ).plan;
  plan.stage = "Aguardando dados finais";
  plan.request = {
    ...plan.request,
    mxmNumber: "00123",
    date: "2026-10-17",
    officialDLNumber: "DL-MXM-005",
  };
  plan.lines.forEach((line, i) => {
    line.quantityMilli = [90000, 90000, 100000][i];
    line.estimatedPriceCents = [500, 250, 300][i];
  });
  plan.contract = {
    ...emptyDLContract(),
    signedOn: "2026-10-17",
    awards: plan.lines.map((line, i) => ({
      id: `award-${crypto.randomUUID()}`,
      lineId: line.id,
      supplier: i === 2 ? "Fornecedor B" : "Fornecedor A",
      supplierReference: i === 2 ? "002" : "001",
      mxmOrder: i === 2 ? "000222" : "000111",
      orderDate: "2026-10-17",
      quantityMilli: [90000, 90000, 100000][i],
      unitPriceCents: [480, 230, 285][i],
    })),
  };
  return plan;
}
test("valores finais preservam orçamento original e não criam origem antes da confirmação", () => {
  const plan = planWithResult();
  assert.equal(planBudget(plan.lines).totalCents, 97500);
  assert.equal(contractTotal(plan.contract).totalCents, 92400);
  assert.deepEqual(contractOrigins(plan), []);
  assert.equal(plan.lines[0].estimatedPriceCents, 500);
  validateDLPlan(plan);
});
test("um fornecedor por item e uma única origem por contratação", () => {
  const plan = planWithResult();
  plan.contract.awards.push({
    ...plan.contract.awards[0],
    id: crypto.randomUUID(),
    supplier: "Outro fornecedor",
  });
  assert.throws(() => validateDLContract(plan), /única contratação/);
});
test("quantidade e preço finais diferentes do previsto são preservados", () => {
  const plan = planWithResult();
  plan.contract.awards[0].quantityMilli = 115500;
  plan.contract.awards[0].unitPriceCents = 525;
  validateDLContract(plan, true);
  assert.equal(contractedQuantity(plan.contract, plan.lines[0].id), 115500);
  assert.equal(awardTotal(plan.contract.awards[0]), 60638);
  assert.equal(plan.lines[0].quantityMilli, 90000);
});
test("conclusão exige conferência e texto exato", () => {
  const plan = planWithResult();
  assert.throws(() => releaseDLPlan(plan, false, "CONCLUIR"), /Confirme/);
  assert.throws(() => releaseDLPlan(plan, true, "concluir"), /Confirme/);
  const released = releaseDLPlan(plan, true, "CONCLUIR");
  assert.equal(released.stage, "Concluído");
  assert.match(released.contract.release.reference, /000111, 000222/);
  assert.equal(contractOrigins(released).length, 3);
  assert.equal(contractOrigins(plan).length, 0);
});
test("todos os dados oficiais são exigidos antes da liberação", () => {
  for (const key of [
    "supplier",
    "supplierReference",
    "mxmOrder",
    "orderDate",
  ]) {
    const plan = planWithResult();
    plan.contract.awards[0][key] = "";
    assert.throws(() => releaseDLPlan(plan, true, "CONCLUIR"), /Complete/);
  }
  for (const key of ["quantityMilli", "unitPriceCents"]) {
    const plan = planWithResult();
    plan.contract.awards[0][key] = null;
    assert.throws(() => releaseDLPlan(plan, true, "CONCLUIR"), /Complete/);
  }
  const plan = planWithResult();
  plan.request.officialDLNumber = "";
  assert.equal(releaseDLPlan(plan, true, "CONCLUIR").stage, "Concluído");
  plan.request.mxmNumber = "";
  assert.throws(() => releaseDLPlan(plan, true, "CONCLUIR"), /requisição MXM/);
  plan.request.mxmNumber = "000123";
  plan.contract.signedOn = "";
  assert.throws(() => releaseDLPlan(plan, true, "CONCLUIR"), /data da contratação/);
});
test("rascunho de resultado aceita campos em branco e preço zero explícito", () => {
  const plan = planWithResult();
  plan.contract.awards[0] = {
    ...plan.contract.awards[0],
    supplier: "",
    quantityMilli: null,
    unitPriceCents: null,
  };
  validateDLPlan(plan);
  assert.equal(contractTotal(plan.contract).incomplete, 1);
  const other = planWithResult();
  other.contract.awards[0].unitPriceCents = 0;
  validateDLContract(other, true);
});
test("material sem resultado bloqueia; não contratado exige motivo e nunca gera saldo", () => {
  const plan = planWithResult();
  const removed = plan.contract.awards.pop();
  assert.throws(() => validateDLContract(plan, true), /todos os materiais/);
  plan.contract.notAwarded.push({ lineId: removed.lineId, reason: "" });
  assert.throws(() => validateDLContract(plan, true), /motivo/);
  plan.contract.notAwarded[0].reason = "Item deserto";
  const released = releaseDLPlan(plan, true, "CONCLUIR");
  assert.equal(contractOrigins(released).length, 2);
  assert.equal(plan.lines.length, 3);
});
test("material não pode ser contratado e não contratado ao mesmo tempo", () => {
  const plan = planWithResult();
  plan.contract.notAwarded = [{ lineId: plan.lines[0].id, reason: "Deserto" }];
  assert.throws(() => validateDLContract(plan), /mesmo material/);
});
test("processo sem contratação não é liberado como saldo zero", () => {
  const plan = planWithResult();
  plan.contract.awards = [];
  plan.contract.notAwarded = plan.lines.map((line) => ({
    lineId: line.id,
    reason: "Deserto",
  }));
  assert.throws(
    () => releaseDLPlan(plan, true, "CONCLUIR"),
    /Não há contratação/,
  );
});
test("vigência aceita não aplicável, valida intervalo e sinaliza futuro e vencimento", () => {
  const plan = planWithResult();
  validateDLContract(plan, true);
  plan.contract.validFrom = "2026-11-01";
  assert.throws(() => validateDLContract(plan), /início e fim/);
  plan.contract.validUntil = "2026-10-01";
  assert.throws(() => validateDLContract(plan), /anterior/);
  plan.contract.validUntil = "2026-12-31";
  const released = releaseDLPlan(plan, true, "CONCLUIR");
  assert.equal(contractStatus(released, "2026-10-17"), "Vigência futura");
  assert.equal(contractStatus(released, "2026-11-01"), "Ativa");
  assert.equal(contractStatus(released, "2026-12-15"), "Vence em até 30 dias");
  assert.equal(contractStatus(released, "2026-12-31"), "Vence em até 30 dias");
  assert.equal(contractStatus(released, "2027-01-01"), "Vigência encerrada");
});
test("saldo inicial mantém origem, unidade e quantidade contratada, sem copiar orçamento", () => {
  const released = releaseDLPlan(planWithResult(), true, "CONCLUIR");
  const origin = contractOrigins(released)[0];
  assert.equal(origin.quantityMilli, 90000);
  assert.equal(origin.unit, "KG");
  assert.equal(origin.mxmOrder, "000111");
  assert.equal(origin.unitPriceCents, 480);
  assert.equal(origin.availableMilli, 90000);
  assert.equal(origin.receivedMilli, 0);
  assert.equal(origin.reservedMilli, 0);
});
test("conclusão repetida e edição posterior não duplicam nem alteram origem", () => {
  const plan = planWithResult();
  const saved = storeDLPlan(emptyDLWorkspace(), plan, "Criado", "");
  const candidate = releaseDLPlan(saved.plan, true, "CONCLUIR");
  assert.throws(
    () => storeDLPlan(saved.workspace, candidate, "Concluído", ""),
    /confirmação/,
  );
  const released = storeDLPlan(saved.workspace, candidate, "Concluído", "", {
    release: true,
  });
  assert.throws(
    () => releaseDLPlan(released.plan, true, "CONCLUIR"),
    /já foi concluída/,
  );
  const changed = structuredClone(released.plan);
  changed.contract.awards[0].quantityMilli = 10;
  assert.throws(
    () => storeDLPlan(released.workspace, changed, "Alterado", ""),
    /protegida/,
  );
  assert.equal(released.workspace.plans.length, 1);
});
test("leitura de dados antigos permanece compatível e conclusão corrompida é bloqueada", () => {
  const plan = planWithResult();
  delete plan.contract;
  const saved = storeDLPlan(emptyDLWorkspace(), plan, "Criado", "");
  assert.equal(
    readDLWorkspace(JSON.stringify(saved.workspace)).plans[0].contract,
    undefined,
  );
  const broken = structuredClone(saved.workspace);
  broken.plans[0].stage = "Concluído";
  assert.throws(() => readDLWorkspace(JSON.stringify(broken)), /resultados/);
});
test("pedidos MXM de fornecedores diferentes e referências ausentes são rejeitados", () => {
  const plan = planWithResult();
  plan.contract.awards[2].mxmOrder = "000111";
  assert.throws(() => validateDLContract(plan), /fornecedores diferentes/);
  const other = planWithResult();
  other.contract.awards[0].lineId = "missing";
  assert.throws(() => validateDLContract(other), /material ausente/);
});
test("valores inválidos e excesso de capacidade não são salvos", () => {
  for (const key of ["quantityMilli", "unitPriceCents"]) {
    const plan = planWithResult();
    plan.contract.awards[0][key] = -1;
    assert.throws(() => validateDLContract(plan));
  }
  const plan = planWithResult();
  plan.contract.awards[0].quantityMilli = Number.MAX_SAFE_INTEGER;
  plan.contract.awards[0].unitPriceCents = Number.MAX_SAFE_INTEGER;
  assert.throws(() => validateDLContract(plan), /limite/);
});
test("origens do mesmo material em DLs distintas são independentes", () => {
  const first = storeDLPlan(
    emptyDLWorkspace(),
    planWithResult(),
    "Primeiro",
    "",
  );
  const second = planWithResult(first.workspace);
  const a = contractOrigins(releaseDLPlan(first.plan, true, "CONCLUIR"))[0];
  const b = contractOrigins(releaseDLPlan(second, true, "CONCLUIR"))[0];
  assert.equal(a.itemId, b.itemId);
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.planId, b.planId);
});
test("liberação bloqueada enquanto planejamento está em edição ou cancelado", () => {
  for (const stage of [
    "Rascunho",
    "Em planejamento",
    "Cancelado",
    "Suspenso",
    "Não contratado",
  ])
    assert.throws(
      () => releaseDLPlan({ ...planWithResult(), stage }, true, "CONCLUIR"),
      /Conclua o planejamento/,
    );
});
