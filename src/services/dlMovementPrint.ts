import type { Order } from "../types/orders";
import { movementTotals } from "./dlMovementMath.ts";
import { decimalInput, formatMoney } from "./dlPlanning.ts";
const html = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function movementAreaPrintHtml(order: Order, areaId: string) {
  const flow = order.movementFlow;
  const area = flow?.areas.find((area) => area.id === areaId);
  if (!flow || !area) throw new Error("Área não encontrada.");
  const totals = movementTotals(flow, order.lines);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Distribuição · ${html(area.name)}</title><style>body{font:14px system-ui;color:#172b3a;margin:32px}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:10px;border-bottom:1px solid #ccd5df;text-align:left}small{display:block;color:#526378}footer{margin-top:28px}button{padding:10px 16px}@media print{button{display:none}body{margin:12mm}}</style></head><body><button onclick="window.print()">Imprimir / salvar PDF</button><h1>Distribuição por área · ${html(area.name)}</h1><p>${html(order.code || "Prévia de rascunho")} · ${html(flow.phase)}</p><p>Conta: ${html(flow.billReference)} · Data: ${html(flow.billDate)}<br>Fornecedor: ${html(order.supplier)}<br>Responsável: ${html(order.requester)}</p><table><thead><tr><th>DL / pedido MXM</th><th>Material</th><th>Quantidade</th><th>Valor unitário</th><th>Total</th></tr></thead><tbody>${area.allocations
    .filter((a) => a.quantityMilli > 0)
    .map((a) => {
      const line = order.lines.find((line) => line.id === a.lineId)!;
      return `<tr><td>${html(line.dlCode)}<small>${html(line.mxmOrder)}</small></td><td>${html(line.description)}<small>${html(line.code)}</small></td><td>${html(decimalInput(a.quantityMilli, 3))} ${html(line.unit)}</td><td>${formatMoney(line.unitPriceCents!)}</td><td>${formatMoney(totals.allocationCents.get(`${area.id}:${line.id}`) || 0)}</td></tr>`;
    })
    .join(
      "",
    )}</tbody></table><p>Valor da área: <strong>${formatMoney(totals.areaCents.get(area.id) || 0)}</strong> · Previsto: ${formatMoney(area.targetCents)}</p><p>Total da conta: ${formatMoney(flow.billTotalCents)}</p><footer>Distribuição para conferência e solicitação da área. Não é nota fiscal nem comprovação de entrada no MXM.${flow.phase === "Distribuição" ? " Prévia ainda não confirmada." : ""}</footer></body></html>`;
}
export function printMovementArea(order: Order, areaId: string) {
  const markup = movementAreaPrintHtml(order, areaId);
  const popup = window.open("", "_blank");
  if (!popup)
    throw new Error(
      "Permita a abertura da janela de impressão neste navegador.",
    );
  popup.opener = null;
  popup.document.open();
  popup.document.write(markup);
  popup.document.close();
}
