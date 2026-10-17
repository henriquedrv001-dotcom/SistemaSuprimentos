export const dlStages = [
  "Rascunho",
  "Em planejamento",
  "Planejamento concluído",
  "Requisição registrada",
  "Em tramitação",
  "Aguardando dados finais",
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
  notes: string;
  stage: DLStage;
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
  title: string;
  category: string;
  openedOn: string;
  responsible: string;
  justification: string;
  notes: string;
}
