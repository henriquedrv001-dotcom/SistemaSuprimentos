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
