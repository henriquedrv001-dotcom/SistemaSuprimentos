import { orderKinds, orderStatuses } from "../types/orders.ts";
import type {
  Order,
  OrderLine,
  OrderKind,
  OrderWorkspace,
} from "../types/orders";
import type { CycleWorkspace, Item, SupplyCycle } from "../types";
import type { DLPlan } from "../types/dl";
import { dlControlRows } from "./dlControl.ts";
import type { DLControlRow } from "./dlControl";
import { readDLOrderDrafts, originKey } from "./dlOrderDrafts.ts";
import { contractStatus } from "./dlContract.ts";

export const orderWorkspaceKey = "suprimentos:orders:v1";
export const orderKindNames: Record<OrderKind, string> = {
  PCD: "Transferência",
  PFR: "Fundo rotativo",
  PDL: "DL ESTOCÁVEL",
  ATA: "ATA/Contrato",
  MOV: "DL PARA ENTRADA E SAÍDA",
};
export const emptyOrderWorkspace = (): OrderWorkspace => ({
  version: 1,
  dlReservationPolicy: "draft",
  adjustments: [],
  counters: { PCD: 0, PFR: 0, PDL: 0, ATA: 0, MOV: 0 },
  orders: [],
});
export type OrderContext = {
  items: Item[];
  plans: DLPlan[];
  cycles: SupplyCycle[];
  cycleWorkspace: CycleWorkspace;
  today: string;
};
const safe = (value: number) => Number.isSafeInteger(value) && value >= 0;
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const event = (action: string, actor: string, details: string) => ({
  id: crypto.randomUUID(),
  action,
  actor: actor.trim(),
  details,
  timestamp: new Date().toISOString(),
});

export function readOrderWorkspace(raw: string | null): OrderWorkspace {
  if (raw === null) return emptyOrderWorkspace();
  const data = JSON.parse(raw) as OrderWorkspace;
  const fail = () => {
    throw new Error(
      "Os pedidos salvos não puderam ser lidos. A cópia original foi preservada.",
    );
  };
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.orders) ||
    !data.counters ||
    ![null, "draft", "approval", "sending", "manual"].includes(
      data.dlReservationPolicy,
    ) ||
    orderKinds.some((kind) => !safe(data.counters[kind]))
  )
    fail();
  const previousPolicy = String(data.dlReservationPolicy);
  data.dlReservationPolicy = "draft";
  data.adjustments ??= [];
  if (!Array.isArray(data.adjustments)) fail();
  const adjustmentIds = new Set<string>();
  for (const adjustment of data.adjustments) {
    if (
      !adjustment ||
      ![
        adjustment.id,
        adjustment.planId,
        adjustment.originId,
        adjustment.actor,
        adjustment.reason,
        adjustment.timestamp,
      ].every((value) => typeof value === "string" && !!value.trim()) ||
      !safe(adjustment.quantityMilli) ||
      adjustment.quantityMilli <= 0 ||
      adjustmentIds.has(adjustment.id)
    )
      fail();
    adjustmentIds.add(adjustment.id);
  }
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const order of data.orders) {
    if (
      !order ||
      !order.id ||
      ids.has(order.id) ||
      !orderKinds.includes(order.kind) ||
      !orderStatuses.includes(order.status) ||
      ![
        order.id,
        order.code,
        order.requester,
        order.cycleId,
        order.expectedDelivery,
        order.supplier,
        order.externalReference,
        order.contractReference,
        order.reason,
        order.notes,
        order.createdAt,
        order.updatedAt,
      ].every((value) => typeof value === "string") ||
      !["", "Entrada", "Saída"].includes(order.movement) ||
      !Array.isArray(order.lines) ||
      !Array.isArray(order.events)
    )
      fail();
    order.reservationActivated ??=
      order.kind === "PDL" &&
      (previousPolicy === "draft" ||
        (previousPolicy === "approval" &&
          ["Aprovado", "Enviado", "Recebimento parcial"].includes(
            order.status,
          )) ||
        (previousPolicy === "sending" &&
          ["Enviado", "Recebimento parcial"].includes(order.status)));
    if (typeof order.reservationActivated !== "boolean") fail();
    ids.add(order.id);
    if (
      order.code &&
      (codes.has(order.code) ||
        !new RegExp(`^${order.kind}-\\d{4,}$`).test(order.code))
    )
      fail();
    if (order.code) {
      codes.add(order.code);
      if (Number(order.code.split("-")[1]) > data.counters[order.kind]) fail();
    }
    if (order.status !== "Rascunho" && (!order.code || !order.lines.length))
      fail();
    const lineIds = new Set<string>();
    const sources = new Set<string>();
    for (const line of order.lines) {
      if (line)
        line.unfulfilledMilli ??=
          order.status === "Cancelado"
            ? line.quantityMilli - line.receivedMilli
            : 0;
      if (
        !line ||
        !line.id ||
        !line.itemId ||
        lineIds.has(line.id) ||
        ![
          line.id,
          line.itemId,
          line.code,
          line.description,
          line.unit,
          line.supplier,
          line.mxmOrder,
          line.planId,
          line.originId,
          line.dlCode,
        ].every((value) => typeof value === "string") ||
        !safe(line.quantityMilli) ||
        !safe(line.receivedMilli) ||
        !safe(line.unfulfilledMilli) ||
        line.receivedMilli + line.unfulfilledMilli > line.quantityMilli ||
        line.receivedMilli > line.quantityMilli ||
        (line.unitPriceCents !== null && !safe(line.unitPriceCents))
      )
        fail();
      lineIds.add(line.id);
      const key =
        order.kind === "PDL"
          ? originKey(line.planId, line.originId)
          : line.itemId;
      if (
        sources.has(key) ||
        (order.kind === "PDL" && (!line.planId || !line.originId))
      )
        fail();
      sources.add(key);
      if (order.status !== "Rascunho" && line.quantityMilli <= 0) fail();
      if (
        ["Rascunho", "Em análise", "Aprovado"].includes(order.status) &&
        line.receivedMilli !== 0
      )
        fail();
      if (
        !["Concluído", "Cancelado"].includes(order.status) &&
        line.unfulfilledMilli !== 0
      )
        fail();
      if (
        ["Concluído", "Cancelado"].includes(order.status) &&
        line.receivedMilli + line.unfulfilledMilli !== line.quantityMilli
      )
        fail();
    }
    const events = new Set<string>();
    for (const record of order.events) {
      if (
        !record ||
        ![
          record.id,
          record.action,
          record.actor,
          record.timestamp,
          record.details,
        ].every((value) => typeof value === "string") ||
        !record.id ||
        events.has(record.id)
      )
        fail();
      events.add(record.id);
      if (
        record.quantities &&
        (!Array.isArray(record.quantities) ||
          record.quantities.some(
            (line) =>
              !line ||
              !lineIds.has(line.lineId) ||
              !safe(line.quantityMilli) ||
              line.quantityMilli <= 0,
          ))
      )
        fail();
    }
  }
  return data;
}

export function newOrder(kind: OrderKind, requester: string): Order {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    kind,
    code: "",
    status: "Rascunho",
    reservationActivated: kind === "PDL",
    requester,
    cycleId: "",
    expectedDelivery: "",
    supplier: "",
    externalReference: "",
    contractReference: "",
    movement: "",
    reason: "",
    notes: "",
    lines: [],
    events: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function itemOrderLine(item: Item): OrderLine {
  return {
    id: crypto.randomUUID(),
    itemId: item.id,
    code: item.code,
    description: item.description,
    unit: item.unit,
    quantityMilli: 0,
    unitPriceCents: null,
    supplier: "",
    mxmOrder: "",
    planId: "",
    originId: "",
    dlCode: "",
    receivedMilli: 0,
    unfulfilledMilli: 0,
  };
}
export function originOrderLine(row: DLControlRow): OrderLine {
  return {
    ...itemOrderLine(
      row.item ||
        ({
          id: row.origin.itemId,
          code: row.origin.itemId,
          description: "Cadastro indisponível",
          unit: row.origin.unit,
        } as Item),
    ),
    unit: row.origin.unit,
    supplier: row.origin.supplier,
    mxmOrder: row.origin.mxmOrder,
    unitPriceCents: row.origin.unitPriceCents,
    planId: row.plan.id,
    originId: row.origin.id,
    dlCode: row.plan.code,
  };
}

/** Pure import: old draft storage is retained and nothing is written on mount. */
export function importLegacyDLOrders(
  legacyRaw: string | null,
  context: OrderContext,
): OrderWorkspace {
  const workspace = emptyOrderWorkspace();
  const rows = dlControlRows(context.plans, context.items);
  workspace.orders = readDLOrderDrafts(legacyRaw).drafts.map((draft) => {
    const order = newOrder("PDL", draft.requester);
    return {
      ...order,
      id: draft.id,
      reservationActivated: false,
      requester: draft.requester,
      cycleId: draft.cycleId,
      expectedDelivery: draft.expectedDelivery,
      notes: draft.notes,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      lines: draft.lines.map((line, index) => {
        const row = rows.find(
          (row) =>
            row.plan.id === line.planId && row.origin.id === line.originId,
        );
        const base = row
          ? originOrderLine(row)
          : {
              ...itemOrderLine({
                id: line.originId,
                code: "",
                description: "Origem indisponível",
                unit: "",
              } as Item),
              planId: line.planId,
              originId: line.originId,
            };
        return {
          ...base,
          id: `${draft.id}:${index}`,
          quantityMilli: line.quantityMilli,
        };
      }),
    };
  });
  return workspace;
}

export function orderTotal(order: Order) {
  let amount = 0n;
  let pending = 0;
  for (const line of order.lines) {
    if (line.unitPriceCents === null || line.quantityMilli <= 0) {
      pending++;
      continue;
    }
    amount +=
      (BigInt(line.quantityMilli) * BigInt(line.unitPriceCents) + 500n) / 1000n;
  }
  return {
    cents: amount <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(amount) : null,
    pending,
  };
}

export function orderBalanceUsage(
  workspace: OrderWorkspace,
  excludeOrderId = "",
) {
  const usage = new Map<
    string,
    {
      reservedMilli: number;
      consumedMilli: number;
      receivedMilli: number;
      manualDebitedMilli: number;
    }
  >();
  const record = (
    key: string,
    reserved: number,
    received: number,
    manual: number,
  ) => {
    if (!reserved && !received && !manual) return;
    const value = usage.get(key) || {
      reservedMilli: 0,
      consumedMilli: 0,
      receivedMilli: 0,
      manualDebitedMilli: 0,
    };
    value.reservedMilli += reserved;
    value.receivedMilli += received;
    value.manualDebitedMilli += manual;
    value.consumedMilli += received + manual;
    if (
      ![
        value.reservedMilli,
        value.consumedMilli,
        value.receivedMilli,
        value.manualDebitedMilli,
      ].every(safe)
    )
      throw new Error("Movimentações excedem o limite de cálculo permitido.");
    usage.set(key, value);
  };
  for (const order of workspace.orders) {
    if (order.kind !== "PDL" || order.id === excludeOrderId) continue;
    const held =
      order.reservationActivated &&
      !["Cancelado", "Concluído"].includes(order.status);
    for (const line of order.lines)
      record(
        originKey(line.planId, line.originId),
        held
          ? line.quantityMilli - line.receivedMilli - line.unfulfilledMilli
          : 0,
        line.receivedMilli,
        0,
      );
  }
  for (const adjustment of workspace.adjustments)
    record(
      originKey(adjustment.planId, adjustment.originId),
      0,
      0,
      adjustment.quantityMilli,
    );
  return usage;
}

export function orderControlRows(
  context: Pick<OrderContext, "plans" | "items">,
  workspace: OrderWorkspace,
  excludeOrderId = "",
) {
  const usage = orderBalanceUsage(workspace, excludeOrderId);
  const baseRows = dlControlRows(context.plans, context.items);
  const knownOrigins = new Set(
    baseRows.map((row) => originKey(row.plan.id, row.origin.id)),
  );
  if (
    [...usage].some(
      ([key, movement]) =>
        !knownOrigins.has(key) &&
        (movement.reservedMilli > 0 || movement.consumedMilli > 0),
    )
  )
    throw new Error(
      "Há pedido com movimentação vinculado a uma origem de DL indisponível. Recupere os dados antes de continuar.",
    );
  return baseRows.map((row) => {
    const movement = usage.get(originKey(row.plan.id, row.origin.id));
    const reservedMilli = movement?.reservedMilli || 0;
    const consumedMilli = movement?.consumedMilli || 0;
    const remainingMilli = row.origin.quantityMilli - consumedMilli;
    const availableMilli = remainingMilli - reservedMilli;
    if (!safe(remainingMilli) || !safe(availableMilli))
      throw new Error(
        "Há movimentações incompatíveis com os saldos das DLs. Revise os pedidos antes de continuar.",
      );
    return {
      ...row,
      origin: {
        ...row.origin,
        reservedMilli,
        receivedMilli: movement?.receivedMilli || 0,
        manualDebitedMilli: movement?.manualDebitedMilli || 0,
        remainingMilli,
        availableMilli,
      },
    };
  });
}

function validateOrder(
  order: Order,
  context: OrderContext,
  workspace: OrderWorkspace,
  execution: boolean,
) {
  if (!order.requester.trim()) throw new Error("Informe o solicitante.");
  if (!order.lines.length) throw new Error("Selecione ao menos um material.");
  if (order.expectedDelivery && !validDate(order.expectedDelivery))
    throw new Error("Informe uma data de entrega válida.");
  if (
    order.kind !== "MOV" &&
    order.cycleId &&
    !context.cycles.some((cycle) => cycle.id === order.cycleId)
  )
    throw new Error("O ciclo selecionado não está disponível.");
  if (order.kind === "PCD" && !order.cycleId)
    throw new Error("Selecione o ciclo de suprimentos deste pedido CD.");
  const rows = orderControlRows(context, workspace, order.id);
  for (const line of order.lines) {
    if (!safe(line.quantityMilli) || line.quantityMilli <= 0)
      throw new Error(
        `Informe uma quantidade positiva para ${line.description}.`,
      );
    if (!context.items.some((item) => item.id === line.itemId && item.active))
      throw new Error(
        `O material ${line.description} está inativo ou indisponível.`,
      );
    if (
      order.kind === "PCD" &&
      !context.cycleWorkspace.lines.some(
        (source) =>
          source.cycleId === order.cycleId && source.itemId === line.itemId,
      )
    )
      throw new Error(
        `Inclua ${line.description} no planejamento do ciclo antes de solicitar.`,
      );
    if (order.kind === "PDL") {
      const row = rows.find(
        (row) => row.plan.id === line.planId && row.origin.id === line.originId,
      );
      if (
        !row ||
        row.origin.itemId !== line.itemId ||
        row.origin.unit !== line.unit ||
        row.origin.unitPriceCents !== line.unitPriceCents ||
        row.origin.supplier !== line.supplier ||
        row.origin.mxmOrder !== line.mxmOrder
      )
        throw new Error(`Revise a origem contratada de ${line.description}.`);
      if (line.quantityMilli > row.origin.availableMilli)
        throw new Error(
          `A quantidade de ${line.description} supera o saldo disponível da origem.`,
        );
      if (
        execution &&
        ["Vigência futura", "Vigência encerrada"].includes(
          contractStatus(row.plan, context.today),
        )
      )
        throw new Error(
          `A DL ${row.plan.code} não está vigente para emitir este pedido.`,
        );
    }
  }
  if (execution) {
    if (
      order.kind === "PDL" &&
      new Set(
        order.lines.map((line) =>
          line.supplier.trim().toLocaleUpperCase("pt-BR"),
        ),
      ).size !== 1
    )
      throw new Error(
        "Para encaminhar, selecione materiais de um único fornecedor. Você pode manter vários fornecedores no rascunho.",
      );
    if (order.kind === "PFR" && !order.reason.trim())
      throw new Error("Informe a justificativa do pedido FR.");
    if (
      order.kind === "ATA" &&
      (!order.contractReference.trim() || !order.supplier.trim())
    )
      throw new Error("Informe a ata/contrato e o fornecedor.");
    if (order.kind === "MOV" && !order.movement)
      throw new Error("Informe se o material é de entrada ou saída.");
  }
}

export function saveOrderDraft(
  workspace: OrderWorkspace,
  order: Order,
  context: OrderContext,
): OrderWorkspace {
  const previous = workspace.orders.find(
    (candidate) => candidate.id === order.id,
  );
  if (
    order.status !== "Rascunho" ||
    (previous && previous.status !== "Rascunho")
  )
    throw new Error("Somente rascunhos podem ser editados.");
  if (
    previous &&
    (previous.kind !== order.kind || previous.code !== order.code)
  )
    throw new Error("O tipo e o número do pedido são protegidos.");
  if (order.externalReference !== (previous?.externalReference || "")) {
    if (order.kind !== "PCD")
      throw new Error("A requisição MXM é informada somente em Transferência.");
    if (!previous?.lines.length)
      throw new Error(
        "Salve os itens da transferência antes de informar a requisição MXM.",
      );
  }
  validateOrder(order, context, workspace, false);
  const next = {
    ...order,
    reservationActivated: order.kind === "PDL",
    updatedAt: new Date().toISOString(),
    events: [
      ...(previous?.events || []),
      event(
        "Rascunho salvo",
        order.requester,
        "Materiais e quantidades atualizados.",
      ),
    ],
  };
  const result = {
    ...workspace,
    orders: [
      next,
      ...workspace.orders.filter((candidate) => candidate.id !== next.id),
    ],
  };
  readOrderWorkspace(JSON.stringify(result));
  orderControlRows(context, result);
  return result;
}

export type OrderAction =
  "submit" | "approve" | "return" | "send" | "receive" | "cancel";
export function transitionOrder(
  workspace: OrderWorkspace,
  id: string,
  action: OrderAction,
  payload: {
    actor: string;
    reason?: string;
    quantities?: Record<string, number>;
    externalReference?: string;
    closePending?: boolean;
  },
  context: OrderContext,
): OrderWorkspace {
  const previous = workspace.orders.find((order) => order.id === id);
  if (!previous) throw new Error("Pedido não encontrado.");
  if (!payload.actor.trim())
    throw new Error("Informe o responsável pelo registro.");
  const order = structuredClone(previous);
  const counters = { ...workspace.counters };
  let details = payload.reason?.trim() || "";
  let actionLabel = "";
  if (action === "submit") {
    if (order.status !== "Rascunho")
      throw new Error("Somente rascunhos podem ser encaminhados.");
    validateOrder(order, context, workspace, true);
    if (!order.code) {
      counters[order.kind]++;
      if (!safe(counters[order.kind]))
        throw new Error("Numeração acima do limite permitido.");
      order.code = `${order.kind}-${String(counters[order.kind]).padStart(4, "0")}`;
    }
    order.reservationActivated = order.kind === "PDL";
    order.status = "Em análise";
    actionLabel = "Encaminhado para análise";
  } else if (action === "approve") {
    if (order.status !== "Em análise")
      throw new Error("Somente pedidos em análise podem ser aprovados.");
    validateOrder(order, context, workspace, true);
    order.status = "Aprovado";
    actionLabel = "Pedido aprovado";
  } else if (action === "return") {
    if (!["Em análise", "Aprovado"].includes(order.status) || !details)
      throw new Error(
        "Informe o motivo para devolver o pedido em análise ou aprovado.",
      );
    order.status = "Rascunho";
    actionLabel = "Devolvido para correção";
  } else if (action === "send") {
    if (order.status !== "Aprovado")
      throw new Error("Aprove o pedido antes de registrar o envio.");
    validateOrder(order, context, workspace, true);
    if (
      order.kind !== "PCD" &&
      payload.externalReference?.trim() &&
      payload.externalReference.trim() !== order.externalReference
    )
      throw new Error("A requisição MXM é informada somente em Transferência.");
    if (order.kind === "PCD")
      order.externalReference =
        payload.externalReference?.trim() || order.externalReference;
    order.status = "Enviado";
    actionLabel = "Envio registrado";
    details = `Registro manual. ${order.externalReference ? `Referência: ${order.externalReference}. ` : ""}${details}`;
  } else if (action === "receive") {
    if (!["Enviado", "Recebimento parcial"].includes(order.status))
      throw new Error("Registre o envio antes do recebimento.");
    const quantities = payload.quantities || {};
    let count = 0;
    if (
      Object.keys(quantities).some(
        (lineId) => !order.lines.some((line) => line.id === lineId),
      )
    )
      throw new Error(
        "O recebimento contém material que não pertence ao pedido.",
      );
    for (const line of order.lines) {
      const quantity = quantities[line.id] ?? 0;
      if (
        !safe(quantity) ||
        quantity >
          line.quantityMilli - line.receivedMilli - line.unfulfilledMilli
      )
        throw new Error(
          `Recebimento acima do pendente ou inválido para ${line.description}.`,
        );
      if (quantity > 0) {
        line.receivedMilli += quantity;
        count++;
      }
    }
    if (!count && !payload.closePending)
      throw new Error(
        "Informe ao menos uma quantidade recebida ou encerre o pedido com os itens não entregues.",
      );
    if (payload.closePending) {
      for (const line of order.lines)
        line.unfulfilledMilli = line.quantityMilli - line.receivedMilli;
      details = `${details}${details ? " · " : ""}Recebimento encerrado; quantidades não entregues liberadas da reserva.`;
    }
    order.status = order.lines.every(
      (line) =>
        line.receivedMilli + line.unfulfilledMilli === line.quantityMilli,
    )
      ? "Concluído"
      : "Recebimento parcial";
    actionLabel =
      order.kind === "MOV" && order.movement === "Saída"
        ? "Atendimento registrado"
        : "Recebimento registrado";
  } else {
    if (["Concluído", "Cancelado"].includes(order.status) || !details)
      throw new Error("Informe o motivo para cancelar um pedido ainda aberto.");
    order.lines.forEach((line) => {
      line.unfulfilledMilli = line.quantityMilli - line.receivedMilli;
    });
    order.status = "Cancelado";
    actionLabel = "Pedido cancelado";
  }
  const record = event(actionLabel, payload.actor, details);
  order.events.push(
    action === "receive"
      ? {
          ...record,
          quantities: Object.entries(payload.quantities || {})
            .filter(([, quantity]) => quantity > 0)
            .map(([lineId, quantityMilli]) => ({ lineId, quantityMilli })),
        }
      : record,
  );
  order.updatedAt = record.timestamp;
  const next = {
    ...workspace,
    counters,
    orders: workspace.orders.map((candidate) =>
      candidate.id === order.id ? order : candidate,
    ),
  };
  readOrderWorkspace(JSON.stringify(next));
  orderControlRows(context, next); // Also validates new commitments and manual receipts against all other orders.
  return next;
}

export function addManualDLAdjustment(
  workspace: OrderWorkspace,
  context: OrderContext,
  input: {
    planId: string;
    originId: string;
    quantityMilli: number;
    actor: string;
    reason: string;
  },
): OrderWorkspace {
  if (!safe(input.quantityMilli) || input.quantityMilli <= 0)
    throw new Error("Informe uma quantidade positiva para a baixa.");
  if (!input.actor.trim() || !input.reason.trim())
    throw new Error("Informe o responsável e a justificativa da baixa manual.");
  const row = orderControlRows(context, workspace).find(
    (row) => row.plan.id === input.planId && row.origin.id === input.originId,
  );
  if (!row) throw new Error("A origem desta baixa não está disponível.");
  if (input.quantityMilli > row.origin.availableMilli)
    throw new Error(
      "A baixa supera o saldo livre. Quantidades reservadas em PDLs não podem ser baixadas manualmente.",
    );
  const next = {
    ...workspace,
    adjustments: [
      ...workspace.adjustments,
      {
        ...input,
        actor: input.actor.trim(),
        reason: input.reason.trim(),
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      },
    ],
  };
  readOrderWorkspace(JSON.stringify(next));
  orderControlRows(context, next);
  return next;
}

export function removeOrderDraft(workspace: OrderWorkspace, id: string) {
  const order = workspace.orders.find((order) => order.id === id);
  if (!order || order.status !== "Rascunho" || order.code)
    throw new Error(
      "Somente rascunhos nunca encaminhados podem ser excluídos. Use cancelar para preservar o histórico dos demais.",
    );
  return {
    ...workspace,
    orders: workspace.orders.filter((order) => order.id !== id),
  };
}
