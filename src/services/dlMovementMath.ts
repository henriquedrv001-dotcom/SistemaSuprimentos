import type { OrderLine } from "../types/orders";
import type { DLMovementFlow, MovementArea } from "../types/dlMovement";

const safe = (value: number) => Number.isSafeInteger(value) && value >= 0;
function number(value: bigint) {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Valor acima do limite de cálculo.");
  return Number(value);
}
export function movementLineCents(quantityMilli: number, priceCents: number) {
  if (!safe(quantityMilli) || !safe(priceCents))
    throw new Error("Revise quantidade e preço.");
  return number((BigInt(quantityMilli) * BigInt(priceCents) + 500n) / 1000n);
}
export function emptyMovementFlow(): DLMovementFlow {
  return {
    version: 1,
    phase: "Distribuição",
    planId: "",
    billReference: "",
    billDate: "",
    billTotalCents: 0,
    areas: [],
    invoices: [],
    requests: [],
  };
}
export const movementAreaSuggestions = [
  "Assistência Social",
  "Educação",
  "Esportes",
  "Nutrição",
];

/** Arredonda cada origem uma vez e reparte os centavos residuais sem mudar quantidades/preços. */
export function movementTotals(flow: DLMovementFlow, lines: OrderLine[]) {
  const areaCents = new Map(flow.areas.map((area) => [area.id, 0]));
  const allocationCents = new Map<string, number>();
  const quantities = new Map<string, number>();
  let total = 0;
  for (const line of lines) {
    if (line.unitPriceCents === null || !safe(line.unitPriceCents))
      throw new Error("A origem da DL precisa ter preço contratado.");
    const shares = flow.areas.map((area, index) => {
      const q =
        area.allocations.find((a) => a.lineId === line.id)?.quantityMilli || 0;
      if (!safe(q)) throw new Error("Revise as quantidades da distribuição.");
      const product = BigInt(q) * BigInt(line.unitPriceCents!);
      return {
        id: area.id,
        index,
        q,
        cents: number(product / 1000n),
        remainder: Number(product % 1000n),
      };
    });
    const quantity = number(
      shares.reduce((sum, share) => sum + BigInt(share.q), 0n),
    );
    quantities.set(line.id, quantity);
    const amount = movementLineCents(quantity, line.unitPriceCents);
    let residual = amount - shares.reduce((sum, share) => sum + share.cents, 0);
    for (const share of [...shares].sort(
      (a, b) => b.remainder - a.remainder || a.index - b.index,
    )) {
      if (residual > 0 && share.q > 0) {
        share.cents++;
        residual--;
      }
    }
    for (const share of shares) {
      areaCents.set(
        share.id,
        number(BigInt(areaCents.get(share.id) || 0) + BigInt(share.cents)),
      );
      allocationCents.set(`${share.id}:${line.id}`, share.cents);
    }
    total = number(BigInt(total) + BigInt(amount));
  }
  const target = number(
    flow.areas.reduce((sum, area) => {
      if (!safe(area.targetCents))
        throw new Error("Revise os valores das áreas.");
      return sum + BigInt(area.targetCents);
    }, 0n),
  );
  return {
    totalCents: total,
    targetCents: target,
    areaCents,
    allocationCents,
    quantities,
    billDifferenceCents: flow.billTotalCents - total,
    targetDifferenceCents: flow.billTotalCents - target,
  };
}
export function areaRequestedMilli(
  flow: DLMovementFlow,
  areaId: string,
  lineId: string,
  served = false,
) {
  return number(
    flow.requests
      .filter((request) => request.areaId === areaId)
      .reduce(
        (sum, request) =>
          sum +
          BigInt(
            request.lines
              .filter((line) => line.lineId === lineId)
              .reduce(
                (q, line) =>
                  q + (served ? line.servedMilli : line.quantityMilli),
                0,
              ),
          ),
        0n,
      ),
  );
}
export function allocatedMilli(area: MovementArea, lineId: string) {
  return (
    area.allocations.find((line) => line.lineId === lineId)?.quantityMilli || 0
  );
}

/** Leitura estrita: nunca ignorar uma distribuição ou baixa corrompida. */
export function validateMovementShape(order: import("../types/orders").Order) {
  const flow = order.movementFlow;
  const fail = () => {
    throw new Error(
      "A distribuição de entrada e saída está inconsistente. A cópia original foi preservada.",
    );
  };
  const text = (value: unknown): value is string => typeof value === "string";
  const date = (value: unknown) =>
    text(value) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (
    !flow ||
    order.kind !== "MOV" ||
    flow.version !== 1 ||
    ![
      "Distribuição",
      "Entrada da NF",
      "Solicitações das áreas",
      "Concluído",
      "Cancelado",
    ].includes(flow.phase) ||
    !text(flow.planId) ||
    !text(flow.billReference) ||
    !text(flow.billDate) ||
    !safe(flow.billTotalCents) ||
    !Array.isArray(flow.areas) ||
    !Array.isArray(flow.invoices) ||
    !Array.isArray(flow.requests)
  )
    fail();
  if (!flow) return;
  if (
    !flow.planId ||
    !flow.billTotalCents ||
    !flow.areas.length ||
    !order.lines.length ||
    order.lines.some((line) => !line.quantityMilli)
  )
    fail();
  if (!order.reservationActivated || (flow.billDate && !date(flow.billDate)))
    fail();
  const phaseStatus = {
    Distribuição: "Rascunho",
    "Entrada da NF": "Enviado",
    "Solicitações das áreas": "Recebimento parcial",
    Concluído: "Concluído",
    Cancelado: "Cancelado",
  };
  if (order.status !== phaseStatus[flow.phase]) fail();
  const lineIds = new Set(order.lines.map((line) => line.id));
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const area of flow.areas) {
    if (
      !area ||
      !text(area.id) ||
      !area.id ||
      ids.has(area.id) ||
      !text(area.name) ||
      !area.name.trim() ||
      names.has(area.name.trim().toLocaleLowerCase("pt-BR")) ||
      !safe(area.targetCents) ||
      !Array.isArray(area.allocations)
    )
      fail();
    ids.add(area.id);
    names.add(area.name.trim().toLocaleLowerCase("pt-BR"));
    const allocated = new Set<string>();
    for (const a of area.allocations) {
      if (
        !a ||
        !lineIds.has(a.lineId) ||
        allocated.has(a.lineId) ||
        !safe(a.quantityMilli)
      )
        fail();
      allocated.add(a.lineId);
    }
  }
  if (
    order.lines.some(
      (line) =>
        line.planId !== flow.planId ||
        !line.originId ||
        line.supplier !== order.supplier ||
        line.unitPriceCents === null ||
        line.unitPriceCents <= 0,
    )
  )
    fail();
  const totals = movementTotals(flow, order.lines);
  if (
    order.lines.some(
      (line) => line.quantityMilli !== totals.quantities.get(line.id),
    )
  )
    fail();
  const received = new Map<string, number>();
  const invoiceIds = new Set<string>();
  const invoiceNumbers = new Set<string>();
  let invoiceValue = 0;
  for (const invoice of flow.invoices) {
    if (
      !invoice ||
      !text(invoice.id) ||
      !invoice.id ||
      invoiceIds.has(invoice.id) ||
      !text(invoice.number) ||
      !invoice.number.trim() ||
      invoiceNumbers.has(invoice.number.trim().toUpperCase()) ||
      !date(invoice.issuedOn) ||
      !date(invoice.enteredOn) ||
      invoice.enteredOn < invoice.issuedOn ||
      !safe(invoice.totalCents) ||
      !Array.isArray(invoice.lines) ||
      !invoice.lines.length
    )
      fail();
    invoiceIds.add(invoice.id);
    invoiceNumbers.add(invoice.number.trim().toUpperCase());
    let expected = 0;
    const seen = new Set<string>();
    for (const entry of invoice.lines) {
      const line = order.lines.find((line) => line.id === entry?.lineId);
      if (
        !line ||
        seen.has(entry.lineId) ||
        !safe(entry.quantityMilli) ||
        !entry.quantityMilli
      )
        fail();
      if (!line) return;
      seen.add(entry.lineId);
      const before = received.get(line.id) || 0;
      const after = before + entry.quantityMilli;
      if (!safe(after) || after > line.quantityMilli) fail();
      expected +=
        movementLineCents(after, line.unitPriceCents!) -
        movementLineCents(before, line.unitPriceCents!);
      received.set(line.id, after);
    }
    if (expected !== invoice.totalCents) fail();
    invoiceValue += expected;
  }
  if (
    !safe(invoiceValue) ||
    order.lines.some(
      (line) => line.receivedMilli !== (received.get(line.id) || 0),
    )
  )
    fail();
  const requestIds = new Set<string>();
  const requestReferences = new Set<string>();
  for (const request of flow.requests) {
    if (
      !request ||
      !text(request.id) ||
      !request.id ||
      requestIds.has(request.id) ||
      !ids.has(request.areaId) ||
      !text(request.reference) ||
      !request.reference.trim() ||
      requestReferences.has(request.reference.trim().toUpperCase()) ||
      !date(request.requestedOn) ||
      !Array.isArray(request.lines) ||
      !request.lines.length
    )
      fail();
    requestIds.add(request.id);
    requestReferences.add(request.reference.trim().toUpperCase());
    const seen = new Set<string>();
    for (const entry of request.lines) {
      if (
        !entry ||
        !lineIds.has(entry.lineId) ||
        seen.has(entry.lineId) ||
        !safe(entry.quantityMilli) ||
        entry.quantityMilli <= 0 ||
        !safe(entry.servedMilli) ||
        entry.servedMilli > entry.quantityMilli
      )
        fail();
      seen.add(entry.lineId);
    }
  }
  for (const area of flow.areas)
    for (const line of order.lines)
      if (
        areaRequestedMilli(flow, area.id, line.id) >
        allocatedMilli(area, line.id)
      )
        fail();
  if (
    flow.phase === "Distribuição" &&
    (flow.invoices.length || flow.requests.length)
  )
    fail();
  if (
    flow.phase === "Cancelado" &&
    (flow.invoices.length || flow.requests.length)
  )
    fail();
  if (
    flow.phase === "Entrada da NF" &&
    (flow.requests.length ||
      order.lines.every((line) => line.receivedMilli === line.quantityMilli))
  )
    fail();
  if (
    ["Solicitações das áreas", "Concluído"].includes(flow.phase) &&
    order.lines.some((line) => line.receivedMilli !== line.quantityMilli)
  )
    fail();
  if (
    flow.phase !== "Distribuição" &&
    flow.phase !== "Cancelado" &&
    (totals.billDifferenceCents ||
      totals.targetDifferenceCents ||
      flow.areas.some(
        (area) => area.targetCents !== totals.areaCents.get(area.id),
      ))
  )
    fail();
  if (
    flow.phase === "Concluído" &&
    flow.areas.some((area) =>
      order.lines.some(
        (line) =>
          areaRequestedMilli(flow, area.id, line.id, true) !==
          allocatedMilli(area, line.id),
      ),
    )
  )
    fail();
}
