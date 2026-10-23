/** Padroniza grafia; não converte quantidades nem deduz unidade pela descrição. */
export function normalizeCatalogUnit(value: string): string {
  const unit = (typeof value === "string" ? value : "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    UNID: "UN",
    "UNID.": "UN",
    UND: "UN",
    UNIDADE: "UN",
    UNIDADES: "UN",
    QUILOGRAMA: "KG",
    QUILOGRAMAS: "KG",
    QUILO: "KG",
    QUILOS: "KG",
    KILO: "KG",
    LITRO: "L",
    LITROS: "L",
    MILILITRO: "ML",
    MILILITROS: "ML",
    GRAMA: "G",
    GRAMAS: "G",
  };
  return aliases[unit] || unit;
}
