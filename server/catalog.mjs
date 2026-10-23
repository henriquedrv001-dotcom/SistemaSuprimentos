import { randomUUID } from "node:crypto";
import { normalizeCatalogUnit } from "../src/services/catalogUnits.ts";
const text = (value, label, max, required = true) => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new Error(`Confira ${label}.`);
  return value.trim();
};
export function normalizeItem(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Material inválido.");
  const criterion = value.criterion;
  if (!["Mensal", "Entrada e saída", "Sob solicitação"].includes(criterion))
    throw new Error("Critério inválido.");
  if (typeof value.active !== "boolean" || typeof value.visible !== "boolean")
    throw new Error("Situação do material inválida.");
  return {
    id: text(value.id, "identificador", 128),
    code: text(value.code, "código", 256).toUpperCase(),
    description: text(value.description, "descrição", 5000).toUpperCase(),
    unit: normalizeCatalogUnit(text(value.unit, "unidade", 50)),
    type: text(value.type, "tipo", 250).toUpperCase(),
    group: text(value.group, "grupo", 500).toUpperCase(),
    criterion,
    active: value.active,
    visible: value.visible,
    ...(value.technicalSpecification !== undefined
      ? {
          technicalSpecification: text(
            value.technicalSpecification,
            "especificação",
            15000,
            false,
          ),
        }
      : {}),
  };
}
export function applyCatalogCommand(state, command, user) {
  let items = [...state.items];
  const events = [];
  const seen = new Set();
  const event = (item, action, details) =>
    events.push({
      id: randomUUID(),
      itemId: item.id,
      code: item.code,
      action,
      details,
      actor: user.name,
      actorId: user.id,
      timestamp: new Date().toISOString(),
    });
  if (command.kind === "delete") {
    if (
      !Array.isArray(command.ids) ||
      !command.ids.length ||
      command.ids.length > 10000 ||
      command.ids.some((id) => typeof id !== "string")
    )
      throw new Error("Selecione materiais para excluir.");
    for (const id of command.ids) {
      const item = items.find((row) => row.id === id);
      if (!item)
        throw new Error("O Cadastro mudou. Recarregue antes de excluir.");
      if (state.expiry.lots.some((lot) => lot.itemId === id))
        throw new Error(
          "Material com lotes vinculados: use Inativo para preservar o histórico.",
        );
      event(
        item,
        "Exclusão do catálogo",
        "Material removido mediante confirmação.",
      );
    }
    items = items.filter((item) => !command.ids.includes(item.id));
  } else {
    if (
      !["create", "update", "import-create", "import-update"].includes(
        command.kind,
      ) ||
      !Array.isArray(command.items) ||
      !command.items.length ||
      command.items.length > 10000
    )
      throw new Error("Operação de Cadastro inválida.");
    if (
      ["create", "update"].includes(command.kind) &&
      command.items.length !== 1
    )
      throw new Error("Envie somente um material.");
    for (const candidate of command.items) {
      const item = normalizeItem(candidate);
      if (seen.has(item.id)) throw new Error("Material repetido na operação.");
      seen.add(item.id);
      const index = items.findIndex((row) => row.id === item.id);
      const creating = ["create", "import-create"].includes(command.kind);
      if (creating && index >= 0)
        throw new Error("Este material já foi cadastrado.");
      if (!creating && index < 0)
        throw new Error("O material não existe mais no Cadastro.");
      if (
        items.some(
          (row) => row.id !== item.id && row.code.toUpperCase() === item.code,
        )
      )
        throw new Error(`Código já cadastrado: ${item.code}.`);
      if (
        !creating &&
        state.expiry.lots.some(
          (lot) => lot.itemId === item.id && lot.unit !== item.unit,
        )
      )
        throw new Error(
          "A unidade não pode ser alterada em material com lotes vinculados.",
        );
      const before = items[index];
      if (creating) items.push(item);
      else items[index] = item;
      const changes = before
        ? Object.keys(item)
            .filter((key) => key !== "id" && item[key] !== before[key])
            .map((key) => `${key}: ${before[key] ?? ""} → ${item[key]}`)
        : [];
      if (creating || changes.length)
        event(
          item,
          creating ? "Cadastro de item" : "Atualização de item",
          creating ? "Material incluído no Cadastro." : changes.join("\n"),
        );
    }
  }
  return { ...state, items, history: [...events, ...state.history] };
}
