import test from "node:test";
import assert from "node:assert/strict";
import {
  addCalendarMonths,
  addDeliveryDays,
  automaticContractValidity,
  exactValidityMonths,
} from "../src/services/dlDates.ts";
import {
  emptyDLSchedule,
  scheduleDates,
  milestoneStatus,
  validateDLSchedule,
} from "../src/services/dlSchedule.ts";
import {
  emptyDLContract,
  contractOrigins,
  releaseDLPlan,
  validateDLContract,
} from "../src/services/dlContract.ts";
import {
  emptyDLWorkspace,
  newDLPlan,
  addDLItems,
  storeDLPlan,
  readDLWorkspace,
} from "../src/services/dlPlanning.ts";
function draft() {
  return newDLPlan(emptyDLWorkspace(), {
    title: "Gêneros",
    category: "Alimentos",
    openedOn: "2026-10-17",
    responsible: "Henrique",
    justification: "",
    notes: "",
  });
}
function contracted() {
  let plan = addDLItems(
    draft(),
    [{ id: "item", code: "0001", unit: "KG", active: true }],
    ["item"],
  ).plan;
  plan.lines[0].quantityMilli = 1000;
  plan.lines[0].estimatedPriceCents = 500;
  plan.stage = "Aguardando dados finais";
  plan.request.mxmNumber = "00123";
  plan.request.date = "2026-10-01";
  plan.contract = automaticContractValidity({
    ...emptyDLContract(),
    signedOn: "2026-10-17",
    validityMode: "automatic",
    validityMonths: 3,
    awards: [
      {
        id: "award",
        lineId: plan.lines[0].id,
        supplier: "Fornecedor",
        supplierReference: "00001",
        mxmOrder: "00012345",
        orderDate: "2026-10-17",
        quantityMilli: 1000,
        unitPriceCents: 480,
      },
    ],
  });
  return plan;
}
test("vigência por meses segue aniversário e ajusta fim de mês e ano bissexto", () => {
  assert.equal(addCalendarMonths("2026-10-17", 3), "2027-01-17");
  assert.equal(addCalendarMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addCalendarMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addCalendarMonths("2024-02-29", 12), "2025-02-28");
  assert.equal(addCalendarMonths("2026-12-31", 2), "2027-02-28");
});
test("cálculo rejeita datas inválidas, meses negativos/fracionários e extrapolação", () => {
  for (const value of [0, -1, 1.5, 1201, NaN])
    assert.throws(() => addCalendarMonths("2026-10-17", value));
  assert.throws(() => addCalendarMonths("2026-02-30", 1));
  assert.throws(() => addCalendarMonths("9999-12-31", 1));
});
test("inferência de vigência antiga só aceita um número exato de meses", () => {
  assert.equal(exactValidityMonths("2026-10-17", "2027-01-17"), 3);
  assert.equal(exactValidityMonths("2026-01-31", "2026-02-28"), 1);
  assert.equal(exactValidityMonths("2026-10-17", "2027-01-16"), null);
  assert.equal(exactValidityMonths("", ""), null);
});
test("cálculo automático usa data-base, limpa resultados incompletos e não altera dados manuais", () => {
  const manual = {
    ...emptyDLContract(),
    signedOn: "2026-10-17",
    validFrom: "2026-11-01",
    validUntil: "2027-01-31",
    notes: "Texto antigo",
  };
  assert.equal(automaticContractValidity(manual), manual);
  const auto = automaticContractValidity({
    ...manual,
    validityMode: "automatic",
    validityMonths: 3,
  });
  assert.equal(auto.validFrom, "2026-10-17");
  assert.equal(auto.validUntil, "2027-01-17");
  assert.equal(auto.notes, "Texto antigo");
  assert.equal(manual.validUntil, "2027-01-31");
  const incomplete = automaticContractValidity({
    ...auto,
    validityMonths: null,
  });
  assert.equal(incomplete.validUntil, "");
  assert.equal(incomplete.validFrom, "");
});
test("vigência calculada salva é validada contra alterações manuais e meses inválidos", () => {
  const plan = contracted();
  validateDLContract(plan, true);
  const stale = structuredClone(plan);
  stale.contract.validUntil = "2027-01-18";
  assert.throws(() => validateDLContract(stale), /não correspondem/);
  const invalid = structuredClone(plan);
  invalid.contract.validityMonths = 2.5;
  assert.throws(() => validateDLContract(invalid), /meses inteiros/);
});
test("dez dias úteis excluem fins de semana e dias corridos usam calendário", () => {
  assert.equal(addDeliveryDays("2026-10-17", 10, "calendar"), "2026-10-27");
  assert.equal(addDeliveryDays("2026-10-16", 1, "business"), "2026-10-19");
  assert.equal(addDeliveryDays("2026-10-17", 10, "business"), "2026-10-30");
  assert.equal(addDeliveryDays("2026-10-17", 0, "business"), "2026-10-17");
  assert.throws(() => addDeliveryDays("2026-10-17", -1, "calendar"));
  assert.throws(() => addDeliveryDays("2026-10-17", 10, ""));
});
test("cronograma mantém prazo de processo, abastecimento e vigência separados", () => {
  const plan = contracted();
  plan.schedule = {
    ...emptyDLSchedule(),
    coverageStart: "2026-11-01",
    coverageMonths: 3,
    plannedRequestOn: "2026-09-17",
    deliveryDayBasis: "calendar",
  };
  const dates = scheduleDates(plan);
  assert.equal(dates.coverageEnd, "2027-02-01");
  assert.equal(dates.processDue, "2026-10-17");
  assert.equal(dates.actualProcessDue, "2026-11-01");
  assert.equal(dates.plannedDeliveryDue, "2026-10-27");
  assert.equal(dates.orderDeliveryDue, "2026-10-27");
  assert.equal(dates.validUntil, "2027-01-17");
});
test("quando a requisição real muda, previsão informada permanece fixa", () => {
  const plan = contracted();
  plan.schedule = {
    ...emptyDLSchedule(),
    plannedRequestOn: "2026-10-01",
    deliveryDayBasis: "business",
  };
  const before = scheduleDates(plan);
  plan.request.date = "2026-10-10";
  const after = scheduleDates(plan);
  assert.equal(after.processDue, before.processDue);
  assert.equal(after.plannedDeliveryDue, before.plannedDeliveryDue);
  assert.notEqual(after.actualProcessDue, before.actualProcessDue);
});
test("sem escolha de dias não inventa entrega, mas calcula processo pela requisição real", () => {
  const plan = contracted();
  plan.schedule = emptyDLSchedule();
  const dates = scheduleDates(plan);
  assert.equal(dates.actualProcessDue, "2026-11-01");
  assert.equal(dates.plannedDeliveryDue, "");
  assert.equal(dates.orderDeliveryDue, "");
});
test("indicadores distinguem atraso, realizado e prazo próximo sem impedir gravação", () => {
  assert.equal(milestoneStatus("2026-10-16", "", "2026-10-17"), "Atrasado");
  assert.equal(
    milestoneStatus("2026-10-20", "", "2026-10-17"),
    "Vence em até 3 dias",
  );
  assert.equal(milestoneStatus("2026-11-01", "", "2026-10-17"), "No prazo");
  assert.equal(
    milestoneStatus("2026-10-17", "2026-10-17", "2026-10-17"),
    "Realizado no prazo",
  );
  assert.equal(
    milestoneStatus("2026-10-16", "2026-10-17", "2026-10-17"),
    "Realizado com atraso",
  );
  assert.equal(
    milestoneStatus("", "2026-10-17", "2026-10-17"),
    "Realizado · sem previsão",
  );
  const plan = contracted();
  plan.schedule = { ...emptyDLSchedule(), plannedRequestOn: "2026-01-01" };
  validateDLSchedule(plan);
});
test("cronograma rejeita duração inválida, data impossível e entrega anterior ao pedido", () => {
  const plan = contracted();
  for (const patch of [
    { processMonths: 1.5 },
    { deliveryDays: -1 },
    { coverageStart: "2026-02-30" },
    {
      authorizationRequestedOn: "2026-10-18",
      authorizationGrantedOn: "2026-10-17",
    },
    { deliveredOn: "2026-10-16" },
  ]) {
    plan.schedule = { ...emptyDLSchedule(), ...patch };
    assert.throws(() => validateDLSchedule(plan));
  }
});
test("cronograma de DL concluída pode mudar sem alterar contratação ou origem dos saldos", () => {
  const created = storeDLPlan(emptyDLWorkspace(), contracted(), "Criado", "");
  const done = storeDLPlan(
    created.workspace,
    releaseDLPlan(created.plan, true, "CONCLUIR"),
    "Concluído",
    "",
    { release: true },
  );
  const candidate = {
    ...done.plan,
    schedule: {
      ...emptyDLSchedule(),
      deliveryDayBasis: "calendar",
      deliveredOn: "2026-10-27",
    },
  };
  assert.throws(
    () => storeDLPlan(done.workspace, candidate, "Cronograma", ""),
    /protegida/,
  );
  const changed = storeDLPlan(
    done.workspace,
    candidate,
    "Cronograma",
    "Entrega em 27/10",
    { scheduleOnly: true },
  );
  assert.deepEqual(changed.plan.contract, done.plan.contract);
  assert.deepEqual(contractOrigins(changed.plan), contractOrigins(done.plan));
  assert.equal(changed.plan.schedule.deliveredOn, "2026-10-27");
  assert.equal(changed.workspace.events[0].action, "Cronograma");
  assert.equal(changed.plan.revision, done.plan.revision + 1);
  const unsafe = { ...candidate, title: "Não pode mudar" };
  assert.throws(
    () =>
      storeDLPlan(done.workspace, unsafe, "Mudar", "", { scheduleOnly: true }),
    /protegida/,
  );
});
test("dados antigos sem cronograma ou meses continuam intactos na leitura", () => {
  const plan = contracted();
  delete plan.contract.validityMode;
  delete plan.contract.validityMonths;
  const workspace = { version: 1, lastNumber: 29, plans: [plan], events: [] };
  const restored = readDLWorkspace(JSON.stringify(workspace));
  assert.deepEqual(restored, workspace);
  assert.equal(restored.plans[0].schedule, undefined);
  assert.equal(restored.plans[0].contract.validUntil, "2027-01-17");
});

test("data do pedido compartilhada usa a contratação e identificação do fornecedor deixa de ser obrigatória", () => {
  const plan = contracted();
  plan.contract.orderDatesFromContract = true;
  plan.contract.awards[0].supplierReference = "";
  validateDLContract(plan, true);
  plan.contract.awards[0].orderDate = "2026-10-16";
  assert.throws(() => validateDLContract(plan), /mesma da contratação/);
});
test("atualizar cronograma não autoriza modificar valor ou vigência de contratação concluída", () => {
  const first = storeDLPlan(emptyDLWorkspace(), contracted(), "Criado", "");
  const done = storeDLPlan(
    first.workspace,
    releaseDLPlan(first.plan, true, "CONCLUIR"),
    "Concluído",
    "",
    { release: true },
  );
  for (const mutate of [
    (p) => (p.contract.awards[0].unitPriceCents = 900),
    (p) => (p.contract.validUntil = "2028-01-01"),
  ]) {
    const changed = structuredClone(done.plan);
    changed.schedule = emptyDLSchedule();
    mutate(changed);
    assert.throws(
      () =>
        storeDLPlan(done.workspace, changed, "Cronograma", "", {
          scheduleOnly: true,
        }),
      /protegida/,
    );
  }
});
