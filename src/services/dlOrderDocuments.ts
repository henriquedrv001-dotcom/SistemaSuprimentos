import type { DLPlan, DLOrderDocument } from "../types/dl";
/** Read both versions without changing identifiers or losing an existing file. */
export function dlOrderDocuments(plan: DLPlan): DLOrderDocument[] {
  return [
    ...(plan.processFlow?.purchaseOrder
      ? [plan.processFlow.purchaseOrder]
      : []),
    ...(plan.processFlow?.purchaseOrders ?? []),
  ];
}
