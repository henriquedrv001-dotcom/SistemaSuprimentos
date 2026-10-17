
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
  technicalSpecification?: string;
  associations?: ItemAssociation[];
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


// Each association keeps its own process/order origin; balances are not aggregated by item.
export interface ItemAssociation {
  id: string;
  processNumber?: string;
  orderNumber?: string;
  erpOrderNumber?: string;
  supplierName?: string;
  availableBalance?: number;
  unit?: string;
}

// Planning is separate from ERP stock and from the legacy demonstration totals.
export interface CyclePlanningLine {
  id: string;
  cycleId: string;
  itemId: string;
  requestGroupId: string | null;
  plannedQuantity: number | null;
  forecastBasis: "Estimativa" | "Consumo anterior" | "Demanda do setor" | "";
  notes: string;
  orderReferences?: string[];
}
export interface CycleRequestGroup { id: string; cycleId: string; name: string }
export interface CycleGroupTemplate { id: string; name: string; itemIds: string[] }
export interface CycleWorkspace {
  version: 1;
  lines: CyclePlanningLine[];
  groups: CycleRequestGroup[];
  templates: CycleGroupTemplate[];
}
export interface CycleItemEvent { itemId: string; action: string; details: string }
