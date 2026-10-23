export type ExpiryLot = {
  id: string;
  itemId: string;
  batch: string;
  expiresOn: string;
  unit: string;
  initialMilli: number;
  remainingMilli: number;
  createdAt: string;
  createdBy: string;
};
export type ExpiryMovement = {
  id: string;
  lotId: string;
  kind: "Entrada" | "Consumo" | "Descarte" | "Ajuste" | "Conferência";
  quantityMilli: number;
  reason: string;
  actor: string;
  timestamp: string;
  referenceId?: string;
  beforeMilli?: number;
  afterMilli?: number;
};
export type ExpiryWorkspace = {
  version: 1;
  lots: ExpiryLot[];
  movements: ExpiryMovement[];
};
