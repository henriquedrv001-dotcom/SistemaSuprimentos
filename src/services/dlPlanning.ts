import { guardDLProcess, validateDLProcess } from "./dlProcess.ts";
import { validateDLSchedule } from "./dlSchedule.ts";
import { dlObservation, resolveDLRequestStage } from "./dlRequest.ts";
import type { Item } from "../types";
import type {
  DLSaveOptions,
  DLIdentityDraft,
  DLPlan,
  DLPlanningLine,
  DLWorkspace,
} from "../types/dl";
import { validateDLContract } from "./dlContract.ts";
import { dlStages } from "../types/dl.ts";

export const dlWorkspaceKey = "suprimentos:dl-planning:v1";
export const emptyDLWorkspace = (): DLWorkspace => ({
  version: 1,
  lastNumber: 28,
  plans: [],
  events: [],
});
export const formatDLCode = (sequence: number) =>
  `DL-${String(sequence).padStart(4, "0")}`;
export const editableDLItems = (plan: DLPlan) =>
  plan.stage === "Rascunho" || plan.stage === "Em planejamento";
export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export const todayInBrazil = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function decimalInput(scaled: number | null, places: number) {
  if (scaled === null) return "";
  const factor = 10 ** places;
  return `${Math.floor(scaled / factor)}${
    scaled % factor
      ? `,${String(scaled % factor)
          .padStart(places, "0")
          .replace(/0+$/, "")}`
      : ""
  }`;
}
export function parseScaledInput(
  value: string,
  places: 2 | 3,
  label: string,
): number | null {
  const input = value.trim();
  if (!input) return null;
  if (
    input.length > 20 ||
    !new RegExp(`^\\d+(?:[.,]\\d{1,${places}})?$`).test(input)
  )
    throw new Error(
      `${label}: use números sem separador de milhar, com até ${places} casas decimais.`,
    );
  const [whole, fraction = ""] = input.replace(",", ".").split(".");
  const scaled =
    BigInt(whole) * 10n ** BigInt(places) +
    BigInt(fraction.padEnd(places, "0") || "0");
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error(`${label}: valor acima do limite permitido.`);
  return Number(scaled);
}
export function lineSubtotal(line: DLPlanningLine): number | null {
  if (line.quantityMilli === null || line.estimatedPriceCents === null)
    return null;
  const rounded =
    (BigInt(line.quantityMilli) * BigInt(line.estimatedPriceCents) + 500n) /
    1000n;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Subtotal acima do limite permitido.");
  return Number(rounded);
}
export function planBudget(lines: DLPlanningLine[]) {
  let total = 0n;
  let incomplete = 0;
  for (const line of lines) {
    const subtotal = lineSubtotal(line);
    if (subtotal === null) incomplete++;
    else total += BigInt(subtotal);
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Orçamento acima do limite permitido.");
  return { totalCents: Number(total), incomplete };
}
function validDate(date: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(`${date}T12:00:00Z`)) &&
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date
  );
}
export function validateDLPlan(plan: DLPlan) {
  if (!plan.title.trim()) throw new Error("Informe o objeto/título da DL.");
  if (
    plan.deliveryDate !== undefined &&
    (typeof plan.deliveryDate !== "string" ||
      (plan.deliveryDate && !validDate(plan.deliveryDate)))
  )
    throw new Error("Informe uma data de entrega válida.");
  if (
    ["Gerar requisição", "Analisar requisição gerada", "Em processo"].includes(
      plan.stage,
    ) &&
    !plan.deliveryDate
  )
    throw new Error(
      "Informe a data de entrega para preparar ou tramitar a requisição MXM.",
    );
  if (!validDate(plan.openedOn))
    throw new Error("Informe uma data de abertura válida.");
  if (
    plan.requestWorkflow !== undefined &&
    !["mxm-review-v1", "mxm-review-v2"].includes(plan.requestWorkflow)
  )
    throw new Error("Fluxo da requisição inválido.");
  if (!dlStages.includes(plan.stage))
    throw new Error("Situação do planejamento inválida.");
  if (
    !Number.isSafeInteger(plan.sequenceNumber) ||
    plan.sequenceNumber < 29 ||
    plan.code !== formatDLCode(plan.sequenceNumber)
  )
    throw new Error("Número interno de DL inválido.");
  if (
    new Set(plan.lines.map((line) => line.itemId)).size !== plan.lines.length ||
    new Set(plan.lines.map((line) => line.id)).size !== plan.lines.length
  )
    throw new Error("Há materiais repetidos no planejamento.");
  for (const line of plan.lines) {
    if (!line.id || !line.itemId || !line.unit.trim())
      throw new Error("Há um material sem identificação ou unidade.");
    if (
      line.quantityMilli !== null &&
      (!Number.isSafeInteger(line.quantityMilli) || line.quantityMilli <= 0)
    )
      throw new Error(
        "As quantidades informadas devem ser maiores que zero. Deixe em branco para definir no rascunho.",
      );
    if (
      line.estimatedPriceCents !== null &&
      (!Number.isSafeInteger(line.estimatedPriceCents) ||
        line.estimatedPriceCents < 0)
    )
      throw new Error("Os preços previstos não podem ser negativos.");
  }
  const budget = planBudget(plan.lines);
  const requiresBudget = [
    "Planejamento concluído",
    "Gerar requisição",
    "Analisar requisição gerada",
    "Em processo",
    "Pedido gerado",
    "Requisição registrada",
    "Em tramitação",
    "Aguardando dados finais",
    "Concluído",
  ].includes(plan.stage);
  if (requiresBudget && (!plan.lines.length || budget.incomplete))
    throw new Error(
      "Complete os materiais, quantidades e preços previstos antes de concluir o planejamento ou avançar a tramitação.",
    );
  if (
    [
      "Analisar requisição gerada",
      "Em processo",
      "Pedido gerado",
      "Requisição registrada",
      "Em tramitação",
      "Aguardando dados finais",
      "Concluído",
    ].includes(plan.stage) &&
    (!plan.request.mxmNumber.trim() || !validDate(plan.request.date))
  )
    throw new Error(
      "Informe o número e a data da requisição MXM para esta etapa.",
    );
  if (plan.request.date && !validDate(plan.request.date))
    throw new Error("A data da requisição é inválida.");
  if (
    ["Cancelado", "Suspenso", "Não contratado"].includes(plan.stage) &&
    !plan.request.notes.trim() &&
    !dlObservation(plan).trim()
  )
    throw new Error(
      "Registre o motivo nas observações para suspender, cancelar ou indicar que não foi contratado.",
    );
  if (
    plan.requestReview &&
    (!validDate(plan.requestReview.requestDate) ||
      !Number.isFinite(Date.parse(plan.requestReview.timestamp)) ||
      !plan.requestReview.actor.trim())
  )
    throw new Error("O registro de análise da requisição é inválido.");
  if (
    (plan.stage === "Em processo" ||
      (plan.requestWorkflow &&
        ["Pedido gerado", "Aguardando dados finais", "Concluído"].includes(
          plan.stage,
        ))) &&
    (!plan.deliveryDate ||
      !plan.requestReview ||
      plan.requestReview.mxmNumber !== plan.request.mxmNumber.trim() ||
      plan.requestReview.requestDate !== plan.request.date)
  )
    throw new Error(
      "Confirme a análise da requisição gerada antes de seguir em processo.",
    );
  for (const record of [plan.requestSubmission, plan.requestReturn])
    if (
      record &&
      (!Number.isFinite(Date.parse(record.timestamp)) ||
        !record.actor.trim() ||
        !record.mxmNumber.trim() ||
        !validDate(record.requestDate))
    )
      throw new Error("Registro de envio/devolução da requisição inválido.");
  if (plan.requestReturn && !plan.requestReturn.reason.trim())
    throw new Error("A devolução precisa de uma observação para correção.");
  if (
    plan.requestWorkflow === "mxm-review-v2" &&
    [
      "Analisar requisição gerada",
      "Em processo",
      "Pedido gerado",
      "Aguardando dados finais",
      "Concluído",
    ].includes(plan.stage) &&
    (!plan.requestSubmission ||
      plan.requestSubmission.mxmNumber !== plan.request.mxmNumber.trim() ||
      plan.requestSubmission.requestDate !== plan.request.date)
  )
    throw new Error(
      "Envie explicitamente a requisição para análise antes de avançar.",
    );
  validateDLContract(plan);
  validateDLSchedule(plan);
  validateDLProcess(plan);
  return plan;
}
export function readDLWorkspace(raw: string | null): DLWorkspace {
  if (raw === null) return emptyDLWorkspace();
  const value = JSON.parse(raw) as DLWorkspace;
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.plans) ||
    !Array.isArray(value.events) ||
    !Number.isSafeInteger(value.lastNumber) ||
    value.lastNumber < 28
  )
    throw new Error(
      "O planejamento de DLs salvo não pôde ser lido. A cópia original foi preservada.",
    );
  for (const plan of value.plans) {
    if (
      !plan ||
      typeof plan.id !== "string" ||
      !Array.isArray(plan.lines) ||
      !plan.request ||
      !Number.isSafeInteger(plan.revision) ||
      plan.revision < 1
    )
      throw new Error("Há uma DL inválida nos dados salvos.");
    validateDLPlan(plan);
  }
  if (
    new Set(value.plans.map((plan) => plan.sequenceNumber)).size !==
      value.plans.length ||
    new Set(value.plans.map((plan) => plan.id)).size !== value.plans.length
  )
    throw new Error(
      "Há números ou identificadores de DL repetidos. Revise os dados salvos.",
    );
  const originIds = value.plans.flatMap(
    (plan) => plan.contract?.awards.map((award) => award.id) ?? [],
  );
  if (new Set(originIds).size !== originIds.length)
    throw new Error("Há identificadores de contratação repetidos entre DLs.");
  if (
    value.events.some(
      (event) =>
        !event ||
        typeof event.id !== "string" ||
        typeof event.planId !== "string" ||
        typeof event.details !== "string" ||
        typeof event.timestamp !== "string",
    )
  )
    throw new Error("O histórico de DLs contém registros inválidos.");
  return value;
}
export function nextDLNumber(workspace: DLWorkspace) {
  const number =
    Math.max(
      28,
      workspace.lastNumber,
      ...workspace.plans.map((plan) => plan.sequenceNumber),
    ) + 1;
  if (!Number.isSafeInteger(number))
    throw new Error("A sequência de DLs atingiu o limite permitido.");
  return number;
}
export function newDLPlan(
  workspace: DLWorkspace,
  draft: DLIdentityDraft,
): DLPlan {
  const sequenceNumber = nextDLNumber(workspace);
  const timestamp = new Date().toISOString();
  return validateDLPlan({
    ...draft,
    title: draft.title.trim(),
    category: draft.category.trim(),
    responsible: draft.responsible.trim(),
    justification: draft.justification.trim(),
    notes: draft.notes.trim(),
    deliveryDate: draft.deliveryDate ?? "",
    id: `dl-${crypto.randomUUID()}`,
    code: formatDLCode(sequenceNumber),
    sequenceNumber,
    createdAt: timestamp,
    updatedAt: timestamp,
    revision: 1,
    stage: "Rascunho",
    lines: [],
    request: {
      mxmNumber: "",
      date: "",
      processNumber: "",
      officialDLNumber: "",
      responsible: "",
      notes: "",
    },
  });
}
export function addDLItems(plan: DLPlan, items: Item[], ids: string[]) {
  if (!editableDLItems(plan))
    throw new Error("Reabra o planejamento para alterar seus materiais.");
  const existing = new Set(plan.lines.map((line) => line.itemId));
  const byId = new Map(items.map((item) => [item.id, item]));
  const added: DLPlanningLine[] = [];
  let skipped = 0;
  for (const id of new Set(ids)) {
    const item = byId.get(id);
    if (existing.has(id) || !item || item.active === false) {
      skipped++;
      continue;
    }
    if (!item.unit.trim())
      throw new Error(
        `O material ${item.code} está sem unidade. Corrija o cadastro antes de incluir na DL.`,
      );
    added.push({
      id: `dl-line-${crypto.randomUUID()}`,
      itemId: id,
      unit: item.unit.trim(),
      quantityMilli: null,
      estimatedPriceCents: null,
    });
    existing.add(id);
  }
  return {
    plan: { ...plan, lines: [...plan.lines, ...added] },
    added,
    skipped,
  };
}
export function storeDLPlan(
  workspace: DLWorkspace,
  candidate: DLPlan,
  action: string,
  details: string,
  options?: DLSaveOptions,
) {
  const previous = workspace.plans.find((plan) => plan.id === candidate.id);
  candidate = resolveDLRequestStage(candidate, previous);
  if (previous) {
    guardDLProcess(previous, candidate, options);
    const planningData = (plan: DLPlan) =>
      JSON.stringify({
        title: plan.title,
        category: plan.category,
        openedOn: plan.openedOn,
        responsible: plan.responsible,
        justification: plan.justification,
        notes: plan.notes,
        deliveryDate: plan.deliveryDate,
        lines: plan.lines,
      });
    if (!editableDLItems(previous)) {
      if (planningData(previous) !== planningData(candidate))
        throw new Error(
          "O planejamento está fechado. Reabra antes de alterar suas informações.",
        );
      if (editableDLItems(candidate) && !options?.reopenPlanning)
        throw new Error(
          "Use a ação Reabrir planejamento para liberar a edição.",
        );
    }
    if (
      options?.reopenPlanning &&
      (previous.contract?.release ||
        candidate.stage !== "Em planejamento" ||
        candidate.requestSubmission ||
        candidate.requestReview)
    )
      throw new Error(
        "Reabertura inválida. Preserve os dados e reinicie a conferência da requisição.",
      );
    if (
      ["Gerar requisição", "Analisar requisição gerada"].includes(
        previous.stage,
      ) &&
      JSON.stringify(previous.contract) !== JSON.stringify(candidate.contract)
    )
      throw new Error(
        "A contratação só pode ser alterada após a análise da requisição.",
      );
    const changedRequest =
      previous.request.mxmNumber !== candidate.request.mxmNumber ||
      previous.request.date !== candidate.request.date;
    if (
      changedRequest &&
      previous.stage !== "Gerar requisição" &&
      !editableDLItems(previous)
    )
      throw new Error(
        "A requisição enviada está bloqueada. Devolva para correção antes de alterar número ou data.",
      );
    if (
      previous.stage === "Gerar requisição" &&
      candidate.stage === "Analisar requisição gerada" &&
      !options?.submitRequest
    )
      throw new Error("Use Enviar para análise para encaminhar a requisição.");
    if (
      previous.stage === "Analisar requisição gerada" &&
      candidate.stage === "Gerar requisição" &&
      (!options?.returnRequest || !candidate.requestReturn?.reason.trim())
    )
      throw new Error(
        "Devolva a requisição com uma observação para liberar a correção.",
      );
    if (
      previous.stage !== "Gerar requisição" &&
      candidate.stage === "Gerar requisição" &&
      previous.stage !== "Analisar requisição gerada" &&
      !options?.startRequest
    )
      throw new Error("Use a ação Gerar requisição para iniciar essa etapa.");
    if (
      JSON.stringify(previous.requestSubmission) !==
        JSON.stringify(candidate.requestSubmission) &&
      !options?.submitRequest &&
      !options?.reopenPlanning &&
      !options?.startRequest
    )
      throw new Error(
        "O registro de envio só pode ser alterado pelo envio explícito ou pela reabertura.",
      );
    if (
      JSON.stringify(previous.requestReturn) !==
        JSON.stringify(candidate.requestReturn) &&
      !options?.returnRequest
    )
      throw new Error(
        "A observação de devolução deve ser registrada pela ação de devolução.",
      );
  }

  if (
    candidate.stage === "Em processo" &&
    previous?.stage !== "Em processo" &&
    (!options?.reviewRequest ||
      previous?.stage !== "Analisar requisição gerada")
  )
    throw new Error(
      "Use a confirmação de análise da requisição antes de seguir em processo.",
    );
  if (
    previous &&
    ["Gerar requisição", "Analisar requisição gerada"].includes(
      previous.stage,
    ) &&
    ["Pedido gerado", "Aguardando dados finais", "Concluído"].includes(
      candidate.stage,
    )
  )
    throw new Error(
      "Analise a requisição gerada e confirme Em processo antes de avançar à contratação.",
    );
  if (
    previous &&
    (candidate.revision !== previous.revision ||
      candidate.sequenceNumber !== previous.sequenceNumber ||
      candidate.code !== previous.code)
  )
    throw new Error(
      "A DL mudou depois da abertura. Recarregue para revisar a versão atual.",
    );
  if (
    !previous &&
    (candidate.sequenceNumber !== nextDLNumber(workspace) ||
      workspace.plans.some((plan) => plan.code === candidate.code))
  )
    throw new Error(
      "O número sugerido foi usado por outra DL. Reabra a criação para usar o próximo número.",
    );
  if (previous?.contract?.release) {
    const { schedule: oldSchedule, ...before } = previous;
    const { schedule: newSchedule, ...after } = candidate;
    void oldSchedule;
    void newSchedule;
    if (
      !options?.scheduleOnly ||
      JSON.stringify(before) !== JSON.stringify(after)
    )
      throw new Error(
        "A contratação concluída está protegida. Somente o cronograma pode ser atualizado, sem alterar a origem dos saldos.",
      );
  }
  if (
    candidate.contract?.release &&
    !previous?.contract?.release &&
    !options?.release
  )
    throw new Error(
      "Use a confirmação de conclusão para disponibilizar a DL no Controle.",
    );
  const otherOrigins = new Set(
    workspace.plans
      .filter((plan) => plan.id !== candidate.id)
      .flatMap((plan) => plan.contract?.awards.map((award) => award.id) ?? []),
  );
  if (candidate.contract?.awards.some((award) => otherOrigins.has(award.id)))
    throw new Error("Identificador de contratação já utilizado por outra DL.");
  const now = new Date().toISOString();
  const saved = validateDLPlan({
    ...candidate,
    title:
      previous && !editableDLItems(previous)
        ? candidate.title
        : candidate.title.trim(),
    updatedAt: now,
    createdAt: previous?.createdAt ?? candidate.createdAt,
    revision: previous ? previous.revision + 1 : 1,
  });
  // The item composition stays frozen outside the drafting stages; reopening is explicit.
  if (
    previous &&
    !editableDLItems(previous) &&
    !editableDLItems(saved) &&
    JSON.stringify(previous.lines) !== JSON.stringify(saved.lines)
  )
    throw new Error(
      "Reabra o planejamento antes de alterar materiais ou orçamento.",
    );
  const event = {
    id: `dl-event-${crypto.randomUUID()}`,
    planId: saved.id,
    timestamp: now,
    action,
    details,
    actor: "Sessão local · sem autenticação",
  };
  const next: DLWorkspace = {
    ...workspace,
    lastNumber: Math.max(workspace.lastNumber, saved.sequenceNumber),
    plans: previous
      ? workspace.plans.map((plan) => (plan.id === saved.id ? saved : plan))
      : [...workspace.plans, saved],
    events: [event, ...workspace.events],
  };
  return { workspace: next, plan: saved };
}
