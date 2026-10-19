import type { DLControlRow } from "./dlControl";

export const dlOrderDraftsKey = "suprimentos:dl-order-drafts:v1";
export type DLOrderDraftLine = {
  planId: string;
  originId: string;
  quantityMilli: number;
};
export type DLOrderDraft = {
  id: string;
  requester: string;
  cycleId: string;
  expectedDelivery: string;
  notes: string;
  lines: DLOrderDraftLine[];
  createdAt: string;
  updatedAt: string;
};
export type DLOrderDraftWorkspace = { version: 1; drafts: DLOrderDraft[] };
export const originKey = (planId: string, originId: string) =>
  JSON.stringify([planId, originId]);

export function readDLOrderDrafts(raw: string | null): DLOrderDraftWorkspace {
  if (raw === null) return { version: 1, drafts: [] };
  const data = JSON.parse(raw) as DLOrderDraftWorkspace;
  const ids = new Set<string>();
  if (!data || data.version !== 1 || !Array.isArray(data.drafts))
    throw new Error(
      "Formato de rascunhos de pedidos não reconhecido. Os dados salvos foram preservados.",
    );
  for (const draft of data.drafts) {
    if (
      !draft ||
      typeof draft.id !== "string" ||
      !draft.id ||
      ids.has(draft.id) ||
      ![
        draft.requester,
        draft.cycleId,
        draft.expectedDelivery,
        draft.notes,
        draft.createdAt,
        draft.updatedAt,
      ].every((value) => typeof value === "string") ||
      !Array.isArray(draft.lines) ||
      !draft.lines.length
    )
      throw new Error(
        "Rascunho de pedido inválido. Os dados salvos foram preservados.",
      );
    ids.add(draft.id);
    const origins = new Set<string>();
    for (const line of draft.lines) {
      if (
        !line ||
        typeof line.planId !== "string" ||
        !line.planId ||
        typeof line.originId !== "string" ||
        !line.originId ||
        !Number.isSafeInteger(line.quantityMilli) ||
        line.quantityMilli <= 0 ||
        origins.has(originKey(line.planId, line.originId))
      )
        throw new Error(
          "Origem ou quantidade inválida no rascunho. Os dados salvos foram preservados.",
        );
      origins.add(originKey(line.planId, line.originId));
    }
  }
  return data;
}

/** A draft does not reserve, consume, or change an acquisition's released balances. */
export function validateDLOrderDraft(
  draft: DLOrderDraft,
  rows: DLControlRow[],
) {
  if (!draft.lines.length)
    throw new Error("Selecione ao menos um material para o pedido.");
  if (
    draft.lines.some(
      (line) =>
        !Number.isSafeInteger(line.quantityMilli) || line.quantityMilli <= 0,
    )
  )
    throw new Error(
      "Informe uma quantidade maior que zero para cada material selecionado.",
    );
  readDLOrderDrafts(JSON.stringify({ version: 1, drafts: [draft] }));
  if (!draft.requester.trim()) throw new Error("Informe o solicitante.");
  if (
    draft.expectedDelivery &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(draft.expectedDelivery) ||
      !Number.isFinite(Date.parse(draft.expectedDelivery)) ||
      new Date(draft.expectedDelivery).toISOString().slice(0, 10) !==
        draft.expectedDelivery)
  )
    throw new Error("Informe uma data de entrega válida.");
  const byOrigin = new Map(
    rows.map((row) => [originKey(row.plan.id, row.origin.id), row]),
  );
  for (const line of draft.lines) {
    const row = byOrigin.get(originKey(line.planId, line.originId));
    if (!row)
      throw new Error(
        "Um dos materiais não possui mais uma origem liberada. Revise os itens do rascunho.",
      );
    if (line.quantityMilli > row.origin.availableMilli)
      throw new Error(
        `A quantidade de ${row.item?.description || row.origin.itemId} ultrapassa o saldo disponível da origem.`,
      );
  }
}

export function draftTotalCents(
  draft: DLOrderDraft,
  rows: DLControlRow[],
): number | null {
  let total = 0n;
  for (const line of draft.lines) {
    const row = rows.find(
      (row) => row.plan.id === line.planId && row.origin.id === line.originId,
    );
    if (!row) return null;
    total +=
      (BigInt(line.quantityMilli) * BigInt(row.origin.unitPriceCents) + 500n) /
      1000n;
  }
  return total > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(total);
}

export function persistDLOrderDrafts(
  storage: Pick<Storage, "getItem" | "setItem">,
  expectedRaw: string | null,
  next: DLOrderDraftWorkspace,
) {
  if (storage.getItem(dlOrderDraftsKey) !== expectedRaw)
    throw new Error(
      "Os pedidos mudaram em outra aba. Recarregue a tela antes de salvar; suas alterações ainda estão abertas.",
    );
  const raw = JSON.stringify(next);
  readDLOrderDrafts(raw);
  storage.setItem(dlOrderDraftsKey, raw);
  return raw;
}
