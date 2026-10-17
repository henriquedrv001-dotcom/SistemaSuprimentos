import type { Item } from "../types";

export const importFields = [
  { key: "description", label: "Descrição" }, { key: "unit", label: "Unidade" },
  { key: "type", label: "Tipo" }, { key: "group", label: "Grupo" },
  { key: "criterion", label: "Critério" },
] as const;
export type ImportField = typeof importFields[number]["key"];
export type ImportChange = { field: ImportField; label: string; before: string; after: string };
export type ImportUpdate = { before: Item; changes: ImportChange[] };
export type ImportPreview = { filename: string; newItems: Item[]; updates: ImportUpdate[]; unchangedCount: number };
export type ImportSelection = Record<string, ImportField[]>;
const codeKey = (code: string) => code.trim().toUpperCase();
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

function parseRows(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const firstLine = input.split(/\r?\n/, 1)[0];
  const delimiter = [";", ",", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && quoted && input[i + 1] === '"') { cell += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(cell.trim()); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
      if (char === "\r" && input[i + 1] === "\n") i++;
    } else cell += char;
  }
  if (quoted) throw new Error("O arquivo contém aspas sem fechamento. Revise a exportação CSV.");
  row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function buildImportPreview(text: string, items: Item[], filename: string): ImportPreview {
  const rows = parseRows(text);
  if (rows.length < 2) throw new Error("O arquivo precisa conter cabeçalho e pelo menos um item.");
  const aliases: Record<string, string[]> = {
    code: ["codigo", "cod", "codigomxm", "codigounicomxm", "codigounico", "item", "material"],
    description: ["descricao", "descricaoitem", "descricaodoproduto", "produto", "materialdescricao"],
    unit: ["unidade", "unid", "und", "un", "um", "unidadedemedida", "unidademedida", "unidmedida", "unidadedemovimentacao", "unidadeestoque"], type: ["tipo", "tipodematerial", "categoria"],
    group: ["grupo", "grupodemateriais", "grupodematerial"],
    criterion: ["criterio", "criteriodesolicitacao", "solicitacao", "tiposolicitacao"],
  };
  const headers = rows[0].map(normalize);
  const indexes = Object.fromEntries(Object.entries(aliases).map(([key, names]) => {
    const matches = headers.map((header, index) => names.includes(header) ? index : -1).filter(index => index >= 0);
    if (matches.length > 1) throw new Error(`Há mais de uma coluna para ${key}. Use apenas uma coluna por campo.`);
    return [key, matches[0] ?? -1];
  }));
  if (indexes.code < 0 || indexes.description < 0) throw new Error("Não encontrei as colunas obrigatórias Código e Descrição.");
  const existing = new Map<string, Item>();
  for (const item of items) {
    const code = codeKey(item.code);
    if (existing.has(code)) throw new Error(`O código ${code} está repetido no cadastro atual. Corrija a duplicidade antes de importar.`);
    existing.set(code, item);
  }
  const seen = new Set<string>();
  const preview: ImportPreview = { filename, newItems: [], updates: [], unchangedCount: 0 };
  rows.slice(1).forEach((cells, index) => {
    const read = (key: string) => indexes[key] < 0 ? "" : (cells[indexes[key]] ?? "").trim();
    const code = codeKey(read("code")); const description = read("description").toUpperCase();
    if (!code || !description) throw new Error(`Registro ${index + 1}: Código e Descrição são obrigatórios. Nenhum item foi importado.`);
    if (seen.has(code)) throw new Error(`Código repetido no arquivo: ${code}. Corrija a lista antes de importar.`);
    seen.add(code);
    const old = existing.get(code);
    const importedUnit = read("unit").toUpperCase();
    if (!old && !importedUnit) {
      throw new Error(indexes.unit < 0
        ? `Código ${code}: não encontrei a coluna de unidade. Use Unidade, UNID, UND, UN ou Unidade de medida. Não foi usado “UN” como padrão e nenhum item foi importado.`
        : `Código ${code}: a unidade está vazia. Preencha a unidade deste novo material na planilha. Nenhum item foi importado.`);
    }
    const candidate: Item = old ? { ...old, description } : {
      id: `import-${crypto.randomUUID()}`, code, description, unit: importedUnit, type: "SEM TIPO", group: "SEM GRUPO", criterion: "Mensal", active: true, visible: true,
    };
    for (const field of ["unit", "type", "group"] as const) { const value = read(field); if (value) candidate[field] = value.toUpperCase(); }
    const criterion = read("criterion");
    if (criterion) {
      const values: Record<string, Item["criterion"]> = { mensal: "Mensal", entradaesaida: "Entrada e saída", sobsolicitacao: "Sob solicitação" };
      const value = values[normalize(criterion)];
      if (!value) throw new Error(`Código ${code}: critério desconhecido “${criterion}”. Revise antes de importar.`);
      candidate.criterion = value;
    }
    if (!old) preview.newItems.push(candidate);
    else {
      const changes = importFields.filter(field => old[field.key] !== candidate[field.key]).map(field => ({ field: field.key, label: field.label, before: old[field.key] ?? "", after: candidate[field.key] ?? "" }));
      if (changes.length) preview.updates.push({ before: old, changes }); else preview.unchangedCount++;
    }
  });
  return preview;
}

export function planImportUpdates(preview: ImportPreview, selection: ImportSelection, items: Item[]) {
  const updated: { item: Item; changes: ImportChange[] }[] = [];
  const currentById = new Map(items.map(item => [item.id, item]));
  for (const entry of preview.updates) {
    const fields = selection[entry.before.id] ?? [];
    const changes = entry.changes.filter(change => fields.includes(change.field));
    if (!changes.length) continue;
    const current = currentById.get(entry.before.id);
    if (!current || codeKey(current.code) !== codeKey(entry.before.code) || changes.some(change => (current[change.field] ?? "") !== change.before)) {
      throw new Error(`O item ${entry.before.code} mudou depois da prévia. Importe o arquivo novamente para revisar os valores atuais.`);
    }
    // Only allowlisted fields are copied. Identity, specifications, status and links stay untouched.
    const item = { ...current };
    for (const change of changes) {
      if (change.field === "criterion") item.criterion = change.after as Item["criterion"];
      else item[change.field] = change.after;
    }
    updated.push({ item, changes });
  }
  const replacements = new Map(updated.map(entry => [entry.item.id, entry.item]));
  return { items: items.map(item => replacements.get(item.id) ?? item), updated };
}
