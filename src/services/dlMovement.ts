import type { Order, OrderWorkspace } from "../types/orders";
import type { MovementInvoice, MovementRequest } from "../types/dlMovement";
import type { OrderContext } from "./orders";
import { orderControlRows, originOrderLine, newOrder } from "./orders.ts";
import { contractStatus } from "./dlContract.ts";
import {
  emptyMovementFlow,
  movementTotals,
  movementLineCents,
  validateMovementShape,
  allocatedMilli,
  areaRequestedMilli,
} from "./dlMovementMath.ts";

const safe = (n: number) => Number.isSafeInteger(n) && n >= 0;
function validDate(value: string, today: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value &&
    value <= today
  );
}
function audit(
  order: Order,
  action: string,
  actor: string,
  details: string,
  quantities?: { lineId: string; quantityMilli: number }[],
) {
  if (!actor.trim()) throw new Error("Informe o responsável pelo registro.");
  const now = new Date().toISOString();
  order.updatedAt = now;
  order.events.push({
    id: crypto.randomUUID(),
    timestamp: now,
    action,
    actor: actor.trim(),
    details,
    ...(quantities?.length ? { quantities } : {}),
  });
}
function replace(workspace: OrderWorkspace, order: Order) {
  validateMovementShape(order);
  return {
    ...workspace,
    orders: workspace.orders.some((previous) => previous.id === order.id)
      ? workspace.orders.map((previous) =>
          previous.id === order.id ? order : previous,
        )
      : [...workspace.orders, order],
  };
}
function current(workspace: OrderWorkspace, id: string) {
  const source = workspace.orders.find((order) => order.id === id);
  if (!source?.movementFlow) throw new Error("Distribuição não encontrada.");
  validateMovementShape(source);
  if (["Concluído", "Cancelado"].includes(source.movementFlow.phase))
    throw new Error("Este fluxo já está encerrado.");
  return structuredClone(source);
}
export function newMovementOrder(requester: string): Order {
  return {
    ...newOrder("MOV", requester),
    reservationActivated: true,
    movementFlow: emptyMovementFlow(),
  };
}
export function movementSources(
  context: OrderContext,
  workspace: OrderWorkspace,
  excludeId = "",
) {
  return orderControlRows(context, workspace, excludeId).filter(
    (row) =>
      row.item?.active &&
      row.plan.contract?.release &&
      !["Vigência futura", "Vigência encerrada", "Não concluída"].includes(
        contractStatus(row.plan, context.today),
      ) &&
      row.origin.availableMilli > 0 &&
      row.origin.unitPriceCents > 0,
  );
}
export function saveMovementDraft(
  workspace: OrderWorkspace,
  candidate: Order,
  context: OrderContext,
) {
  const previous = workspace.orders.find((order) => order.id === candidate.id);
  if (
    candidate.kind !== "MOV" ||
    !candidate.movementFlow ||
    candidate.movementFlow.phase !== "Distribuição" ||
    (previous &&
      (!previous.movementFlow ||
        previous.movementFlow.phase !== "Distribuição"))
  )
    throw new Error("Somente distribuições em preparação podem ser alteradas.");
  const flow = structuredClone(candidate.movementFlow);
  if (
    !candidate.requester.trim() ||
    !flow.planId ||
    !safe(flow.billTotalCents) ||
    flow.billTotalCents <= 0 ||
    !flow.areas.length ||
    !candidate.lines.length
  )
    throw new Error(
      "Informe responsável, DL, total da conta, áreas e materiais distribuídos.",
    );
  if (flow.billDate && !validDate(flow.billDate, context.today))
    throw new Error("Informe uma data da conta válida, sem data futura.");
  if (flow.invoices.length || flow.requests.length)
    throw new Error(
      "A distribuição ainda não pode ter entrada de NF ou solicitações.",
    );
  const totals = movementTotals(flow, candidate.lines);
  const rows = movementSources(context, workspace, candidate.id);
  const lines = candidate.lines.map((line) => {
    const source = rows.find(
      (row) => row.plan.id === flow.planId && row.origin.id === line.originId,
    );
    const quantity = totals.quantities.get(line.id) || 0;
    if (
      !source ||
      line.planId !== flow.planId ||
      !quantity ||
      quantity > source.origin.availableMilli
    )
      throw new Error(
        `Revise o saldo disponível da origem de ${line.description}.`,
      );
    const snapshot = originOrderLine(source);
    if (
      [
        "itemId",
        "code",
        "description",
        "unit",
        "supplier",
        "mxmOrder",
        "dlCode",
        "unitPriceCents",
      ].some(
        (key) =>
          line[key as keyof typeof line] !==
          snapshot[key as keyof typeof snapshot],
      )
    )
      throw new Error(
        `Os dados contratados de ${line.description} mudaram. Selecione novamente a origem.`,
      );
    return { ...snapshot, id: line.id, quantityMilli: quantity };
  });
  if (new Set(lines.map((line) => line.supplier)).size !== 1)
    throw new Error("Use materiais de um único fornecedor por conta.");
  const next: Order = {
    ...(previous
      ? structuredClone(previous)
      : newMovementOrder(candidate.requester)),
    id: candidate.id,
    requester: candidate.requester.trim(),
    createdAt: previous?.createdAt || candidate.createdAt,
    supplier: lines[0].supplier,
    expectedDelivery: "",
    cycleId: "",
    status: "Rascunho",
    reservationActivated: true,
    lines,
    movementFlow: flow,
  };
  audit(
    next,
    "Distribuição salva",
    next.requester,
    `Conta ${flow.billReference || "sem referência"}. Quantidades reservadas por origem da DL; valores ainda podem ter diferenças.`,
  );
  const result = replace(workspace, next);
  orderControlRows(context, result);
  return result;
}
export function confirmMovementDistribution(
  workspace: OrderWorkspace,
  id: string,
  actor: string,
  context: OrderContext,
) {
  const previous = current(workspace, id);
  const checked = saveMovementDraft(workspace, previous, context);
  const order = current(checked, id);
  // Revalidar não registra um segundo salvamento fictício no histórico.
  order.events = previous.events;
  const flow = order.movementFlow!;
  if (flow.phase !== "Distribuição")
    throw new Error("A distribuição já foi confirmada.");
  const totals = movementTotals(flow, order.lines);
  if (
    !flow.billReference.trim() ||
    !flow.billDate ||
    flow.billTotalCents <= 0 ||
    !flow.areas.length ||
    !order.lines.length ||
    totals.billDifferenceCents ||
    totals.targetDifferenceCents ||
    flow.areas.some(
      (area) =>
        !area.targetCents || totals.areaCents.get(area.id) !== area.targetCents,
    )
  )
    throw new Error(
      "Confira a referência e data da conta: os valores de cada área, dos itens e do total precisam coincidir antes de confirmar.",
    );
  const counters = { ...workspace.counters };
  if (!order.code) {
    counters.MOV++;
    if (!safe(counters.MOV)) throw new Error("Limite de numeração excedido.");
    order.code = `MOV-${String(counters.MOV).padStart(4, "0")}`;
  }
  flow.phase = "Entrada da NF";
  order.status = "Enviado";
  audit(
    order,
    "Distribuição confirmada",
    actor,
    "Valores e quantidades conferidos por área. Aguardando entrada da NF.",
  );
  return replace({ ...workspace, counters }, order);
}
export function movementInvoiceCents(
  order: Order,
  quantities: Record<string, number>,
) {
  let amount = 0;
  for (const line of order.lines) {
    const quantity = quantities[line.id] || 0;
    if (!safe(quantity) || quantity > line.quantityMilli - line.receivedMilli)
      throw new Error(`A entrada de ${line.description} supera o pendente.`);
    amount +=
      movementLineCents(line.receivedMilli + quantity, line.unitPriceCents!) -
      movementLineCents(line.receivedMilli, line.unitPriceCents!);
  }
  if (!safe(amount)) throw new Error("Valor da entrada acima do limite.");
  return amount;
}
export function recordMovementInvoice(
  workspace: OrderWorkspace,
  id: string,
  input: Omit<MovementInvoice, "id" | "lines"> & {
    quantities: Record<string, number>;
    actor: string;
  },
  context: OrderContext,
) {
  const order = current(workspace, id);
  const flow = order.movementFlow!;
  if (flow.phase !== "Entrada da NF")
    throw new Error(
      "Confirme a distribuição antes de registrar a entrada da NF.",
    );
  if (
    !input.number.trim() ||
    flow.invoices.some(
      (invoice) =>
        invoice.number.trim().toUpperCase() ===
        input.number.trim().toUpperCase(),
    )
  )
    throw new Error("Informe uma NF ainda não registrada nesta conta.");
  if (
    !validDate(input.issuedOn, context.today) ||
    !validDate(input.enteredOn, context.today) ||
    input.enteredOn < input.issuedOn
  )
    throw new Error("Confira as datas de emissão e entrada da NF.");
  if (
    Object.keys(input.quantities).some(
      (lineId) => !order.lines.some((line) => line.id === lineId),
    )
  )
    throw new Error("A NF contém uma origem fora da distribuição.");
  const total = movementInvoiceCents(order, input.quantities);
  if (
    !Object.values(input.quantities).some((quantity) => quantity > 0) ||
    !safe(input.totalCents) ||
    input.totalCents !== total
  )
    throw new Error(
      "O valor informado da NF precisa coincidir com os itens e quantidades desta entrada.",
    );
  const lines = order.lines
    .filter((line) => input.quantities[line.id] > 0)
    .map((line) => ({
      lineId: line.id,
      quantityMilli: input.quantities[line.id],
    }));
  flow.invoices.push({
    id: crypto.randomUUID(),
    number: input.number.trim(),
    issuedOn: input.issuedOn,
    enteredOn: input.enteredOn,
    totalCents: total,
    lines,
  });
  for (const line of order.lines)
    line.receivedMilli += input.quantities[line.id] || 0;
  if (order.lines.every((line) => line.receivedMilli === line.quantityMilli)) {
    flow.phase = "Solicitações das áreas";
    order.status = "Recebimento parcial";
  }
  audit(
    order,
    "Entrada de NF registrada",
    input.actor,
    `NF ${input.number.trim()}. Baixa na DL somente das quantidades desta entrada.`,
    lines,
  );
  const result = replace(workspace, order);
  orderControlRows(context, result);
  return result;
}
export function recordMovementRequest(
  workspace: OrderWorkspace,
  id: string,
  input: {
    areaId: string;
    reference: string;
    requestedOn: string;
    quantities: Record<string, number>;
    actor: string;
  },
  context: OrderContext,
) {
  const order = current(workspace, id);
  const flow = order.movementFlow!;
  const area = flow.areas.find((area) => area.id === input.areaId);
  if (flow.phase !== "Solicitações das áreas" || !area)
    throw new Error(
      "Conclua a entrada da NF antes de registrar solicitações das áreas.",
    );
  if (
    !input.reference.trim() ||
    flow.requests.some(
      (request) =>
        request.reference.trim().toUpperCase() ===
        input.reference.trim().toUpperCase(),
    )
  )
    throw new Error(
      "Informe uma solicitação ainda não registrada nesta conta.",
    );
  if (
    !validDate(input.requestedOn, context.today) ||
    input.requestedOn < flow.invoices[flow.invoices.length - 1].enteredOn
  )
    throw new Error(
      "A data da solicitação deve ser válida e posterior à entrada da NF.",
    );
  if (
    Object.keys(input.quantities).some(
      (lineId) => !order.lines.some((line) => line.id === lineId),
    )
  )
    throw new Error("A solicitação contém material fora da distribuição.");
  const lines: MovementRequest["lines"] = [];
  for (const line of order.lines) {
    const q = input.quantities[line.id] || 0;
    const remaining =
      allocatedMilli(area, line.id) -
      areaRequestedMilli(flow, area.id, line.id);
    if (!safe(q) || q > remaining)
      throw new Error(
        `A quantidade de ${line.description} supera o previsto para ${area.name}.`,
      );
    if (q) lines.push({ lineId: line.id, quantityMilli: q, servedMilli: 0 });
  }
  if (!lines.length)
    throw new Error(
      "Informe os materiais e quantidades solicitados pela área.",
    );
  flow.requests.push({
    id: crypto.randomUUID(),
    areaId: area.id,
    reference: input.reference.trim(),
    requestedOn: input.requestedOn,
    lines,
  });
  audit(
    order,
    "Solicitação da área registrada",
    input.actor,
    `${area.name} · ${input.reference.trim()}. Sem nova baixa na DL.`,
    lines.map((line) => ({
      lineId: line.lineId,
      quantityMilli: line.quantityMilli,
    })),
  );
  return replace(workspace, order);
}
export function serveMovementRequest(
  workspace: OrderWorkspace,
  id: string,
  requestId: string,
  quantities: Record<string, number>,
  actor: string,
) {
  const order = current(workspace, id);
  const flow = order.movementFlow!;
  const request = flow.requests.find((request) => request.id === requestId);
  if (flow.phase !== "Solicitações das áreas" || !request)
    throw new Error("Solicitação não encontrada nesta etapa.");
  if (
    Object.keys(quantities).some(
      (lineId) => !request.lines.some((line) => line.lineId === lineId),
    )
  )
    throw new Error("Material fora desta solicitação.");
  if (!Object.values(quantities).some((quantity) => quantity > 0))
    throw new Error("Informe o que foi atendido nesta entrega.");
  for (const line of request.lines) {
    const q = quantities[line.lineId] || 0;
    if (!safe(q) || q > line.quantityMilli - line.servedMilli)
      throw new Error("O atendimento supera o pendente da solicitação.");
    line.servedMilli += q;
  }
  audit(
    order,
    "Atendimento da área registrado",
    actor,
    `${request.reference}. Sem nova baixa na DL.`,
    Object.entries(quantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([lineId, quantityMilli]) => ({ lineId, quantityMilli })),
  );
  return replace(workspace, order);
}
export function finishMovement(
  workspace: OrderWorkspace,
  id: string,
  actor: string,
) {
  const order = current(workspace, id);
  const flow = order.movementFlow!;
  if (
    flow.phase !== "Solicitações das áreas" ||
    flow.areas.some((area) =>
      order.lines.some(
        (line) =>
          areaRequestedMilli(flow, area.id, line.id, true) !==
          allocatedMilli(area, line.id),
      ),
    )
  )
    throw new Error(
      "Conclua a entrada da NF e o atendimento de todas as quantidades de cada área antes de finalizar.",
    );
  flow.phase = "Concluído";
  order.status = "Concluído";
  audit(
    order,
    "Fluxo de entrada e saída concluído",
    actor,
    "Conta conciliada, entrada da NF e solicitações das áreas concluídas.",
  );
  return replace(workspace, order);
}
export function cancelMovement(
  workspace: OrderWorkspace,
  id: string,
  actor: string,
  reason: string,
) {
  const order = current(workspace, id);
  const flow = order.movementFlow!;
  if (flow.invoices.length || flow.requests.length)
    throw new Error(
      "Este fluxo já possui entrada de NF. Os registros de entrada não podem ser apagados por cancelamento.",
    );
  if (!reason.trim()) throw new Error("Informe o motivo do cancelamento.");
  flow.phase = "Cancelado";
  order.status = "Cancelado";
  if (!order.code) {
    const counters = { ...workspace.counters, MOV: workspace.counters.MOV + 1 };
    if (!safe(counters.MOV)) throw new Error("Limite de numeração excedido.");
    order.code = `MOV-${String(counters.MOV).padStart(4, "0")}`;
    workspace = { ...workspace, counters };
  }
  order.lines.forEach(
    (line) => (line.unfulfilledMilli = line.quantityMilli - line.receivedMilli),
  );
  audit(order, "Distribuição cancelada", actor, reason.trim());
  return replace(workspace, order);
}
