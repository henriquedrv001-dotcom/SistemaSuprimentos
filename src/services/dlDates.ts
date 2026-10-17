import type { DLContract } from "../types/dl";
export function validDateOnly(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
function iso(date: Date) {
  const result = date.toISOString().slice(0, 10);
  if (!validDateOnly(result))
    throw new Error("A data calculada excede o limite permitido.");
  return result;
}
export function addCalendarMonths(start: string, months: number): string {
  if (!validDateOnly(start)) throw new Error("Informe uma data-base válida.");
  if (!Number.isSafeInteger(months) || months < 1 || months > 1200)
    throw new Error("Informe um prazo de 1 a 1200 meses inteiros.");
  const [year, month, day] = start.split("-").map(Number);
  const base = new Date(start + "T12:00:00Z");
  base.setUTCDate(1);
  base.setUTCFullYear(year, month - 1 + months, 1);
  const last = new Date(base);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  base.setUTCDate(Math.min(day, last.getUTCDate()));
  return iso(base);
}
export function addDeliveryDays(
  start: string,
  days: number,
  basis: "calendar" | "business",
): string {
  if (!validDateOnly(start)) throw new Error("Informe uma data-base válida.");
  if (!Number.isSafeInteger(days) || days < 0 || days > 3650)
    throw new Error("Informe um prazo de entrega de 0 a 3650 dias inteiros.");
  if (!["calendar", "business"].includes(basis))
    throw new Error("Escolha dias corridos ou úteis para calcular a entrega.");
  const result = new Date(start + "T12:00:00Z");
  if (basis === "calendar") result.setUTCDate(result.getUTCDate() + days);
  else {
    let added = 0;
    while (added < days) {
      result.setUTCDate(result.getUTCDate() + 1);
      if (![0, 6].includes(result.getUTCDay())) added++;
    }
  }
  return iso(result);
}
export function automaticContractValidity<T extends DLContract>(
  contract: T,
): T {
  if (contract.validityMode !== "automatic") return contract;
  const months = contract.validityMonths;
  if (
    months !== null &&
    months !== undefined &&
    (!Number.isSafeInteger(months) || months < 1 || months > 1200)
  )
    throw new Error("Vigência: informe de 1 a 1200 meses inteiros.");
  if (contract.signedOn && !validDateOnly(contract.signedOn))
    throw new Error(
      "Informe uma data da contratação/emissão do pedido válida.",
    );
  return {
    ...contract,
    validFrom: contract.signedOn && months ? contract.signedOn : "",
    validUntil:
      contract.signedOn && months
        ? addCalendarMonths(contract.signedOn, months)
        : "",
  };
}
export function exactValidityMonths(start: string, end: string): number | null {
  if (!validDateOnly(start) || !validDateOnly(end)) return null;
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const months = (ey - sy) * 12 + em - sm;
  return months >= 1 &&
    months <= 1200 &&
    addCalendarMonths(start, months) === end
    ? months
    : null;
}
