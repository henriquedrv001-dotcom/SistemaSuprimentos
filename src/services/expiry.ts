import type { Item } from "../types";
import type {
  ExpiryLot,
  ExpiryMovement,
  ExpiryWorkspace,
} from "../types/expiry";
import { normalizeCatalogUnit } from "./catalogUnits.ts";
export const expiryKey = "suprimentos:expiry:v1";
export const emptyExpiryWorkspace = (): ExpiryWorkspace => ({
  version: 1,
  lots: [],
  movements: [],
});
const safe = (n: number) => Number.isSafeInteger(n) && n >= 0;
export const expiryDateValid = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export function expiryDays(expiresOn: string, today: string) {
  if (!expiryDateValid(expiresOn) || !expiryDateValid(today))
    throw new Error("Data de validade inválida.");
  return Math.round(
    (Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000,
  );
}
export function expiryStatus(lot: ExpiryLot, today: string) {
  if (lot.remainingMilli === 0) return "Encerrado";
  const days = expiryDays(lot.expiresOn, today);
  return days < 0
    ? "Vencido"
    : days <= 7
      ? "Até 7 dias"
      : days <= 30
        ? "8 a 30 dias"
        : "Acima de 30 dias";
}
export function readExpiryWorkspace(raw: string | null): ExpiryWorkspace {
  if (raw === null) return emptyExpiryWorkspace();
  const ws = JSON.parse(raw) as ExpiryWorkspace;
  const fail = () => {
    throw new Error(
      "Os registros de validade estão inconsistentes. Os dados originais foram preservados.",
    );
  };
  if (
    !ws ||
    ws.version !== 1 ||
    !Array.isArray(ws.lots) ||
    !Array.isArray(ws.movements)
  )
    fail();
  const ids = new Set<string>();
  const signatures = new Set<string>();
  for (const lot of ws.lots) {
    if (
      !lot ||
      ![lot.id, lot.itemId, lot.batch, lot.unit, lot.createdBy].every(
        (v) => typeof v === "string" && v.trim(),
      ) ||
      ids.has(lot.id) ||
      !expiryDateValid(lot.expiresOn) ||
      !safe(lot.initialMilli) ||
      !lot.initialMilli ||
      !safe(lot.remainingMilli) ||
      lot.remainingMilli > lot.initialMilli ||
      typeof lot.createdAt !== "string" ||
      !Number.isFinite(Date.parse(lot.createdAt))
    )
      fail();
    ids.add(lot.id);
    const signature = `${lot.itemId}:${lot.batch.trim().toUpperCase()}:${lot.expiresOn}`;
    if (signatures.has(signature)) fail();
    signatures.add(signature);
  }
  const eventIds = new Set<string>();
  const balances = new Map<string, number>();
  const entries = new Set<string>();
  for (const event of ws.movements) {
    if (
      !event ||
      ![event.id, event.lotId, event.actor, event.reason].every(
        (v) => typeof v === "string" && v.trim(),
      ) ||
      eventIds.has(event.id) ||
      !ids.has(event.lotId) ||
      !["Entrada", "Consumo", "Descarte", "Ajuste"].includes(event.kind) ||
      !safe(event.quantityMilli) ||
      !event.quantityMilli ||
      typeof event.timestamp !== "string" ||
      !Number.isFinite(Date.parse(event.timestamp))
    )
      fail();
    eventIds.add(event.id);
    if (event.kind === "Entrada") {
      if (entries.has(event.lotId)) fail();
      entries.add(event.lotId);
    } else if (!entries.has(event.lotId)) fail();
    const balance =
      (balances.get(event.lotId) || 0) +
      (event.kind === "Entrada" ? event.quantityMilli : -event.quantityMilli);
    if (!safe(balance)) fail();
    balances.set(event.lotId, balance);
  }
  for (const lot of ws.lots) {
    if (
      balances.get(lot.id) !== lot.remainingMilli ||
      ws.movements.find(
        (event) => event.lotId === lot.id && event.kind === "Entrada",
      )?.quantityMilli !== lot.initialMilli
    )
      fail();
  }
  return ws;
}
export function registerExpiry(
  ws: ExpiryWorkspace,
  items: Item[],
  input: {
    id: string;
    itemId: string;
    batch: string;
    expiresOn: string;
    quantityMilli: number;
    actor: string;
    expectedUnit: string;
  },
): ExpiryWorkspace {
  readExpiryWorkspace(JSON.stringify(ws));
  const item = items.find(
    (item) => item.id === input.itemId && item.active !== false,
  );
  if (!item || !normalizeCatalogUnit(item.unit))
    throw new Error(
      "Selecione um material ativo do Cadastro com unidade informada.",
    );
  if (
    normalizeCatalogUnit(item.unit) !== normalizeCatalogUnit(input.expectedUnit)
  )
    throw new Error(
      "A unidade do material mudou. Recarregue e confira a quantidade antes de registrar.",
    );
  if (ws.lots.some((lot) => lot.id === input.id))
    throw new Error("Este registro já foi salvo. Recarregue para conferir.");
  if (
    !input.id ||
    !input.batch.trim() ||
    !input.actor.trim() ||
    !expiryDateValid(input.expiresOn) ||
    !safe(input.quantityMilli) ||
    !input.quantityMilli
  )
    throw new Error(
      "Informe lote, quantidade positiva, validade e responsável.",
    );
  if (
    ws.lots.some(
      (lot) =>
        lot.itemId === item.id &&
        lot.batch.trim().toUpperCase() === input.batch.trim().toUpperCase() &&
        lot.expiresOn === input.expiresOn,
    )
  )
    throw new Error(
      "Este material já possui o mesmo lote e validade. Consulte o registro existente.",
    );
  const now = new Date().toISOString();
  const lot: ExpiryLot = {
    id: input.id,
    itemId: item.id,
    batch: input.batch.trim().toUpperCase(),
    expiresOn: input.expiresOn,
    unit: normalizeCatalogUnit(item.unit),
    initialMilli: input.quantityMilli,
    remainingMilli: input.quantityMilli,
    createdAt: now,
    createdBy: input.actor.trim(),
  };
  return {
    ...ws,
    lots: [...ws.lots, lot],
    movements: [
      ...ws.movements,
      {
        id: crypto.randomUUID(),
        lotId: lot.id,
        kind: "Entrada",
        quantityMilli: lot.initialMilli,
        reason: "Registro inicial de validade",
        actor: lot.createdBy,
        timestamp: now,
      },
    ],
  };
}
export function debitExpiry(
  ws: ExpiryWorkspace,
  input: {
    lotId: string;
    quantityMilli: number;
    kind: Exclude<ExpiryMovement["kind"], "Entrada">;
    actor: string;
    reason: string;
  },
): ExpiryWorkspace {
  readExpiryWorkspace(JSON.stringify(ws));
  const lot = ws.lots.find((lot) => lot.id === input.lotId);
  if (
    !lot ||
    !safe(input.quantityMilli) ||
    input.quantityMilli <= 0 ||
    input.quantityMilli > lot.remainingMilli
  )
    throw new Error(
      "A baixa deve ser positiva e não pode superar o saldo disponível do lote.",
    );
  if (
    !["Consumo", "Descarte", "Ajuste"].includes(input.kind) ||
    !input.actor.trim() ||
    !input.reason.trim()
  )
    throw new Error("Informe tipo, responsável e motivo da baixa.");
  return {
    ...ws,
    lots: ws.lots.map((l) =>
      l.id === lot.id
        ? { ...l, remainingMilli: l.remainingMilli - input.quantityMilli }
        : l,
    ),
    movements: [
      ...ws.movements,
      {
        id: crypto.randomUUID(),
        lotId: lot.id,
        kind: input.kind,
        quantityMilli: input.quantityMilli,
        actor: input.actor.trim(),
        reason: input.reason.trim(),
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/** Valida todos os lotes antes que o repositório grave o resultado uma única vez. */
export function registerExpiryBatch(
  ws: ExpiryWorkspace,
  items: Item[],
  entries: Parameters<typeof registerExpiry>[2][],
): ExpiryWorkspace {
  if (!entries.length) throw new Error("Adicione ao menos um lote.");
  return entries.reduce((next, entry, index) => {
    try {
      return registerExpiry(next, items, entry);
    } catch (cause) {
      throw new Error(
        `Lote ${index + 1}: ${cause instanceof Error ? cause.message : "Dados inválidos."}`,
      );
    }
  }, ws);
}
