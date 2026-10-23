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
  item?: Pick<Item, "type"> & Partial<Pick<Item, "code" | "group">>,
): ExpiryType | undefined {
  const type = fold(typeof item?.type === "string" ? item.type : "");
  const group = fold(typeof item?.group === "string" ? item.group : "");
  const code = fold(typeof item?.code === "string" ? item.code : "").replace(
    /^ES[\s._-]*/,
    "",
  );
  // As exceções vêm do grupo/código MXM, nunca de palavras soltas na descrição.
  if (
    /^130[56]/.test(code) ||
    /^130[56]/.test(group) ||
    /\bBEBIDAS (?:NAO )?ALCOOLICAS\b/.test(group)
  )
    return "Bebidas";
  if (
    /\bPROTETORES (?:OU|E) BLOQUEADORES SOLARES\b/.test(group) ||
    /^(?:\d+\s*[-–:]?\s*)?(?:PROTETORES|BLOQUEADORES) SOLARES$/.test(group)
  )
    return "Segurança e Proteção";
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
  item ? catalogExpiryType(item) : lot.category;
/** Registros antigos de bebidas são exibidos no Almoxarifado sem regravar dados ao ler. */
export const expiryLocationOf = (lot: ExpiryLot, item?: Item) =>
  expiryTypeOf(lot, item) === "Bebidas"
    ? lot.location || "Almoxarifado"
    : undefined;

export const canRegisterExpiryItem = (
  item: Item,
  type: ExpiryType | "" = "",
) => {
  const category = catalogExpiryType(item);
  return item.active !== false && !!category && (!type || category === type);
};
