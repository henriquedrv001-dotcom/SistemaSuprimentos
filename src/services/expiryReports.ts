import { expiryTypeOf, expiryLocationOf } from "./expiryCategories.ts";
import type { Item } from "../types";
import type { ExpiryWorkspace } from "../types/expiry";
import { expiryStatus } from "./expiry.ts";

const quantity = (value: number) =>
  (value / 1000).toLocaleString("pt-BR", {
    useGrouping: false,
    maximumFractionDigits: 3,
  });
const cell = (value: string | number) => {
  const text = String(value);
  const safe =
    typeof value === "string" && /^[=+@\-]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
/** CSV completo, independente dos filtros visuais, com histórico preservado. */
export function expiryCsv(
  ws: ExpiryWorkspace,
  items: Item[],
  report: "lots" | "history",
  today: string,
) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const lots = new Map(ws.lots.map((lot) => [lot.id, lot]));
  const rows =
    report === "lots"
      ? [
          [
            "Código",
            "Material",
            "Lote",
            "Validade",
            "Unidade",
            "Saldo",
            "Situação",
            "Última conferência",
            "Tipo",
            "Local",
          ],
          ...ws.lots.map((lot) => {
            const item = byId.get(lot.itemId);
            const audit = ws.movements
              .filter(
                (event) =>
                  event.lotId === lot.id && event.kind === "Conferência",
              )
              .at(-1);
            return [
              item?.code || lot.itemId,
              item?.description || "",
              lot.batch,
              lot.expiresOn,
              lot.unit,
              quantity(lot.remainingMilli),
              expiryStatus(lot, today),
              audit?.timestamp || "",
              expiryTypeOf(lot, item) || "Sem classificação",
              expiryLocationOf(lot, item) || "",
            ];
          }),
        ]
      : [
          [
            "Data e hora",
            "Código",
            "Material",
            "Lote",
            "Validade",
            "Movimento",
            "Quantidade",
            "Unidade",
            "Saldo anterior",
            "Saldo após",
            "Motivo",
            "Responsável",
            "Tipo",
            "Local",
            "Transferência",
          ],
          ...ws.movements.map((event) => {
            const lot = lots.get(event.lotId)!;
            const item = byId.get(lot.itemId);
            return [
              event.timestamp,
              item?.code || lot.itemId,
              item?.description || "",
              lot.batch,
              lot.expiresOn,
              event.kind === "Transferência"
                ? `Transferência (${event.afterMilli! > event.beforeMilli! ? "entrada" : "saída"})`
                : event.kind,
              quantity(event.quantityMilli),
              lot.unit,
              event.beforeMilli === undefined
                ? ""
                : quantity(event.beforeMilli),
              event.afterMilli === undefined ? "" : quantity(event.afterMilli),
              event.reason,
              event.actor,
              expiryTypeOf(lot, item) || "Sem classificação",
              expiryLocationOf(lot, item) || "",
              event.transferId || "",
            ];
          }),
        ];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
}
