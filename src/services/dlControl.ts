import type { Item } from "../types";
import type { DLPlan } from "../types/dl";
import { contractOrigins, contractStatus } from "./dlContract.ts";

/** Isolated default so the future settings screen can supply a different rule. */
export const DEFAULT_DL_LOW_BALANCE_PERCENT = 20;
export type DLControlRow = {
  plan: DLPlan;
  origin: ReturnType<typeof contractOrigins>[number] & { manualDebitedMilli?: number };
  item?: Item;
};
export type DLControlSort = "dl" | "supplier" | "item" | "balance";
export type DLControlDirection = "asc" | "desc";
export type DLControlAlert = "lowBalance" | "zeroBalance" | "expiring";
export type DLControlAlertGroup = { plan: DLPlan; rows: DLControlRow[] };
const collator = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

export function dlControlRows(plans: DLPlan[], items: Item[]): DLControlRow[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return plans.flatMap((plan) =>
    contractOrigins(plan).map((origin) => ({
      plan,
      origin,
      item: itemById.get(origin.itemId),
    })),
  );
}

export function selectDLControlRows(
  rows: DLControlRow[],
  filters: {
    query?: string;
    status?: string;
    supplier?: string;
    category?: string;
    showZeroBalances?: boolean;
    sortBy?: DLControlSort;
    direction?: DLControlDirection;
  },
  today: string,
) {
  const {
    query = "",
    status = "",
    supplier = "",
    category = "",
    showZeroBalances = true,
    sortBy = "dl",
    direction = "asc",
  } = filters;
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  return rows
    .filter(
      ({ plan, origin, item }) =>
        (!status || contractStatus(plan, today) === status) &&
        (!supplier || origin.supplier === supplier) &&
        (!category || plan.category === category) &&
        (showZeroBalances || origin.availableMilli !== 0) &&
        `${plan.code} ${plan.title} ${plan.request.officialDLNumber} ${origin.supplier} ${origin.mxmOrder} ${item?.code ?? ""} ${item?.description ?? ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(needle),
    )
    .sort((a, b) => {
      let primary = 0;
      if (sortBy === "supplier")
        primary = collator.compare(a.origin.supplier, b.origin.supplier);
      else if (sortBy === "item")
        primary = collator.compare(
          a.item?.description || a.origin.itemId,
          b.item?.description || b.origin.itemId,
        );
      else if (sortBy === "balance")
        primary = a.origin.availableMilli - b.origin.availableMilli;
      else primary = a.plan.sequenceNumber - b.plan.sequenceNumber;
      return (
        primary * (direction === "desc" ? -1 : 1) ||
        a.plan.sequenceNumber - b.plan.sequenceNumber ||
        collator.compare(
          a.item?.description || a.origin.itemId,
          b.item?.description || b.origin.itemId,
        ) ||
        collator.compare(a.origin.id, b.origin.id)
      );
    });
}

export function isDLLowBalance(
  row: DLControlRow,
  limit = DEFAULT_DL_LOW_BALANCE_PERCENT,
) {
  if (!Number.isInteger(limit) || limit < 0 || limit > 100)
    throw new Error(
      "O limite de saldo baixo deve ser um percentual inteiro de 0 a 100.",
    );
  const { quantityMilli, availableMilli: remainingMilli } = row.origin;
  return (
    quantityMilli > 0 &&
    remainingMilli > 0 &&
    BigInt(remainingMilli) * 100n <= BigInt(quantityMilli) * BigInt(limit)
  );
}

export function dlControlAlertGroups(
  rows: DLControlRow[],
  kind: DLControlAlert,
  today: string,
  limit = DEFAULT_DL_LOW_BALANCE_PERCENT,
): DLControlAlertGroup[] {
  const groups = new Map<string, DLControlAlertGroup>();
  for (const row of rows) {
    const affected =
      kind === "lowBalance"
        ? isDLLowBalance(row, limit)
        : kind === "zeroBalance"
          ? row.origin.availableMilli === 0
          : contractStatus(row.plan, today) === "Vence em até 30 dias";
    if (!affected) continue;
    const group = groups.get(row.plan.id) ?? { plan: row.plan, rows: [] };
    group.rows.push(row);
    groups.set(row.plan.id, group);
  }
  return [...groups.values()].sort(
    (a, b) => a.plan.sequenceNumber - b.plan.sequenceNumber,
  );
}
