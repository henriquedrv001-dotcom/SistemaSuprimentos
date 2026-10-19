export const orderKinds = ["PCD", "PFR", "PDL", "ATA", "MOV"] as const;
export type OrderKind = (typeof orderKinds)[number];
export const orderStatuses = [
  "Rascunho",
  "Em análise",
  "Aprovado",
  "Enviado",
  "Recebimento parcial",
  "Concluído",
  "Cancelado",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export type DLReservationPolicy = "draft";
export type OrderLine = {
  id: string;
  itemId: string;
  code: string;
  description: string;
  unit: string;
  quantityMilli: number;
  unitPriceCents: number | null;
  supplier: string;
  mxmOrder: string;
  planId: string;
  originId: string;
  dlCode: string;
  receivedMilli: number;
  unfulfilledMilli: number;
};
export type OrderEvent = {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
  quantities?: { lineId: string; quantityMilli: number }[];
};
export type Order = {
  id: string;
  kind: OrderKind;
  code: string;
  status: OrderStatus;
  reservationActivated: boolean;
  requester: string;
  cycleId: string;
  expectedDelivery: string;
  supplier: string;
  externalReference: string;
  contractReference: string;
  movement: "" | "Entrada" | "Saída";
  reason: string;
  notes: string;
  lines: OrderLine[];
  events: OrderEvent[];
  createdAt: string;
  updatedAt: string;
};
export type OrderWorkspace = {
  version: 1;
  dlReservationPolicy: DLReservationPolicy;
  adjustments: DLManualDebit[];
  counters: Record<OrderKind, number>;
  orders: Order[];
};
export type DLManualDebit = {
  id: string;
  planId: string;
  originId: string;
  quantityMilli: number;
  reason: string;
  actor: string;
  timestamp: string;
};
export type DLManualDebitInput = Omit<DLManualDebit, "id" | "timestamp">;
