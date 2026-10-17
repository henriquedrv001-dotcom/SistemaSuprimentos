import type { Item } from "../types";

export function buildShareText(items: Item[]): string {
  return ["Materiais selecionados — Cadastro MXM", `${items.length} ${items.length === 1 ? "item" : "itens"}`, "",
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.code} — ${item.description}`,
      `Unidade: ${item.unit} | Critério: ${item.criterion} | Grupo: ${item.group}`, "",
    ]),
  ].join("\n").trim();
}

type ImageRow = { cells: string[][]; height: number };
export type ShareImagePage = { rows: ImageRow[]; height: number };
const widths = [210, 450, 90, 150, 300];
const labels = ["Código MXM", "Descrição", "Unidade", "Critério", "Grupo"];
const width = 1280;

function wrapText(text: string, maxWidth: number, measure: (text: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (current && measure(`${current} ${word}`) <= maxWidth) { current += ` ${word}`; continue; }
      if (current) { lines.push(current); current = ""; }
      for (const char of Array.from(word)) {
        if (current && measure(current + char) > maxWidth) { lines.push(current); current = ""; }
        current += char;
      }
    }
    lines.push(current);
  }
  return lines;
}

export function buildShareImagePages(items: Item[], measure: (text: string) => number): ShareImagePage[] {
  const rows = items.flatMap(item => {
    const cells = [item.code, item.description, item.unit, item.criterion, item.group].map((text, index) => wrapText(text, widths[index] - 24, measure));
    const lineCount = Math.max(...cells.map(cell => cell.length));
    const chunks: ImageRow[] = [];
    // Split very long descriptions across rows instead of clipping or creating an oversized canvas.
    for (let start = 0; start < lineCount; start += 40) {
      const chunk = cells.map(cell => cell.slice(start, start + 40));
      if (start > 0 && !chunk[0].length) chunk[0] = [item.code, "(continuação)"];
      chunks.push({ cells: chunk, height: Math.max(64, Math.max(...chunk.map(cell => cell.length)) * 23 + 24) });
    }
    return chunks;
  });
  const pages: ShareImagePage[] = [];
  let page: ShareImagePage = { rows: [], height: 220 };
  for (const row of rows) {
    if (page.rows.length && page.height + row.height > 1600) { pages.push(page); page = { rows: [], height: 220 }; }
    page.rows.push(row); page.height += row.height;
  }
  if (page.rows.length) pages.push(page);
  return pages;
}

export async function createShareImage(page: ShareImagePage, pageIndex: number, pageCount: number, itemCount: number): Promise<Blob> {
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = page.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("O navegador não conseguiu gerar a imagem.");
  context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#004C99"; context.fillRect(0, 0, width, 8);
  context.font = "bold 17px sans-serif"; context.fillText("SUPRIMENTOS · ESTOQUE", 40, 43);
  context.fillStyle = "#172B3A"; context.font = "bold 30px sans-serif"; context.fillText("Materiais selecionados", 40, 87);
  context.fillStyle = "#596A7A"; context.font = "16px sans-serif";
  context.fillText(`Cadastro MXM · ${itemCount} ${itemCount === 1 ? "item" : "itens"} · Página ${pageIndex + 1} de ${pageCount}`, 40, 117);
  let y = 140;
  context.fillStyle = "#EAF2FA"; context.fillRect(40, y, 1200, 44);
  context.fillStyle = "#004C99"; context.font = "bold 15px sans-serif";
  let x = 40; labels.forEach((label, index) => { context.fillText(label, x + 12, y + 28); x += widths[index]; }); y += 44;
  context.font = "16px sans-serif";
  page.rows.forEach((row, rowIndex) => {
    context.fillStyle = rowIndex % 2 ? "#F7F9FC" : "#ffffff"; context.fillRect(40, y, 1200, row.height);
    let left = 40;
    row.cells.forEach((lines, index) => { context.fillStyle = index === 0 ? "#004C99" : "#172B3A"; lines.forEach((line, lineIndex) => context.fillText(line, left + 12, y + 25 + lineIndex * 23)); left += widths[index]; });
    y += row.height; context.strokeStyle = "#E1E7EE"; context.beginPath(); context.moveTo(40, y); context.lineTo(1240, y); context.stroke();
  });
  context.fillStyle = "#747678"; context.font = "13px sans-serif";
  context.fillText(`Gerado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date())}`, 40, canvas.height - 12);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível gerar o PNG.")), "image/png"));
}
