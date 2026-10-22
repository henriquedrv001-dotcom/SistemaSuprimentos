/** Conta e distribuição por área do fluxo DL para entrada e saída. */
export type MovementAllocation = { lineId: string; quantityMilli: number };
export type MovementArea = {
  id: string;
  name: string;
  targetCents: number;
  allocations: MovementAllocation[];
};
export type MovementInvoice = {
  id: string;
  number: string;
  issuedOn: string;
  enteredOn: string;
  totalCents: number;
  lines: MovementAllocation[];
};
export type MovementRequest = {
  id: string;
  areaId: string;
  reference: string;
  requestedOn: string;
  lines: { lineId: string; quantityMilli: number; servedMilli: number }[];
};
export type DLMovementFlow = {
  version: 1;
  phase:
    | "Distribuição"
    | "Entrada da NF"
    | "Solicitações das áreas"
    | "Concluído"
    | "Cancelado";
  planId: string;
  billReference: string;
  billDate: string;
  billTotalCents: number;
  areas: MovementArea[];
  invoices: MovementInvoice[];
  requests: MovementRequest[];
};
