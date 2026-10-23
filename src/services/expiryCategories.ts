import type { Item } from "../types";
import type { ExpiryLot, ExpiryType } from "../types/expiry";
export const expiryTypes = [
  "Gêneros alimentícios",
  "Bebidas",
  "Higiene e Limpeza",
  "Segurança e Proteção",
] as const;
export const expiryLocations = ["Almoxarifado", "Lanchonete"] as const;
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
export function catalogExpiryType(
  item?: Pick<Item, "type">,
): ExpiryType | undefined {
  const type = fold(typeof item?.type === "string" ? item.type : "");
  if (
    [
      "GENEROS ALIMENTICIOS",
      "GENERO ALIMENTICIO",
      "GENEROS",
      "ALIMENTOS",
      "ALIMENTICIOS",
    ].includes(type)
  )
    return "Gêneros alimentícios";
  if (["BEBIDA", "BEBIDAS"].includes(type)) return "Bebidas";
  if (
    [
      "HIGIENE E LIMPEZA",
      "HIGIENE",
      "LIMPEZA",
      "MATERIAL DE LIMPEZA",
      "MATERIAIS DE LIMPEZA",
    ].includes(type)
  )
    return "Higiene e Limpeza";
  if (
    [
      "SEGURANCA E PROTECAO",
      "SEGURANCA",
      "PROTECAO",
      "EPI",
      "EPIS",
      "EQUIPAMENTOS DE PROTECAO INDIVIDUAL",
    ].includes(type)
  )
    return "Segurança e Proteção";
  return undefined;
}
export const expiryTypeOf = (lot: ExpiryLot, item?: Item) =>
  lot.category || catalogExpiryType(item);
/** Registros antigos de bebidas são exibidos no Almoxarifado sem regravar dados ao ler. */
export const expiryLocationOf = (lot: ExpiryLot, item?: Item) =>
  expiryTypeOf(lot, item) === "Bebidas"
    ? lot.location || "Almoxarifado"
    : undefined;
