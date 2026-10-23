export type ExpiryType =
  | "Gêneros alimentícios"
  | "Bebidas"
  | "Higiene e Limpeza"
  | "Segurança e Proteção";
export type ExpiryLocation = "Almoxarifado" | "Lanchonete";
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
  category?: ExpiryType;
  location?: ExpiryLocation;
};
export type ExpiryMovement = {
  id: string;
  lotId: string;
  kind:
    | "Entrada"
    | "Consumo"
    | "Descarte"
    | "Ajuste"
    | "Conferência"
    | "Transferência";
  quantityMilli: number;
  reason: string;
  actor: string;
  timestamp: string;
  referenceId?: string;
  transferId?: string;
  counterpartLotId?: string;
  beforeMilli?: number;
  afterMilli?: number;
};
export type ExpiryWorkspace = {
  version: 1;
  lots: ExpiryLot[];
  movements: ExpiryMovement[];
};
