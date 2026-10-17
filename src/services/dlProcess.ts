import { dlOrderDocuments } from "./dlOrderDocuments.ts";
import type {
  DLPlan,
  DLProcessFlow,
  DLSaveOptions,
  DLOrderDocument,
} from "../types/dl";
import { validateDLContract } from "./dlContract.ts";
const actor = "Sessão local · sem autenticação";
const stamp = () => ({ timestamp: new Date().toISOString(), actor });
const json = (value: unknown) => JSON.stringify(value);
export function canRegisterDLOrder(plan: DLPlan) {
  return (
    !plan.contract?.release &&
    [
      "Em processo",
      "Pedido gerado",
      "Aguardando dados finais",
      "Requisição registrada",
      "Em tramitação",
    ].includes(plan.stage)
  );
}
export function processFlow(plan: DLPlan): DLProcessFlow {
  return plan.processFlow ?? { version: 1 };
}
export function registerDLOrder(
  plan: DLPlan,
  documents: DLOrderDocument[],
): DLPlan {
  if (!canRegisterDLOrder(plan) || plan.processFlow?.suppliersSubmitted)
    throw new Error(
      "O pedido só pode ser registrado após a análise e antes do envio dos fornecedores.",
    );
  if (!documents.length && !dlOrderDocuments(plan).length)
    throw new Error("Anexe ao menos um documento para registrar o pedido.");
  const existing = dlOrderDocuments(plan);
  const additions = documents.filter((document) => {
    const old = existing.find((old) => old.id === document.id);
    if (old && json(old) !== json(document))
      throw new Error(
        "Preserve os dados do anexo original ao recuperar seu arquivo.",
      );
    return !old;
  });
  return {
    ...plan,
    stage: "Pedido gerado",
    processFlow: {
      ...processFlow(plan),
      purchaseOrders: [
        ...(plan.processFlow?.purchaseOrders ?? []),
        ...additions,
      ],
      orderRegistered:
        plan.stage === "Pedido gerado"
          ? (plan.processFlow?.orderRegistered ?? stamp())
          : stamp(),
    },
  };
}
export function submitDLSuppliers(plan: DLPlan): DLPlan {
  if (!canRegisterDLOrder(plan) || !dlOrderDocuments(plan).length)
    throw new Error(
      "Registre o pedido anexado antes de enviar os fornecedores para aprovação.",
    );
  if (plan.processFlow?.purchaseOrders && plan.stage !== "Pedido gerado")
    throw new Error(
      "Registre o pedido para fechar o processo antes de enviar os fornecedores.",
    );
  if (plan.processFlow?.suppliersSubmitted)
    throw new Error(
      "Os dados já foram enviados e estão bloqueados para aprovação.",
    );
  validateDLContract(plan, true);
  return {
    ...plan,
    processFlow: { ...processFlow(plan), suppliersSubmitted: stamp() },
  };
}
export function returnDLSuppliers(plan: DLPlan, reason: string): DLPlan {
  if (!plan.processFlow?.suppliersSubmitted || plan.contract?.release)
    throw new Error("Somente dados aguardando aprovação podem ser devolvidos.");
  if (!reason.trim())
    throw new Error("Informe a observação para correção dos fornecedores.");
  const next = {
    ...plan,
    processFlow: {
      ...processFlow(plan),
      suppliersReturn: { ...stamp(), reason: reason.trim() },
    },
  };
  delete next.processFlow.suppliersSubmitted;
  return next;
}
export function validateDLProcess(plan: DLPlan) {
  const flow = plan.processFlow;
  if (!flow) {
    if (plan.stage === "Pedido gerado")
      throw new Error("Registre o pedido para fechar o processo.");
    return;
  }
  if (flow.version !== 1) throw new Error("Fluxo de etapas da DL inválido.");
  if (
    flow.justification &&
    (typeof flow.justification.text !== "string" ||
      (flow.justification.completedAt &&
        !Number.isFinite(Date.parse(flow.justification.completedAt))))
  )
    throw new Error("Justificativa do processo inválida.");
  if (flow.purchaseOrders !== undefined && !Array.isArray(flow.purchaseOrders))
    throw new Error("Lista de anexos do pedido inválida.");
  const documents = dlOrderDocuments(plan);
  if (
    new Set(documents.map((document) => document.id)).size !== documents.length
  )
    throw new Error("Há anexos repetidos no pedido.");
  for (const document of documents) {
    if (
      !document.id ||
      !document.name?.trim() ||
      !["application/pdf", "image/png", "image/jpeg"].includes(document.type) ||
      !Number.isSafeInteger(document.size) ||
      document.size <= 0 ||
      document.size > 20 * 1024 * 1024
    )
      throw new Error(
        "Documento do pedido inválido. Use PDF, PNG ou JPG até 20 MB.",
      );
  }
  if (
    (plan.stage === "Pedido gerado" || flow.purchaseOrders !== undefined) &&
    (!documents.length || !flow.orderRegistered)
  )
    throw new Error(
      "Registre o pedido e o fechamento do processo antes de seguir.",
    );
  for (const record of [
    ...documents,
    flow.orderRegistered,
    flow.suppliersSubmitted,
    flow.suppliersReturn,
  ]) {
    if (
      record &&
      (!record.actor?.trim() || !Number.isFinite(Date.parse(record.timestamp)))
    )
      throw new Error("Registro de etapa do processo inválido.");
  }
  if (flow.suppliersReturn && !flow.suppliersReturn.reason?.trim())
    throw new Error("A devolução dos fornecedores exige observação.");
  if (flow.suppliersSubmitted && !documents.length)
    throw new Error("Pedido anexado obrigatório para aprovar fornecedores.");
  if (flow.suppliersSubmitted) validateDLContract(plan, true);
  if (plan.contract?.release && (!flow.suppliersSubmitted || !documents.length))
    throw new Error(
      "A conclusão exige pedido registrado e fornecedores enviados para aprovação.",
    );
}
export function guardDLProcess(
  previous: DLPlan,
  next: DLPlan,
  options?: DLSaveOptions,
) {
  const before = previous.processFlow;
  const after = next.processFlow;
  const changed = json(before) !== json(after);
  if (
    next.stage === "Pedido gerado" &&
    previous.stage !== "Pedido gerado" &&
    options?.processAction !== "registerOrder"
  )
    throw new Error(
      "Use Registrar pedido para fechar o processo com status Pedido gerado.",
    );
  if (changed && !options?.processAction && !options?.reopenPlanning)
    throw new Error("Use a ação da etapa para atualizar o fluxo do processo.");
  if (!options?.reopenPlanning && before && !after)
    throw new Error("Os registros das etapas não podem ser removidos.");
  if (options?.processAction) {
    if (previous.contract?.release)
      throw new Error("A DL concluída está bloqueada.");
    const { processFlow: oldFlow, ...oldData } = previous;
    const { processFlow: newFlow, ...newData } = next;
    void oldFlow;
    void newFlow;
    if (
      options.processAction === "registerOrder" &&
      next.stage === "Pedido gerado"
    )
      oldData.stage = "Pedido gerado";
    if (json(oldData) !== json(newData))
      throw new Error(
        "A ação da etapa não permite alterar os demais dados da DL.",
      );
    const expected = structuredClone(processFlow(previous));
    switch (options.processAction) {
      case "justification":
        if (
          ![
            "Rascunho",
            "Em planejamento",
            "Planejamento concluído",
            "Gerar requisição",
          ].includes(previous.stage)
        )
          throw new Error(
            "A justificativa está bloqueada após o envio da requisição.",
          );
        expected.justification = after?.justification;
        break;
      case "registerOrder": {
        if (!canRegisterDLOrder(previous) || before?.suppliersSubmitted)
          throw new Error(
            "O pedido só pode ser registrado após a análise e antes do envio dos fornecedores.",
          );
        if (
          next.stage !== "Pedido gerado" ||
          !after?.orderRegistered ||
          !dlOrderDocuments(next).length
        )
          throw new Error(
            "Registrar o pedido deve fechar o processo com status Pedido gerado.",
          );
        const existing = dlOrderDocuments(previous);
        const nextDocuments = dlOrderDocuments(next);
        if (
          existing.some(
            (document) =>
              !nextDocuments.some(
                (nextDocument) => json(document) === json(nextDocument),
              ),
          )
        )
          throw new Error(
            "Preserve os anexos já registrados ao adicionar novos documentos.",
          );
        expected.purchaseOrders = after.purchaseOrders;
        expected.orderRegistered =
          previous.stage === "Pedido gerado"
            ? (before?.orderRegistered ?? after.orderRegistered)
            : after.orderRegistered;
        break;
      }
      case "submitSuppliers":
        submitDLSuppliers(previous);
        if (!after?.suppliersSubmitted)
          throw new Error("Confirme o envio dos fornecedores para aprovação.");
        expected.suppliersSubmitted = after.suppliersSubmitted;
        break;
      case "returnSuppliers":
        returnDLSuppliers(previous, after?.suppliersReturn?.reason ?? "");
        delete expected.suppliersSubmitted;
        expected.suppliersReturn = after?.suppliersReturn;
        break;
    }
    if (json(expected) !== json(after))
      throw new Error("A ação não permite alterar outras etapas do processo.");
    if (json(previous.contract) !== json(next.contract))
      throw new Error(
        "Salve os fornecedores antes de executar a ação da etapa.",
      );
  }
  if (
    before &&
    !previous.contract?.release &&
    json(previous.contract) !== json(next.contract) &&
    !options?.release &&
    (!canRegisterDLOrder(previous) ||
      !dlOrderDocuments(previous).length ||
      (before.purchaseOrders && previous.stage !== "Pedido gerado"))
  )
    throw new Error(
      "Registre o pedido após a análise antes de preencher a contratação.",
    );
  if (
    options?.release &&
    before?.suppliersSubmitted &&
    json({ ...previous.contract, release: undefined }) !==
      json({ ...next.contract, release: undefined })
  )
    throw new Error(
      "A aprovação deve preservar os fornecedores e valores enviados.",
    );
  if (
    before?.suppliersSubmitted &&
    !options?.reopenPlanning &&
    json(previous.contract) !== json(next.contract) &&
    !options?.release
  )
    throw new Error(
      "Fornecedores enviados para aprovação estão bloqueados; devolva para correção.",
    );
  if (
    !previous.contract?.release &&
    next.contract?.release &&
    after &&
    (!dlOrderDocuments(next).length || !after.suppliersSubmitted)
  )
    throw new Error(
      "Registre o pedido e envie os fornecedores para aprovação antes de concluir.",
    );
  if (options?.reopenPlanning && before) {
    const expected = structuredClone(before);
    delete expected.suppliersSubmitted;
    if (json(expected) !== json(after))
      throw new Error(
        "Reabrir invalida a aprovação, sem apagar o pedido ou a justificativa.",
      );
  }
}
