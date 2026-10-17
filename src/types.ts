
export type SolicitationCriterion =
  | "Mensal"
  | "Entrada e saída"
  | "Sob solicitação";

export interface Item {
  id: string;
  code: string;
  description: string;
  unit: string;
  type: string;
  group: string;
  criterion: SolicitationCriterion;
  active: boolean;
  visible: boolean;
}

export interface SupplyCycle {
  id: string;
  name: string;
  solicitationStart: string;
  firstDelivery: string;
  lastDelivery: string;
  closingDate: string;
  status: "Planejamento" | "Em execução" | "Encerrado";
}

export interface CycleItem {
  id: string;
  cycleId: string;
  itemId: string;
  plannedQuantity: number;
  committedQuantity: number;
  receivedQuantity: number;
}

export interface PurchaseOrderSummary {
  id: string;
  type: "PCD" | "PDF";
  itemDescription: string;
  cycleName: string;
  erpOrderNumber?: string;
  requestedQuantity: number;
  receivedQuantity: number;
  expectedDelivery: string;
  status:
    | "Aguardando ERP"
    | "Aguardando entrega"
    | "Recebimento parcial"
    | "Concluído"
    | "Com ocorrência";
}
export interface ItemHistoryEntry {
  id: string;
  itemId: string;
  code: string;
  action: string;
  details: string;
  timestamp: string;
}
