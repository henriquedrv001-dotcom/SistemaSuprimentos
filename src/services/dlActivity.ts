import type { DLPlanEvent } from "../types/dl";
export const dlActivityLabels = {
  approval: "Aprovação",
  return: "Correção / reabertura",
  order: "Pedido / vínculo",
  attachment: "Anexo",
  supplier: "Fornecedores",
  request: "Requisição",
  submission: "Envio",
  planning: "Planejamento",
  schedule: "Cronograma",
  justification: "Justificativa",
  status: "Situação",
  other: "Alteração",
} as const;
export type DLActivityType = keyof typeof dlActivityLabels;
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function dlActivityType(action: string): DLActivityType {
  const text = normalized(action.split(":")[0]);
  if (/devolv|reabert|reaberto|correcao|reprovad/.test(text)) return "return";
  if (/anexo|documento/.test(text)) return "attachment";
  if (/associa|vincul|pedido gerado|pedido registrado/.test(text))
    return "order";
  if (/enviad|envio/.test(text) && !/aprovad/.test(text)) return "submission";
  if (/aprovad|aprovacao|analise confirmada|dl concluida/.test(text))
    return "approval";
  if (/justificativa/.test(text)) return "justification";
  if (/cronograma/.test(text)) return "schedule";
  if (/fornecedor|contratacao|resultado/.test(text)) return "supplier";
  if (/requisicao/.test(text)) return "request";
  if (/planejamento|orcamento|materia/.test(text)) return "planning";
  if (/suspens|suspenso|cancel|nao contratado|situacao/.test(text))
    return "status";
  return "other";
}
export function dlActivitySummary(event: DLPlanEvent) {
  const type = dlActivityType(event.action);
  const text = normalized(event.action.split(":")[0]);
  if (type === "approval")
    return /dl concluida/.test(text)
      ? "Dados finais aprovados e saldos iniciais liberados."
      : /requisicao/.test(text)
        ? "Requisição conferida e encaminhada para processo."
        : "Etapa aprovada após conferência.";
  if (type === "return")
    return event.action.includes(":")
      ? event.action.slice(event.action.indexOf(":") + 1).trim()
      : /reab/.test(text)
        ? "Planejamento reaberto para revisão."
        : "Etapa devolvida para correção; consulte a observação.";
  if (type === "order")
    return /associa|vincul/.test(text)
      ? "Associação com pedido incluída ou atualizada."
      : /fechado|gerado/.test(text)
        ? "Pedido gerado e processo de compra fechado."
        : "Pedido de compra registrado.";
  return (
    {
      attachment: "Documentos do pedido adicionados ou atualizados.",
      supplier: "Fornecedores, pedidos MXM e valores atualizados.",
      request: "Dados da requisição MXM atualizados.",
      submission: "Dados enviados para a próxima etapa.",
      planning: "Materiais ou informações do planejamento atualizados.",
      schedule: "Previsões e datas de acompanhamento atualizadas.",
      justification: "Justificativa preparada para a documentação.",
      status: "Situação do processo atualizada.",
      other: "Informações da DL atualizadas.",
    } as Record<string, string>
  )[type];
}
export function dlActivityDate(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : date.toLocaleString("pt-BR");
}
type Snapshot = Record<string, unknown>;
function record(value: unknown): Snapshot {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Snapshot)
    : {};
}
function snapshotChanges(before: Snapshot, after: Snapshot) {
  const lines: string[] = [];
  const prevJust = record(before.justification),
    nextJust = record(after.justification);
  if (JSON.stringify(prevJust) !== JSON.stringify(nextJust)) {
    if (nextJust.text !== prevJust.text && typeof nextJust.text === "string")
      lines.push(`Justificativa: ${nextJust.text}`);
    if (nextJust.completedAt && nextJust.completedAt !== prevJust.completedAt)
      lines.push(
        `Justificativa concluída em ${dlActivityDate(String(nextJust.completedAt))}.`,
      );
  }
  const documents = (snapshot: Snapshot) =>
    [
      snapshot.purchaseOrder,
      ...(Array.isArray(snapshot.purchaseOrders)
        ? snapshot.purchaseOrders
        : []),
    ]
      .filter(Boolean)
      .map(record);
  const oldDocs = documents(before),
    newDocs = documents(after);
  for (const doc of newDocs)
    if (!oldDocs.some((old) => old.id === doc.id))
      lines.push(`Anexo adicionado: ${String(doc.name ?? "Documento")}.`);
  for (const doc of oldDocs)
    if (!newDocs.some((next) => next.id === doc.id))
      lines.push(`Anexo anterior: ${String(doc.name ?? "Documento")}.`);
  for (const [key, label] of [
    ["orderRegistered", "Processo fechado"],
    ["suppliersSubmitted", "Fornecedores enviados para aprovação"],
  ] as const) {
    const previous = record(before[key]),
      next = record(after[key]);
    if (JSON.stringify(previous) !== JSON.stringify(next))
      lines.push(
        next.timestamp
          ? `${label} em ${dlActivityDate(String(next.timestamp))} · ${String(next.actor ?? "Responsável não informado")}.`
          : `${label}: confirmação anterior invalidada.`,
      );
  }
  const prevReturn = record(before.suppliersReturn),
    nextReturn = record(after.suppliersReturn);
  if (
    JSON.stringify(prevReturn) !== JSON.stringify(nextReturn) &&
    nextReturn.reason
  )
    lines.push(`Correção solicitada: ${String(nextReturn.reason)}`);
  return lines.length ? lines : ["Etapas do processo atualizadas."];
}
/** Present the old audit snapshots without changing or discarding stored events. */
export function dlActivityDetails(details: string) {
  return details
    .split("\n")
    .filter((line) => line.trim())
    .flatMap((line) => {
      const prefix = line.match(/^Etap[ae]s do processo:\s*/)?.[0];
      if (!prefix) return [line];
      const body = line.slice(prefix.length);
      let position = body.indexOf(" → ");
      while (position !== -1) {
        try {
          return snapshotChanges(
            record(JSON.parse(body.slice(0, position))),
            record(JSON.parse(body.slice(position + 3))),
          );
        } catch {
          position = body.indexOf(" → ", position + 3);
        }
      }
      return [line];
    });
}
