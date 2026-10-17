import type {
  CyclePlanningLine,
  CycleWorkspace,
  Item,
  SupplyCycle,
} from "../types";
export const cycleWorkspaceKey = "suprimentos:cycle-planning:v1";
export const emptyCycleWorkspace = (): CycleWorkspace => ({
  version: 1,
  lines: [],
  groups: [],
  templates: [],
});
export const normalizeName = (name: string) =>
  name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

export function readCycleWorkspace(raw: string | null): CycleWorkspace {
  if (raw === null) return emptyCycleWorkspace();
  const value = JSON.parse(raw) as CycleWorkspace;
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.lines) ||
    !Array.isArray(value.groups) ||
    !Array.isArray(value.templates)
  )
    throw new Error(
      "O planejamento salvo não pôde ser lido. Os dados originais foram preservados; recupere um backup antes de continuar.",
    );
  if (
    value.lines.some(
      (line) =>
        !line ||
        typeof line.id !== "string" ||
        typeof line.cycleId !== "string" ||
        typeof line.itemId !== "string" ||
        (line.requestGroupId !== null &&
          typeof line.requestGroupId !== "string") ||
        (line.plannedQuantity !== null &&
          (!Number.isFinite(line.plannedQuantity) ||
            line.plannedQuantity < 0)) ||
        typeof line.notes !== "string" ||
        !["", "Estimativa", "Consumo anterior", "Demanda do setor"].includes(
          line.forecastBasis,
        ),
    )
  )
    throw new Error(
      "Há linhas inválidas no planejamento salvo. A cópia original não foi alterada.",
    );
  const identities = value.lines.map(
    (line) => `${line.cycleId}\u0000${line.itemId}`,
  );
  if (new Set(identities).size !== identities.length)
    throw new Error(
      "Há materiais duplicados no mesmo ciclo. Revise os dados salvos antes de continuar.",
    );
  if (
    value.groups.some(
      (group) =>
        !group ||
        typeof group.id !== "string" ||
        typeof group.cycleId !== "string" ||
        typeof group.name !== "string",
    ) ||
    value.templates.some(
      (model) =>
        !model ||
        typeof model.id !== "string" ||
        typeof model.name !== "string" ||
        !Array.isArray(model.itemIds) ||
        model.itemIds.some((id) => typeof id !== "string"),
    )
  )
    throw new Error(
      "Os grupos salvos não puderam ser lidos. Os dados originais foram preservados.",
    );
  return value;
}

export function validateCycle(
  draft: Omit<SupplyCycle, "id">,
  cycles: SupplyCycle[],
  id?: string,
) {
  if (!draft.name.trim()) throw new Error("Informe o nome do ciclo.");
  if (
    cycles.some(
      (cycle) =>
        cycle.id !== id &&
        normalizeName(cycle.name) === normalizeName(draft.name),
    )
  )
    throw new Error("Já existe um ciclo com esse nome.");
  const dates = [
    draft.solicitationStart,
    draft.firstDelivery,
    draft.lastDelivery,
    draft.closingDate,
  ];
  if (
    dates.some(
      (date) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
        new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date,
    )
  )
    throw new Error("Preencha todas as datas com valores válidos.");
  if (dates.some((date, index) => index > 0 && date < dates[index - 1]))
    throw new Error(
      "Confira a ordem das datas: solicitações, primeira entrega, última entrega e fechamento.",
    );
  if (!["Planejamento", "Em execução", "Encerrado"].includes(draft.status))
    throw new Error("Escolha uma situação válida para o ciclo.");
  return { ...draft, name: draft.name.trim() };
}
export function requireOpenCycle(cycles: SupplyCycle[], cycleId: string) {
  const cycle = cycles.find((cycle) => cycle.id === cycleId);
  if (!cycle) throw new Error("O ciclo não foi encontrado.");
  if (cycle.status === "Encerrado")
    throw new Error(
      "Reabra o ciclo em Editar ciclo para alterar seus materiais e grupos.",
    );
  return cycle;
}
function validGroup(
  workspace: CycleWorkspace,
  cycleId: string,
  groupId: string | null,
) {
  if (
    groupId &&
    !workspace.groups.some(
      (group) => group.id === groupId && group.cycleId === cycleId,
    )
  )
    throw new Error("O grupo não pertence a este ciclo.");
}
export function addPlanningItems(
  workspace: CycleWorkspace,
  cycles: SupplyCycle[],
  items: Item[],
  cycleId: string,
  itemIds: string[],
  groupId: string | null,
) {
  requireOpenCycle(cycles, cycleId);
  validGroup(workspace, cycleId, groupId);
  const existing = new Set(
    workspace.lines
      .filter((line) => line.cycleId === cycleId)
      .map((line) => line.itemId),
  );
  const byId = new Map(items.map((item) => [item.id, item]));
  const added: Item[] = [];
  let duplicateCount = 0;
  let unavailableCount = 0;
  for (const id of new Set(itemIds)) {
    if (existing.has(id)) {
      duplicateCount++;
      continue;
    }
    const item = byId.get(id);
    if (!item || item.active === false) {
      unavailableCount++;
      continue;
    }
    added.push(item);
    existing.add(id);
  }
  const lines: CyclePlanningLine[] = added.map((item) => ({
    id: `cycle-line-${crypto.randomUUID()}`,
    cycleId,
    itemId: item.id,
    requestGroupId: groupId,
    plannedQuantity: null,
    forecastBasis: "",
    notes: "",
  }));
  return {
    workspace: { ...workspace, lines: [...workspace.lines, ...lines] },
    added,
    duplicateCount,
    unavailableCount,
  };
}
export function editPlanningLine(
  workspace: CycleWorkspace,
  cycles: SupplyCycle[],
  next: CyclePlanningLine,
) {
  requireOpenCycle(cycles, next.cycleId);
  validGroup(workspace, next.cycleId, next.requestGroupId);
  const old = workspace.lines.find((line) => line.id === next.id);
  if (!old || old.cycleId !== next.cycleId || old.itemId !== next.itemId)
    throw new Error("A linha do ciclo não foi encontrada.");
  if (
    next.plannedQuantity !== null &&
    (!Number.isFinite(next.plannedQuantity) || next.plannedQuantity < 0)
  )
    throw new Error(
      "Informe uma quantidade maior ou igual a zero, ou deixe em branco para definir depois.",
    );
  if (
    !["", "Estimativa", "Consumo anterior", "Demanda do setor"].includes(
      next.forecastBasis,
    )
  )
    throw new Error("Escolha uma base válida para a previsão.");
  if (
    old.orderReferences?.length &&
    next.plannedQuantity !== old.plannedQuantity
  )
    throw new Error(
      "Este material possui pedidos vinculados. A necessidade deverá ser ajustada pelo fluxo de pedidos para preservar o histórico.",
    );
  const updated = {
    ...old,
    plannedQuantity: next.plannedQuantity,
    requestGroupId: next.requestGroupId,
    forecastBasis: next.forecastBasis,
    notes: next.notes.trim(),
  };
  return {
    ...workspace,
    lines: workspace.lines.map((line) => (line.id === old.id ? updated : line)),
  };
}
export function removePlanningItems(
  workspace: CycleWorkspace,
  cycles: SupplyCycle[],
  cycleId: string,
  lineIds: string[],
) {
  requireOpenCycle(cycles, cycleId);
  const selected = workspace.lines.filter(
    (line) => line.cycleId === cycleId && lineIds.includes(line.id),
  );
  if (selected.some((line) => line.orderReferences?.length))
    throw new Error(
      "Há pedidos associados à seleção. Ajuste ou cancele a necessidade pelo fluxo de pedidos; o vínculo não pode ser apagado.",
    );
  const ids = new Set(selected.map((line) => line.id));
  return {
    workspace: {
      ...workspace,
      lines: workspace.lines.filter((line) => !ids.has(line.id)),
    },
    removed: selected,
  };
}
export function saveRequestGroup(
  workspace: CycleWorkspace,
  cycles: SupplyCycle[],
  cycleId: string,
  name: string,
  id?: string,
) {
  requireOpenCycle(cycles, cycleId);
  if (!name.trim()) throw new Error("Informe o nome do grupo de solicitação.");
  if (
    workspace.groups.some(
      (group) =>
        group.cycleId === cycleId &&
        group.id !== id &&
        normalizeName(group.name) === normalizeName(name),
    )
  )
    throw new Error("Já existe um grupo com esse nome neste ciclo.");
  if (
    id &&
    !workspace.groups.some(
      (group) => group.id === id && group.cycleId === cycleId,
    )
  )
    throw new Error("O grupo não foi encontrado.");
  const group = {
    id: id ?? `request-group-${crypto.randomUUID()}`,
    cycleId,
    name: name.trim(),
  };
  return {
    workspace: {
      ...workspace,
      groups: id
        ? workspace.groups.map((old) => (old.id === id ? group : old))
        : [...workspace.groups, group],
    },
    group,
  };
}
export function removeRequestGroup(
  workspace: CycleWorkspace,
  cycles: SupplyCycle[],
  cycleId: string,
  groupId: string,
) {
  requireOpenCycle(cycles, cycleId);
  validGroup(workspace, cycleId, groupId);
  return {
    ...workspace,
    groups: workspace.groups.filter((group) => group.id !== groupId),
    lines: workspace.lines.map((line) =>
      line.cycleId === cycleId && line.requestGroupId === groupId
        ? { ...line, requestGroupId: null }
        : line,
    ),
  };
}
export function saveGroupTemplate(
  workspace: CycleWorkspace,
  name: string,
  itemIds: string[],
  replace = false,
) {
  if (!name.trim() || !itemIds.length)
    throw new Error(
      "Informe um nome e inclua ao menos um material para salvar o modelo.",
    );
  const old = workspace.templates.find(
    (model) => normalizeName(model.name) === normalizeName(name),
  );
  if (old && !replace)
    throw new Error(
      "Já existe um modelo com esse nome. Confirme a substituição ou escolha outro nome.",
    );
  const model = {
    id: old?.id ?? `group-model-${crypto.randomUUID()}`,
    name: name.trim(),
    itemIds: [...new Set(itemIds)],
  };
  return {
    ...workspace,
    templates: old
      ? workspace.templates.map((entry) =>
          entry.id === old.id ? model : entry,
        )
      : [...workspace.templates, model],
  };
}
export function applyGroupTemplate(
  workspace: CycleWorkspace,
  cycles: SupplyCycle[],
  items: Item[],
  cycleId: string,
  modelId: string,
) {
  const model = workspace.templates.find((model) => model.id === modelId);
  if (!model) throw new Error("O modelo não foi encontrado.");
  const existingGroup = workspace.groups.find(
    (group) =>
      group.cycleId === cycleId &&
      normalizeName(group.name) === normalizeName(model.name),
  );
  const result = existingGroup
    ? { workspace, group: existingGroup }
    : saveRequestGroup(workspace, cycles, cycleId, model.name);
  return {
    ...addPlanningItems(
      result.workspace,
      cycles,
      items,
      cycleId,
      model.itemIds,
      result.group.id,
    ),
    group: result.group,
  };
}

export function writeLocalTransaction(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  entries: [string, string][],
) {
  const previous = entries.map(([key]) => [key, storage.getItem(key)] as const);
  try {
    for (const [key, value] of entries) storage.setItem(key, value);
  } catch {
    let rollbackFailed = false;
    for (const [key, value] of previous) {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        rollbackFailed = true;
      }
    }
    throw new Error(
      rollbackFailed
        ? "Falha ao salvar e recuperar o estado anterior. Não continue editando; recarregue e confira seu backup."
        : "Não foi possível salvar no navegador. As alterações foram desfeitas; verifique o espaço disponível.",
    );
  }
}
