export const dlStages = [
  "Rascunho",
  "Em planejamento",
  "Planejamento concluído",
  "Gerar requisição",
  "Analisar requisição gerada",
  "Em processo",
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
  stage: DLStage;
  contract?: DLContract;
  requestWorkflow?: "mxm-review-v1";
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
