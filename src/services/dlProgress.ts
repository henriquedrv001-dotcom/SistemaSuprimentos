import { needsDLContractRegistration } from "./dlProcess.ts";
import type { DLPlan } from "../types/dl";
import { dlOrderDocuments } from "./dlOrderDocuments.ts";
export function dlProcessProgress(plan: DLPlan) {
  const released = !!plan.contract?.release;
  const generating = plan.stage === "Gerar requisição";
  const available = [
    "Em processo",
    "Pedido gerado",
    "Aguardando dados finais",
    "Requisição registrada",
    "Em tramitação",
  ].includes(plan.stage);
  const registered = dlOrderDocuments(plan).length > 0;
  const registrationReady = !needsDLContractRegistration(plan);
  const submitted = !!plan.processFlow?.suppliersSubmitted;
  const current = released
    ? -1
    : ["Cancelado", "Suspenso", "Não contratado"].includes(plan.stage)
      ? -1
      : plan.stage === "Analisar requisição gerada"
        ? 2
        : generating || plan.stage === "Planejamento concluído"
          ? 1
          : available
            ? submitted
              ? 5
              : registered &&
                  registrationReady &&
                  (plan.stage === "Pedido gerado" ||
                    !plan.processFlow?.purchaseOrders)
                ? 4
                : 3
            : 0;
  const completed = [
    !!plan.processFlow?.justification?.completedAt,
    !generating && !!(plan.requestSubmission || plan.requestReview || released),
    !!plan.requestReview,
    registered && registrationReady,
    submitted || released,
    released,
  ];
  const labels = [
    "Justificativa",
    "Requisição",
    "Análise",
    "Pedido",
    "Fornecedores",
    "Aprovação",
  ];
  return {
    current,
    label: released
      ? "DL concluída"
      : current >= 0
        ? `Etapa atual: ${labels[current]}`
        : plan.stage,
    steps: labels.map((title, index) => ({
      title,
      optional: index === 0,
      state: completed[index]
        ? ("completed" as const)
        : current === index
          ? ("current" as const)
          : ("pending" as const),
    })),
  };
}
