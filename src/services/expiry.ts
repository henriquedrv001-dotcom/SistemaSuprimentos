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
  const entries = new Map<string, number>();
  const references = new Set<string>();
  for (const event of ws.movements) {
    if (
      !event ||
      ![event.id, event.lotId, event.actor, event.reason].every(
        (v) => typeof v === "string" && v.trim(),
      ) ||
      eventIds.has(event.id) ||
      !ids.has(event.lotId) ||
      !["Entrada", "Consumo", "Descarte", "Ajuste", "Conferência"].includes(
        event.kind,
      ) ||
      !safe(event.quantityMilli) ||
      (event.quantityMilli === 0 && event.kind !== "Conferência") ||
      typeof event.timestamp !== "string" ||
      !Number.isFinite(Date.parse(event.timestamp))
    )
      fail();
    eventIds.add(event.id);
    if (event.referenceId !== undefined) {
      if (
        typeof event.referenceId !== "string" ||
        !event.referenceId.trim() ||
        references.has(event.referenceId)
      )
        fail();
      references.add(event.referenceId);
    }
    if (event.kind === "Entrada") {
      if (!entries.has(event.lotId))
        entries.set(event.lotId, event.quantityMilli);
    } else if (!entries.has(event.lotId)) fail();
    const before = balances.get(event.lotId) || 0;
    const balance =
      event.kind === "Conferência"
        ? event.afterMilli!
        : before +
          (event.kind === "Entrada"
            ? event.quantityMilli
            : -event.quantityMilli);
    if (!safe(balance)) fail();
    if (
      event.kind === "Conferência" ||
      event.beforeMilli !== undefined ||
      event.afterMilli !== undefined
    ) {
      if (
        !safe(event.beforeMilli!) ||
        !safe(event.afterMilli!) ||
        event.beforeMilli !== before ||
        event.afterMilli !== balance
      )
        fail();
      if (
        event.kind === "Conferência" &&
        event.quantityMilli !== Math.abs(balance - before)
      )
        fail();
    }
    balances.set(event.lotId, balance);
  }
  for (const lot of ws.lots) {
    if (
      balances.get(lot.id) !== lot.remainingMilli ||
      entries.get(lot.id) !== lot.initialMilli
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
  if (
    ws.lots.some((lot) => lot.id === input.id) ||
    ws.movements.some((event) => event.referenceId === input.id)
  )
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
  const existing = ws.lots.find(
    (lot) =>
      lot.itemId === item.id &&
      lot.batch.trim().toUpperCase() === input.batch.trim().toUpperCase() &&
      lot.expiresOn === input.expiresOn,
  );
  if (
    !existing &&
    ws.lots.some(
      (lot) =>
        lot.itemId === item.id &&
        lot.batch.trim().toUpperCase() === input.batch.trim().toUpperCase(),
    )
  )
    throw new Error(
      "Este lote já tem outra validade cadastrada. Confira o lote e a data.",
    );
  if (existing && existing.unit !== normalizeCatalogUnit(item.unit))
    throw new Error("A unidade não corresponde à unidade deste lote.");
  const before = existing?.remainingMilli || 0;
  const after = before + input.quantityMilli;
  if (!safe(after)) throw new Error("Quantidade acima do limite permitido.");
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
    lots: existing
      ? ws.lots.map((row) =>
          row.id === existing.id ? { ...row, remainingMilli: after } : row,
        )
      : [...ws.lots, lot],
    movements: [
      ...ws.movements,
      {
        id: crypto.randomUUID(),
        lotId: existing?.id || lot.id,
        kind: "Entrada",
        referenceId: input.id,
        beforeMilli: before,
        afterMilli: after,
        quantityMilli: lot.initialMilli,
        reason: existing
          ? "Nova entrada no lote"
          : "Registro inicial de validade",
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
    kind: "Consumo" | "Descarte" | "Ajuste";
    today?: string;
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
    input.kind === "Consumo" &&
    expiryDays(lot.expiresOn, input.today || expiryToday()) < 0
  )
    throw new Error(
      "Lote vencido não pode sair como consumo. Registre descarte ou confira o estoque.",
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
        beforeMilli: lot.remainingMilli,
        afterMilli: lot.remainingMilli - input.quantityMilli,
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
  const signatures = new Set<string>();
  return entries.reduce((next, entry, index) => {
    try {
      const signature = JSON.stringify([
        entry.itemId,
        entry.batch.trim().toUpperCase(),
        entry.expiresOn,
      ]);
      if (signatures.has(signature))
        throw new Error(
          "Lote repetido neste formulário. Some as quantidades na mesma linha.",
        );
      signatures.add(signature);
      return registerExpiry(next, items, entry);
    } catch (cause) {
      throw new Error(
        `Lote ${index + 1}: ${cause instanceof Error ? cause.message : "Dados inválidos."}`,
      );
    }
  }, ws);
}

export const expiryToday = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

export function expiryFirstToUse(
  ws: ExpiryWorkspace,
  itemId: string,
  today: string,
) {
  return ws.lots
    .filter(
      (lot) =>
        lot.itemId === itemId &&
        lot.remainingMilli > 0 &&
        expiryDays(lot.expiresOn, today) >= 0,
    )
    .sort(
      (a, b) =>
        a.expiresOn.localeCompare(b.expiresOn) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    )[0];
}

export function addExpiryEntry(
  ws: ExpiryWorkspace,
  items: Item[],
  input: {
    id: string;
    lotId: string;
    quantityMilli: number;
    actor: string;
    expectedUnit: string;
  },
) {
  const lot = ws.lots.find((lot) => lot.id === input.lotId);
  if (!lot) throw new Error("Lote não encontrado.");
  return registerExpiry(ws, items, {
    ...input,
    itemId: lot.itemId,
    batch: lot.batch,
    expiresOn: lot.expiresOn,
  });
}

export type ExpiryCount = {
  lotId: string;
  expectedMilli: number;
  countedMilli: number;
};
/** Conferência física registra inclusive saldo correto e zero, preservando o histórico. */
export function countExpiry(
  ws: ExpiryWorkspace,
  counts: ExpiryCount[],
  actor: string,
  reason: string,
): ExpiryWorkspace {
  readExpiryWorkspace(JSON.stringify(ws));
  if (!counts.length || !actor.trim())
    throw new Error("Informe ao menos uma quantidade contada.");
  const ids = new Set<string>();
  const movements: ExpiryMovement[] = [];
  const now = new Date().toISOString();
  for (const count of counts) {
    const lot = ws.lots.find((lot) => lot.id === count.lotId);
    if (!lot || ids.has(count.lotId) || !safe(count.countedMilli))
      throw new Error("Confira os lotes e as quantidades da conferência.");
    if (lot.remainingMilli !== count.expectedMilli)
      throw new Error(
        "O saldo mudou durante a contagem. Reabra a conferência antes de salvar.",
      );
    if (lot.remainingMilli !== count.countedMilli && !reason.trim())
      throw new Error("Informe o motivo da diferença encontrada.");
    ids.add(lot.id);
    movements.push({
      id: crypto.randomUUID(),
      lotId: lot.id,
      kind: "Conferência",
      quantityMilli: Math.abs(count.countedMilli - lot.remainingMilli),
      beforeMilli: lot.remainingMilli,
      afterMilli: count.countedMilli,
      reason: reason.trim() || "Conferência física: saldo correto",
      actor: actor.trim(),
      timestamp: now,
    });
  }
  const counted = new Map(
    counts.map((count) => [count.lotId, count.countedMilli]),
  );
  return {
    ...ws,
    lots: ws.lots.map((lot) =>
      counted.has(lot.id)
        ? { ...lot, remainingMilli: counted.get(lot.id)! }
        : lot,
    ),
    movements: [...ws.movements, ...movements],
  };
}

/** Identidade do Cadastro e unidade preservadas; nunca agrupa só por descrição. */
export function groupExpiryLots(ws: ExpiryWorkspace) {
  const groups = new Map<
    string,
    {
      key: string;
      itemId: string;
      unit: string;
      lots: ExpiryLot[];
      totalMilli: bigint;
      nearest: ExpiryLot | undefined;
      nearestMilli: bigint;
    }
  >();
  for (const lot of ws.lots) {
    const key = JSON.stringify([lot.itemId, lot.unit]);
    const group = groups.get(key) || {
      key,
      itemId: lot.itemId,
      unit: lot.unit,
      lots: [],
      totalMilli: 0n,
      nearest: undefined,
      nearestMilli: 0n,
    };
    group.lots.push(lot);
    group.totalMilli += BigInt(lot.remainingMilli);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.lots.sort(
      (a, b) =>
        a.expiresOn.localeCompare(b.expiresOn) ||
        a.batch.localeCompare(b.batch),
    );
    group.nearest = group.lots.find((lot) => lot.remainingMilli > 0);
    group.nearestMilli = group.lots
      .filter((lot) => lot.expiresOn === group.nearest?.expiresOn)
      .reduce((sum, lot) => sum + BigInt(lot.remainingMilli), 0n);
  }
  return [...groups.values()].sort(
    (a, b) =>
      (a.nearest?.expiresOn || "9999").localeCompare(
        b.nearest?.expiresOn || "9999",
      ) || a.itemId.localeCompare(b.itemId),
  );
}
export function expiryQuantity(value: number | bigint) {
  const n = BigInt(value);
  const abs = n < 0n ? -n : n;
  const fraction = (abs % 1000n).toString().padStart(3, "0").replace(/0+$/, "");
  return `${n < 0n ? "-" : ""}${abs / 1000n}${fraction ? `,${fraction}` : ""}`;
}
