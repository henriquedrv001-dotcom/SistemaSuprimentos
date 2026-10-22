import {
  newMovementOrder,
  movementSources,
  saveMovementDraft,
  confirmMovementDistribution,
  recordMovementInvoice,
  recordMovementRequest,
  serveMovementRequest,
  finishMovement,
  cancelMovement,
} from "../src/services/dlMovement.ts";
import {
  movementTotals,
  movementLineCents,
} from "../src/services/dlMovementMath.ts";
import { movementAreaPrintHtml } from "../src/services/dlMovementPrint.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyOrderWorkspace,
  newOrder,
  itemOrderLine,
  originOrderLine,
  orderControlRows,
  orderBalanceUsage,
  saveOrderDraft,
  transitionOrder,
  addManualDLAdjustment,
  removeOrderDraft,
  readOrderWorkspace,
  importLegacyDLOrders,
  orderTotal,
} from "../src/services/orders.ts";
import {
  emptyDLWorkspace,
  newDLPlan,
  addDLItems,
} from "../src/services/dlPlanning.ts";
import { emptyDLContract, releaseDLPlan } from "../src/services/dlContract.ts";

function context() {
  const items = ["a", "b"].map((id) => ({
    id,
    code: `MXM-${id}`,
    description: `Material ${id}`,
    unit: "UN",
    active: true,
    visible: true,
    type: "Administrativo",
    group: "Geral",
    criterion: "Mensal",
  }));
  let plan = addDLItems(
    newDLPlan(emptyDLWorkspace(), {
      title: "Materiais",
      category: "Administrativo",
      openedOn: "2026-10-19",
      responsible: "Henrique",
      justification: "",
      notes: "",
    }),
    items,
    items.map((item) => item.id),
  ).plan;
  plan.request.mxmNumber = "00123";
  plan.request.date = "2026-10-19";
  plan.stage = "Aguardando dados finais";
  plan.lines.forEach((line) => {
    line.quantityMilli = 10000;
    line.estimatedPriceCents = 250;
  });
  plan.contract = {
    ...emptyDLContract(),
    signedOn: "2026-10-19",
    validFrom: "2026-10-19",
    validUntil: "2027-01-19",
    awards: plan.lines.map((line) => ({
      id: `award-${line.itemId}`,
      lineId: line.id,
      supplier: "Fornecedor A",
      supplierReference: "",
      mxmOrder: "00999",
      orderDate: "2026-10-19",
      quantityMilli: 10000,
      unitPriceCents: 250,
    })),
  };
  plan = releaseDLPlan(plan, true, true);
  return {
    items,
    plans: [plan],
    cycles: [{ id: "cycle", name: "Outubro/2026", status: "Em execução" }],
    cycleWorkspace: {
      version: 1,
      lines: [
        {
          id: "cycle-a",
          cycleId: "cycle",
          itemId: "a",
          requestGroupId: null,
          plannedQuantity: 10,
          forecastBasis: "Estimativa",
          notes: "",
        },
      ],
      groups: [],
      templates: [],
    },
    today: "2026-10-19",
  };
}
function draft(kind, ctx, quantity = 8000) {
  const order = newOrder(kind, "Henrique");
  order.cycleId = kind === "PCD" ? "cycle" : "";
  order.reason = "Necessidade urgente";
  order.contractReference = "ATA 45/2026";
  order.supplier = "Fornecedor A";
  order.movement = kind === "MOV" ? "Saída" : "";
  const line =
    kind === "PDL"
      ? originOrderLine(orderControlRows(ctx, emptyOrderWorkspace())[0])
      : itemOrderLine(ctx.items[0]);
  order.lines = [{ ...line, quantityMilli: quantity, unitPriceCents: 250 }];
  return order;
}
const act = (ws, order, action, ctx, extra = {}) =>
  transitionOrder(
    ws,
    order.id,
    action,
    { actor: "Henrique", reason: "Conferido", ...extra },
    ctx,
  );

test("five types complete analysis, approval, send and partial/full receipt without changing original DLs", () => {
  for (const kind of ["PCD", "PFR", "PDL", "ATA", "MOV"]) {
    const ctx = context();
    const before = JSON.stringify(ctx);
    const order = draft(kind, ctx);
    let ws = saveOrderDraft(emptyOrderWorkspace(), order, ctx);
    assert.equal(ws.orders[0].code, "");
    if (kind === "PDL")
      assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 2000);
    ws = act(ws, order, "submit", ctx);
    assert.equal(ws.orders[0].code, `${kind}-0001`);
    ws = act(ws, order, "approve", ctx);
    ws = act(ws, order, "send", ctx);
    ws = act(ws, order, "receive", ctx, {
      quantities: { [order.lines[0].id]: 1500 },
    });
    assert.equal(ws.orders[0].status, "Recebimento parcial");
    ws = act(ws, order, "receive", ctx, {
      quantities: { [order.lines[0].id]: 6500 },
    });
    assert.equal(ws.orders[0].status, "Concluído");
    assert.equal(ws.orders[0].lines[0].receivedMilli, 8000);
    assert.deepEqual(readOrderWorkspace(JSON.stringify(ws)), ws);
    assert.equal(JSON.stringify(ctx), before);
  }
});
test("saving a PDL reserves immediately; editing, removing lines and deleting adjust only its own reserve", () => {
  const ctx = context();
  let order = draft("PDL", ctx, 8000);
  let ws = saveOrderDraft(emptyOrderWorkspace(), order, ctx);
  assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 2000);
  assert.equal(orderControlRows(ctx, ws)[0].origin.receivedMilli, 0);
  const rival = draft("PDL", ctx, 3000);
  const before = JSON.stringify(ws);
  assert.throws(() => saveOrderDraft(ws, rival, ctx), /saldo disponível/);
  assert.equal(JSON.stringify(ws), before);
  order = structuredClone(ws.orders[0]);
  order.lines[0].quantityMilli = 6000;
  ws = saveOrderDraft(ws, order, ctx);
  assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 4000);
  ws = saveOrderDraft(ws, rival, ctx);
  assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 1000);
  ws = removeOrderDraft(ws, rival.id);
  assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 4000);
  ws = act(ws, order, "submit", ctx);
  ws = act(ws, order, "return", ctx);
  assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 4000);
  ws = act(ws, order, "cancel", ctx);
  assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 10000);
});
test("partial delivery consumes only delivered amount; final shortages release only their remaining reserve", () => {
  const ctx = context();
  const order = draft("PDL", ctx);
  order.lines.push({
    ...originOrderLine(orderControlRows(ctx, emptyOrderWorkspace())[1]),
    quantityMilli: 5000,
  });
  let ws = saveOrderDraft(emptyOrderWorkspace(), order, ctx);
  for (const action of ["submit", "approve", "send"])
    ws = act(ws, order, action, ctx);
  ws = act(ws, order, "receive", ctx, {
    quantities: { [order.lines[0].id]: 3000 },
  });
  let rows = orderControlRows(ctx, ws);
  assert.equal(rows[0].origin.reservedMilli, 5000);
  assert.equal(rows[0].origin.receivedMilli, 3000);
  assert.equal(rows[0].origin.availableMilli, 2000);
  assert.equal(rows[1].origin.reservedMilli, 5000);
  ws = act(ws, order, "receive", ctx, {
    quantities: { [order.lines[0].id]: 1000 },
    closePending: true,
  });
  rows = orderControlRows(ctx, ws);
  assert.equal(ws.orders[0].status, "Concluído");
  assert.equal(ws.orders[0].lines[0].unfulfilledMilli, 4000);
  assert.equal(ws.orders[0].lines[1].unfulfilledMilli, 5000);
  assert.equal(rows[0].origin.availableMilli, 6000);
  assert.equal(rows[1].origin.availableMilli, 10000);
  assert.equal(rows[0].origin.reservedMilli, 0);
  assert.equal(rows[1].origin.receivedMilli, 0);
  assert.throws(
    () =>
      act(ws, order, "receive", ctx, {
        quantities: { [order.lines[0].id]: 1 },
      }),
    /envio/,
  );
});
test("zero delivery may be closed as missing; cancel after partial keeps its received quantities", () => {
  const ctx = context();
  const order = draft("PDL", ctx);
  let ws = saveOrderDraft(emptyOrderWorkspace(), order, ctx);
  for (const action of ["submit", "approve", "send"])
    ws = act(ws, order, action, ctx);
  const closed = act(ws, order, "receive", ctx, {
    quantities: {},
    closePending: true,
  });
  assert.equal(closed.orders[0].status, "Concluído");
  assert.equal(orderControlRows(ctx, closed)[0].origin.availableMilli, 10000);
  ws = act(ws, order, "receive", ctx, {
    quantities: { [order.lines[0].id]: 2000 },
  });
  ws = act(ws, order, "cancel", ctx);
  assert.equal(ws.orders[0].lines[0].receivedMilli, 2000);
  assert.equal(ws.orders[0].lines[0].unfulfilledMilli, 6000);
  assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 8000);
});
test("manual debit protects reserved balances, is audited and does not rewrite original contract", () => {
  const ctx = context();
  const order = draft("PDL", ctx);
  let ws = saveOrderDraft(emptyOrderWorkspace(), order, ctx);
  const input = {
    planId: order.lines[0].planId,
    originId: order.lines[0].originId,
    quantityMilli: 3000,
    actor: "Henrique",
    reason: "Consumo fora do PDL",
  };
  assert.throws(() => addManualDLAdjustment(ws, ctx, input), /reservadas/);
  assert.throws(
    () =>
      addManualDLAdjustment(ws, ctx, {
        ...input,
        quantityMilli: 1000,
        reason: "",
      }),
    /justificativa/,
  );
  ws = addManualDLAdjustment(ws, ctx, { ...input, quantityMilli: 1000 });
  const origin = orderControlRows(ctx, ws)[0].origin;
  assert.equal(origin.availableMilli, 1000);
  assert.equal(origin.receivedMilli, 0);
  assert.equal(origin.manualDebitedMilli, 1000);
  assert.equal(ws.adjustments.length, 1);
  assert.equal(ctx.plans[0].contract.awards[0].quantityMilli, 10000);
  assert.deepEqual(readOrderWorkspace(JSON.stringify(ws)), ws);
});
test("receipt rejects excess, invalid precision, unknown lines and duplicate fulfillment", () => {
  const ctx = context();
  const order = draft("PDL", ctx);
  let ws = saveOrderDraft(emptyOrderWorkspace(), order, ctx);
  for (const action of ["submit", "approve", "send"])
    ws = act(ws, order, action, ctx);
  for (const value of [-1, 8001, 0.5, NaN])
    assert.throws(() =>
      act(ws, order, "receive", ctx, {
        quantities: { [order.lines[0].id]: value },
      }),
    );
  assert.throws(
    () => act(ws, order, "receive", ctx, { quantities: { unknown: 1 } }),
    /não pertence/,
  );
  assert.throws(
    () => act(ws, order, "receive", ctx, { quantities: {} }),
    /ao menos/,
  );
  ws = act(ws, order, "receive", ctx, {
    quantities: { [order.lines[0].id]: 3000 },
  });
  assert.throws(
    () =>
      act(ws, order, "receive", ctx, {
        quantities: { [order.lines[0].id]: 6000 },
      }),
    /acima/,
  );
});
test("specific fields, protected origins, active catalog and validity are enforced", () => {
  const ctx = context();
  let ws = emptyOrderWorkspace();
  for (const kind of ["PFR", "ATA", "MOV"]) {
    const order = draft(kind, ctx);
    if (kind === "PFR") order.reason = "";
    if (kind === "ATA") order.contractReference = "";
    if (kind === "MOV") order.movement = "";
    const next = saveOrderDraft(ws, order, ctx);
    assert.throws(() => act(next, order, "submit", ctx));
  }
  const cd = draft("PCD", ctx);
  cd.lines = [{ ...itemOrderLine(ctx.items[1]), quantityMilli: 1 }];
  assert.throws(() => saveOrderDraft(ws, cd, ctx), /planejamento/);
  const bad = draft("PDL", ctx);
  bad.lines[0].unitPriceCents = 1;
  assert.throws(() => saveOrderDraft(ws, bad, ctx), /origem/);
  const valid = draft("PDL", ctx);
  ws = saveOrderDraft(ws, valid, ctx);
  assert.throws(
    () => act(ws, valid, "submit", { ...ctx, today: "2027-01-20" }),
    /vigente/,
  );
  assert.throws(
    () => act(ws, valid, "submit", { ...ctx, today: "2026-10-18" }),
    /vigente/,
  );
});
test("numbers and history survive return, with editing and deletion blocked after submission", () => {
  const ctx = context();
  const order = draft("PDL", ctx);
  let ws = saveOrderDraft(emptyOrderWorkspace(), order, ctx);
  ws = act(ws, order, "submit", ctx);
  assert.throws(() => saveOrderDraft(ws, order, ctx), /rascunhos/);
  assert.throws(() => removeOrderDraft(ws, order.id), /Somente/);
  ws = act(ws, order, "return", ctx);
  ws = saveOrderDraft(ws, ws.orders[0], ctx);
  ws = act(ws, order, "submit", ctx);
  assert.equal(ws.orders[0].code, "PDL-0001");
  assert.equal(ws.counters.PDL, 1);
  assert.throws(() => act(ws, order, "cancel", ctx, { reason: "" }), /motivo/);
});
test("legacy drafts retain exact sources and stay unreserved until explicitly saved", () => {
  const ctx = context();
  const order = draft("PDL", ctx, 1500);
  const legacy = {
    version: 1,
    drafts: [
      {
        id: "legacy",
        requester: "Henrique",
        cycleId: "",
        expectedDelivery: "",
        notes: "Preservar",
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        lines: [
          {
            planId: order.lines[0].planId,
            originId: order.lines[0].originId,
            quantityMilli: 1500,
          },
        ],
      },
    ],
  };
  const raw = JSON.stringify(legacy);
  let ws = importLegacyDLOrders(raw, ctx);
  assert.equal(ws.orders[0].id, "legacy");
  assert.equal(
    ws.orders[0].lines[0].originId,
    legacy.drafts[0].lines[0].originId,
  );
  assert.equal(ws.orders[0].reservationActivated, false);
  assert.equal(orderBalanceUsage(ws).size, 0);
  assert.equal(orderTotal(ws.orders[0]).cents, 375);
  assert.equal(JSON.stringify(legacy), raw);
  assert.deepEqual(readOrderWorkspace(JSON.stringify(ws)), ws);
  ws = saveOrderDraft(ws, ws.orders[0], ctx);
  assert.equal(ws.orders[0].reservationActivated, true);
  assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 8500);
  const broken = structuredClone(ws);
  broken.orders[0].lines.push(broken.orders[0].lines[0]);
  assert.throws(() => readOrderWorkspace(JSON.stringify(broken)));
  assert.throws(() => readOrderWorkspace('{"version":2}'));
});

test("same item and award ids in different DLs and units never share a reserve or manual debit", () => {
  const ctx = context();
  const secondPlan = structuredClone(ctx.plans[0]);
  secondPlan.id = "another-dl";
  secondPlan.sequenceNumber = 30;
  secondPlan.code = "DL-0030";
  secondPlan.lines.forEach((line) => {
    line.unit = "KG";
  });
  ctx.plans.push(secondPlan);
  const first = draft("PDL", ctx, 8000);
  const other = newOrder("PDL", "Henrique");
  const row = orderControlRows(ctx, emptyOrderWorkspace()).find(
    (row) => row.plan.id === secondPlan.id && row.origin.itemId === "a",
  );
  other.lines = [{ ...originOrderLine(row), quantityMilli: 5000 }];
  let ws = saveOrderDraft(emptyOrderWorkspace(), first, ctx);
  ws = saveOrderDraft(ws, other, ctx);
  let rows = orderControlRows(ctx, ws);
  assert.equal(
    rows.find(
      (row) => row.plan.id === ctx.plans[0].id && row.origin.itemId === "a",
    ).origin.availableMilli,
    2000,
  );
  assert.equal(
    rows.find(
      (row) => row.plan.id === secondPlan.id && row.origin.itemId === "a",
    ).origin.availableMilli,
    5000,
  );
  ws = addManualDLAdjustment(ws, ctx, {
    planId: first.lines[0].planId,
    originId: first.lines[0].originId,
    quantityMilli: 1000,
    actor: "Henrique",
    reason: "Consumo",
  });
  rows = orderControlRows(ctx, ws);
  assert.equal(
    rows.find(
      (row) => row.plan.id === secondPlan.id && row.origin.itemId === "a",
    ).origin.availableMilli,
    5000,
  );
  assert.equal(other.lines[0].unit, "KG");
  assert.equal(first.lines[0].unit, "UN");
});

test("requisição MXM pertence apenas à transferência e exige itens já salvos", () => {
  const ctx = context();
  let ws = emptyOrderWorkspace();
  const order = draft("PCD", ctx);
  order.externalReference = "REQ-123";
  assert.throws(() => saveOrderDraft(ws, order, ctx), /Salve os itens/);
  order.externalReference = "";
  ws = saveOrderDraft(ws, order, ctx);
  ws = saveOrderDraft(
    ws,
    { ...ws.orders[0], externalReference: "REQ-123" },
    ctx,
  );
  assert.equal(ws.orders[0].externalReference, "REQ-123");
  for (const kind of ["PFR", "PDL", "ATA", "MOV"]) {
    const other = draft(kind, ctx);
    other.externalReference = "REQ-456";
    assert.throws(
      () => saveOrderDraft(ws, other, ctx),
      /somente em Transferência/,
    );
    other.externalReference = "";
    let next = saveOrderDraft(emptyOrderWorkspace(), other, ctx);
    next = act(next, other, "submit", ctx);
    next = act(next, other, "approve", ctx);
    assert.throws(
      () => act(next, other, "send", ctx, { externalReference: "REQ-456" }),
      /somente em Transferência/,
    );
  }
});

test("edição preserva informações legadas e movimento não depende de ciclo", () => {
  const ctx = context();
  const order = draft("MOV", ctx);
  let ws = saveOrderDraft(emptyOrderWorkspace(), order, ctx);
  ws.orders[0].cycleId = "ciclo-antigo";
  ws.orders[0].externalReference = "protocolo-antigo";
  ws.orders[0].notes = "Observações históricas";
  ws = saveOrderDraft(
    ws,
    { ...ws.orders[0], requester: "Solicitante atualizado" },
    ctx,
  );
  assert.equal(ws.orders[0].notes, "Observações históricas");
  assert.equal(ws.orders[0].externalReference, "protocolo-antigo");
  ws = act(ws, ws.orders[0], "submit", ctx);
  assert.equal(ws.orders[0].status, "Em análise");
});

function movementFixture() {
  const ctx = context();
  ctx.plans[0].contract.awards.forEach((award) => {
    award.quantityMilli = 1000000;
    award.unitPriceCents = 100;
  });
  const order = newMovementOrder("Henrique");
  const line = originOrderLine(movementSources(ctx, emptyOrderWorkspace())[0]);
  line.quantityMilli = 800000;
  order.lines = [line];
  order.supplier = line.supplier;
  Object.assign(order.movementFlow, {
    planId: line.planId,
    billReference: "Conta Padaria 10/2026",
    billDate: ctx.today,
    billTotalCents: 80000,
    areas: [
      ["social", "Assistência Social", 20000],
      ["educacao", "Educação", 30000],
      ["esportes", "Esportes", 14000],
      ["nutricao", "Nutrição", 16000],
    ].map(([id, name, targetCents]) => ({
      id,
      name,
      targetCents,
      allocations: [{ lineId: line.id, quantityMilli: targetCents * 10 }],
    })),
  });
  return { ctx, order, line };
}
function confirmedMovement() {
  const fixture = movementFixture();
  let ws = saveMovementDraft(emptyOrderWorkspace(), fixture.order, fixture.ctx);
  ws = confirmMovementDistribution(
    ws,
    fixture.order.id,
    "Henrique",
    fixture.ctx,
  );
  return { ...fixture, ws };
}
function invoiceMovement(ws, order, ctx, quantity = 800000, number = "NF-1") {
  return recordMovementInvoice(
    ws,
    order.id,
    {
      actor: "Henrique",
      number,
      issuedOn: ctx.today,
      enteredOn: ctx.today,
      totalCents: quantity / 10,
      quantities: { [order.lines[0].id]: quantity },
    },
    ctx,
  );
}

test("MOV reserva as origens da DL ao salvar e compartilha saldo com pedidos estocáveis", () => {
  const { ctx, order, line } = movementFixture();
  const original = JSON.stringify(ctx.plans);
  const ws = saveMovementDraft(emptyOrderWorkspace(), order, ctx);
  assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 200000);
  assert.equal(orderControlRows(ctx, ws)[0].origin.reservedMilli, 800000);
  assert.equal(orderControlRows(ctx, ws)[0].origin.receivedMilli, 0);
  const pdl = draft("PDL", ctx, 250000);
  pdl.lines[0].unitPriceCents = 100;
  assert.throws(() => saveOrderDraft(ws, pdl, ctx), /saldo disponível/);
  assert.equal(JSON.stringify(ctx.plans), original);
  assert.equal(ws.orders[0].lines[0].originId, line.originId);
  assert.doesNotThrow(() => readOrderWorkspace(JSON.stringify(ws)));
});

test("MOV bloqueia preço alterado, catálogo avulso, fornecedor misturado e saldo excedido", () => {
  for (const change of [
    (order) => order.lines[0].unitPriceCents++,
    (order) => (order.lines[0].planId = "outro"),
    (order) => (order.lines[0].originId = "outra"),
    (order) => {
      order.movementFlow.areas[0].allocations[0].quantityMilli = 1000001;
    },
  ]) {
    const { ctx, order } = movementFixture();
    change(order);
    assert.throws(() => saveMovementDraft(emptyOrderWorkspace(), order, ctx));
  }
  const { ctx, order } = movementFixture();
  ctx.plans[0].contract.awards[1].supplier = "Outro fornecedor";
  ctx.plans[0].contract.awards[1].mxmOrder = "OUTRO-PEDIDO";
  const line = originOrderLine(movementSources(ctx, emptyOrderWorkspace())[1]);
  order.lines.push(line);
  order.movementFlow.areas[0].allocations.push({
    lineId: line.id,
    quantityMilli: 1000,
  });
  assert.throws(
    () => saveMovementDraft(emptyOrderWorkspace(), order, ctx),
    /único fornecedor/,
  );
});

test("MOV rascunho permite diferenças, confirmação exige bater cada área e conta", () => {
  const { ctx, order } = movementFixture();
  order.movementFlow.areas[0].targetCents = 19000;
  order.movementFlow.areas[1].targetCents = 31000;
  const ws = saveMovementDraft(emptyOrderWorkspace(), order, ctx);
  assert.equal(
    movementTotals(order.movementFlow, order.lines).billDifferenceCents,
    0,
  );
  assert.throws(
    () => confirmMovementDistribution(ws, order.id, "Henrique", ctx),
    /valores de cada área/,
  );
  order.movementFlow.areas[0].targetCents = 20000;
  order.movementFlow.areas[1].targetCents = 30000;
  const saved = saveMovementDraft(ws, order, ctx);
  const confirmed = confirmMovementDistribution(
    saved,
    order.id,
    "Henrique",
    ctx,
  );
  assert.equal(
    confirmed.orders[0].events.filter(
      (event) => event.action === "Distribuição salva",
    ).length,
    saved.orders[0].events.filter(
      (event) => event.action === "Distribuição salva",
    ).length,
  );
  assert.equal(confirmed.orders[0].code, "MOV-0001");
  assert.equal(confirmed.orders[0].movementFlow.phase, "Entrada da NF");
  assert.throws(
    () => saveMovementDraft(confirmed, confirmed.orders[0], ctx),
    /Somente distribuições/,
  );
});

test("MOV edição reconcilia a própria reserva; cancelar libera sem apagar conta ou histórico", () => {
  const { ctx, order } = movementFixture();
  let ws = saveMovementDraft(emptyOrderWorkspace(), order, ctx);
  const edit = structuredClone(ws.orders[0]);
  edit.movementFlow.areas[0].allocations[0].quantityMilli -= 10000;
  ws = saveMovementDraft(ws, edit, ctx);
  assert.equal(orderControlRows(ctx, ws)[0].origin.reservedMilli, 790000);
  ws = cancelMovement(ws, order.id, "Henrique", "Conta substituída");
  assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 1000000);
  assert.equal(
    ws.orders[0].movementFlow.billReference,
    "Conta Padaria 10/2026",
  );
  assert.equal(ws.orders[0].status, "Cancelado");
  assert.doesNotThrow(() => readOrderWorkspace(JSON.stringify(ws)));
});

test("MOV entrada parcial baixa só o que entrou, mantém reserva e impede solicitações antecipadas", () => {
  let { ctx, order, ws } = confirmedMovement();
  ws = invoiceMovement(ws, order, ctx, 400000);
  const balance = orderControlRows(ctx, ws)[0].origin;
  assert.equal(balance.receivedMilli, 400000);
  assert.equal(balance.reservedMilli, 400000);
  assert.equal(balance.availableMilli, 200000);
  assert.equal(ws.orders[0].movementFlow.phase, "Entrada da NF");
  assert.throws(
    () =>
      recordMovementRequest(
        ws,
        order.id,
        {
          actor: "Henrique",
          areaId: "social",
          reference: "REQ-1",
          requestedOn: ctx.today,
          quantities: { [order.lines[0].id]: 1000 },
        },
        ctx,
      ),
    /Conclua a entrada/,
  );
  assert.throws(
    () => cancelMovement(ws, order.id, "Henrique", "Cancelar"),
    /entrada de NF/,
  );
  ws = invoiceMovement(ws, order, ctx, 400000, "NF-2");
  assert.equal(ws.orders[0].movementFlow.phase, "Solicitações das áreas");
  assert.equal(orderControlRows(ctx, ws)[0].origin.reservedMilli, 0);
  assert.equal(orderControlRows(ctx, ws)[0].origin.receivedMilli, 800000);
  assert.doesNotThrow(() => readOrderWorkspace(JSON.stringify(ws)));
});

test("MOV rejeita NF duplicada, excesso, valor divergente e datas inválidas sem alterar registros", () => {
  const { ctx, order, ws } = confirmedMovement();
  const before = JSON.stringify(ws);
  for (const override of [
    { totalCents: 79999 },
    { quantities: { [order.lines[0].id]: 800001 } },
    { enteredOn: "2026-02-30" },
    { issuedOn: "2027-01-01" },
    { quantities: { desconhecido: 1 } },
  ])
    assert.throws(() =>
      recordMovementInvoice(
        ws,
        order.id,
        {
          actor: "Henrique",
          number: "NF-1",
          issuedOn: ctx.today,
          enteredOn: ctx.today,
          totalCents: 80000,
          quantities: { [order.lines[0].id]: 800000 },
          ...override,
        },
        ctx,
      ),
    );
  assert.equal(JSON.stringify(ws), before);
  const partial = invoiceMovement(ws, order, ctx, 400000);
  assert.throws(
    () => invoiceMovement(partial, order, ctx, 400000),
    /ainda não registrada/,
  );
});

test("MOV solicitações parciais e atendimento respeitam cada área e não baixam a DL de novo", () => {
  let { ctx, order, ws } = confirmedMovement();
  ws = invoiceMovement(ws, order, ctx);
  const lineId = order.lines[0].id;
  const original = orderControlRows(ctx, ws)[0].origin;
  const input = {
    actor: "Henrique",
    areaId: "social",
    reference: "REQ-SOCIAL-1",
    requestedOn: ctx.today,
    quantities: { [lineId]: 100000 },
  };
  ws = recordMovementRequest(ws, order.id, input, ctx);
  assert.throws(
    () =>
      recordMovementRequest(
        ws,
        order.id,
        {
          ...input,
          reference: "REQ-SOCIAL-2",
          quantities: { [lineId]: 100001 },
        },
        ctx,
      ),
    /supera o previsto/,
  );
  assert.throws(
    () => recordMovementRequest(ws, order.id, input, ctx),
    /ainda não registrada/,
  );
  const request = ws.orders[0].movementFlow.requests[0];
  ws = serveMovementRequest(
    ws,
    order.id,
    request.id,
    { [lineId]: 40000 },
    "Henrique",
  );
  assert.throws(
    () =>
      serveMovementRequest(
        ws,
        order.id,
        request.id,
        { [lineId]: 60001 },
        "Henrique",
      ),
    /supera o pendente/,
  );
  ws = serveMovementRequest(
    ws,
    order.id,
    request.id,
    { [lineId]: 60000 },
    "Henrique",
  );
  assert.throws(
    () => finishMovement(ws, order.id, "Henrique"),
    /atendimento de todas/,
  );
  assert.deepEqual(orderControlRows(ctx, ws)[0].origin, original);
  assert.doesNotThrow(() => readOrderWorkspace(JSON.stringify(ws)));
});

test("MOV encerra só após NF completa e atendimento integral de todas as áreas", () => {
  let { ctx, order, ws } = confirmedMovement();
  ws = invoiceMovement(ws, order, ctx);
  for (const area of order.movementFlow.areas) {
    const quantities = Object.fromEntries(
      area.allocations.map((a) => [a.lineId, a.quantityMilli]),
    );
    ws = recordMovementRequest(
      ws,
      order.id,
      {
        actor: "Henrique",
        areaId: area.id,
        reference: `REQ-${area.id}`,
        requestedOn: ctx.today,
        quantities,
      },
      ctx,
    );
    const request = ws.orders[0].movementFlow.requests.at(-1);
    ws = serveMovementRequest(ws, order.id, request.id, quantities, "Henrique");
  }
  ws = finishMovement(ws, order.id, "Henrique");
  assert.equal(ws.orders[0].status, "Concluído");
  assert.equal(ws.orders[0].movementFlow.phase, "Concluído");
  assert.equal(orderControlRows(ctx, ws)[0].origin.receivedMilli, 800000);
  assert.equal(orderControlRows(ctx, ws)[0].origin.availableMilli, 200000);
  assert.doesNotThrow(() => readOrderWorkspace(JSON.stringify(ws)));
  assert.throws(
    () => finishMovement(ws, order.id, "Henrique"),
    /já está encerrado/,
  );
});

test("MOV arredondamento por origem conserva os centavos entre áreas e entradas parciais", () => {
  const { ctx, order } = movementFixture();
  ctx.plans[0].contract.awards[0].unitPriceCents = 1;
  order.lines[0].unitPriceCents = 1;
  order.movementFlow.areas = order.movementFlow.areas.slice(0, 2);
  order.movementFlow.areas[0].targetCents = 1;
  order.movementFlow.areas[1].targetCents = 0;
  order.movementFlow.areas.forEach(
    (area) => (area.allocations[0].quantityMilli = 500),
  );
  order.lines[0].quantityMilli = 1000;
  order.movementFlow.billTotalCents = 1;
  const totals = movementTotals(order.movementFlow, order.lines);
  assert.equal(totals.totalCents, 1);
  assert.equal(
    [...totals.areaCents.values()].reduce((sum, n) => sum + n, 0),
    1,
  );
  assert.equal(movementLineCents(500, 1), 1);
});

test("MOV leitura rejeita adulteração de áreas, entrada, baixa e atendimento", () => {
  let { ctx, order, ws } = confirmedMovement();
  ws = invoiceMovement(ws, order, ctx);
  for (const change of [
    (o) => o.movementFlow.areas.push(o.movementFlow.areas[0]),
    (o) => o.movementFlow.invoices[0].lines[0].quantityMilli++,
    (o) => o.lines[0].receivedMilli--,
    (o) => (o.reservationActivated = false),
    (o) => o.movementFlow.billTotalCents--,
    (o) =>
      o.movementFlow.requests.push({
        id: "x",
        areaId: "desconhecida",
        reference: "REQ-X",
        requestedOn: ctx.today,
        lines: [],
      }),
  ]) {
    const broken = structuredClone(ws);
    change(broken.orders[0]);
    assert.throws(() => readOrderWorkspace(JSON.stringify(broken)));
  }
  assert.throws(
    () => saveOrderDraft(ws, ws.orders[0], ctx),
    /fluxo de distribuição/,
  );
  assert.throws(() => act(ws, order, "receive", ctx), /etapas de entrada/);
});

test("MOV impressão por área mantém quantidades, valores, origem e escapa conteúdo", () => {
  const { order } = movementFixture();
  order.movementFlow.areas[0].name = '<script>alert("x")</script>';
  const markup = movementAreaPrintHtml(order, "social");
  assert.ok(markup.includes("200,00"));
  assert.ok(markup.includes(order.lines[0].dlCode));
  assert.ok(markup.includes("&lt;script&gt;"));
  assert.ok(!markup.includes("<script>"));
  assert.ok(markup.includes("Prévia"));
});

test("MOV não mistura DLs e revalida a vigência antes de confirmar", () => {
  const { ctx, order } = movementFixture();
  const other = structuredClone(ctx.plans[0]);
  other.id = "outra-dl";
  other.code = "DL-0030";
  other.sequenceNumber = 30;
  ctx.plans.push(other);
  const source = movementSources(ctx, emptyOrderWorkspace()).find(
    (row) => row.plan.id === other.id,
  );
  const line = originOrderLine(source);
  const mixed = structuredClone(order);
  mixed.lines.push(line);
  mixed.movementFlow.areas[0].allocations.push({
    lineId: line.id,
    quantityMilli: 1000,
  });
  assert.throws(
    () => saveMovementDraft(emptyOrderWorkspace(), mixed, ctx),
    /saldo disponível/,
  );
  const ws = saveMovementDraft(emptyOrderWorkspace(), order, ctx);
  assert.throws(
    () =>
      confirmMovementDistribution(ws, order.id, "Henrique", {
        ...ctx,
        today: "2027-02-01",
      }),
    /saldo disponível/,
  );
});
