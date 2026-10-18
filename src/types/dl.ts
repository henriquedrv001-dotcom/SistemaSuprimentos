export const dlStages = [
  "Rascunho",
  "Em planejamento",
  "Planejamento concluído",
  "Gerar requisição",
  "Analisar requisição gerada",
  "Em processo",
  "Pedido gerado",
  "Requisição registrada",
  "Em tramitação",
  "Aguardando dados finais",
  "Concluído",
  "Suspenso",
  "Cancelado",
  "Não contratado",
] as const;
export type DLStage = (typeof dlStages)[number];
export interface DLPlanningLine {
  id: string;
  itemId: string;
  unit: string;
  quantityMilli: number | null;
  estimatedPriceCents: number | null;
}
export interface DLPlan {
  id: string;
  sequenceNumber: number;
  code: string;
  title: string;
  category: string;
  openedOn: string;
  responsible: string;
  justification: string;
  /** Observação legada; conservada para compatibilidade. */
  notes: string;
  deliveryDate?: string;
  /** Estimated months at planning; independent of signed contract dates. */
  plannedValidityMonths?: number | null;
  stage: DLStage;
  contract?: DLContract;
  processFlow?: DLProcessFlow;
  schedule?: DLSchedule;
  requestWorkflow?: "mxm-review-v1" | "mxm-review-v2";
  requestSubmission?: {
    timestamp: string;
    actor: string;
    mxmNumber: string;
    requestDate: string;
  };
  requestReturn?: {
    timestamp: string;
    actor: string;
    reason: string;
    mxmNumber: string;
    requestDate: string;
  };
  requestReview?: {
    timestamp: string;
    actor: string;
    mxmNumber: string;
    requestDate: string;
  };
  lines: DLPlanningLine[];
  request: {
    mxmNumber: string;
    date: string;
    processNumber: string;
    officialDLNumber: string;
    responsible: string;
    notes: string;
  };
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export interface DLPlanEvent {
  id: string;
  planId: string;
  timestamp: string;
  action: string;
  details: string;
  actor: string;
}
export interface DLWorkspace {
  version: 1;
  lastNumber: number;
  plans: DLPlan[];
  events: DLPlanEvent[];
}
export interface DLIdentityDraft {
  deliveryDate?: string;
  title: string;
  category: string;
  openedOn: string;
  responsible: string;
  justification: string;
  notes: string;
}

export interface DLContractAward {
  id: string;
  lineId: string;
  supplier: string;
  supplierReference: string;
  mxmOrder: string;
  orderDate: string;
  quantityMilli: number | null;
  unitPriceCents: number | null;
}
export interface DLContract {
  awards: DLContractAward[];
  notAwarded: { lineId: string; reason: string }[];
  signedOn: string;
  orderDatesFromContract?: true;
  validityMode?: "automatic";
  validityMonths?: number | null;
  validFrom: string;
  validUntil: string;
  notes: string;
  release?: {
    timestamp: string;
    actor: string;
    reference: string;
    confirmedOn: string;
  };
}

export interface DLSchedule {
  coverageStart: string;
  coverageMonths: number | null;
  plannedAuthorizationOn: string;
  authorizationRequestedOn: string;
  authorizationGrantedOn: string;
  plannedRequestOn: string;
  processMonths: number | null;
  deliveryDays: number | null;
  deliveryDayBasis: "" | "calendar" | "business";
  deliveredOn: string;
}

export interface DLSaveOptions {
  release?: boolean;
  reviewRequest?: boolean;
  scheduleOnly?: boolean;
  submitRequest?: boolean;
  returnRequest?: boolean;
  reopenPlanning?: boolean;
  startRequest?: boolean;
  processAction?: "justification" | "registerOrder" | "submitSuppliers" | "returnSuppliers";
}

export interface DLProcessFlow {
  version: 1;
  justification?: { text: string; completedAt?: string };
  /** Legacy single attachment, preserved without rewriting existing records. */
  purchaseOrder?: DLOrderDocument;
  purchaseOrders?: DLOrderDocument[];
  orderRegistered?: { timestamp: string; actor: string };
  suppliersSubmitted?: { timestamp: string; actor: string };
  suppliersReturn?: { timestamp: string; actor: string; reason: string };
}

export interface DLOrderDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  timestamp: string;
  actor: string;
}
