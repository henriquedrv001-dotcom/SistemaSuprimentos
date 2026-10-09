import type { CycleItem, Item, PurchaseOrderSummary, SupplyCycle } from "./types";

export const demoItems: Item[] = [
  { id: "item-001", code: "IT001", description: "Arroz parboilizado", unit: "kg", group: "Gêneros alimentícios", criterion: "Mensal", active: true },
  { id: "item-002", code: "IT002", description: "Açúcar cristal", unit: "kg", group: "Gêneros alimentícios", criterion: "Mensal", active: true },
  { id: "item-003", code: "IT003", description: "Farinha de trigo", unit: "kg", group: "Gêneros alimentícios", criterion: "Mensal", active: true },
  { id: "item-004", code: "IT004", description: "Material de manutenção", unit: "un", group: "Manutenção", criterion: "Sob solicitação", active: true },
];

export const demoCycles: SupplyCycle[] = [
  { id: "cycle-2026-11", name: "Novembro 2026", solicitationStart: "2026-10-08", firstDelivery: "2026-11-11", lastDelivery: "2026-11-26", closingDate: "2026-12-07", status: "Em execução" },
  { id: "cycle-2026-12", name: "Dezembro 2026", solicitationStart: "2026-11-08", firstDelivery: "2026-12-10", lastDelivery: "2026-12-23", closingDate: "2027-01-07", status: "Planejamento" },
];

export const demoCycleItems: CycleItem[] = [
  { id: "ci-001", cycleId: "cycle-2026-11", itemId: "item-001", plannedQuantity: 100, committedQuantity: 60, receivedQuantity: 50 },
  { id: "ci-002", cycleId: "cycle-2026-11", itemId: "item-002", plannedQuantity: 80, committedQuantity: 0, receivedQuantity: 0 },
  { id: "ci-003", cycleId: "cycle-2026-11", itemId: "item-003", plannedQuantity: 40, committedQuantity: 0, receivedQuantity: 0 },
];

export const demoOrders: PurchaseOrderSummary[] = [
  { id: "order-001", type: "PDF", itemDescription: "Arroz parboilizado", cycleName: "Novembro 2026", erpOrderNumber: "47820 (exemplo)", requestedQuantity: 60, receivedQuantity: 50, expectedDelivery: "2026-11-11", status: "Recebimento parcial" },
  { id: "order-002", type: "PCD", itemDescription: "Açúcar cristal", cycleName: "Novembro 2026", requestedQuantity: 80, receivedQuantity: 0, expectedDelivery: "2026-11-14", status: "Aguardando ERP" },
];
