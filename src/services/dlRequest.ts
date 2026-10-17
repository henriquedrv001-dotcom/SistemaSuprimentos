import { validDateOnly } from "./dlDates.ts";
import type { DLPlan } from "../types/dl";
import type { Item } from "../types";
export function dlObservation(plan: Pick<DLPlan, "justification" | "notes">) {
  const text = plan.justification;
  const legacy = plan.notes;
  return !legacy.trim() || legacy.trim() === text.trim()
    ? text
    : text.trim()
      ? `${text}\n\n${legacy}`
      : legacy;
}
export function resolveDLRequestStage(plan: DLPlan, previous?: DLPlan): DLPlan {
  if (plan.contract?.release) return plan;
  const workflow =
    previous?.requestWorkflow ||
    plan.requestWorkflow ||
    (["Gerar requisição", "Analisar requisição gerada", "Em processo"].includes(
      plan.stage,
    )
      ? plan.stage === "Gerar requisição"
        ? "mxm-review-v2"
        : "mxm-review-v1"
      : undefined);
  return { ...plan, ...(workflow ? { requestWorkflow: workflow } : {}) };
}
export function submitDLRequest(plan: DLPlan, confirmed: boolean): DLPlan {
  if (plan.stage !== "Gerar requisição")
    throw new Error(
      "A geração da requisição está bloqueada. O responsável precisa devolvê-la para correção.",
    );
  if (!confirmed)
    throw new Error("Confirme o envio da requisição para análise.");
  if (
    !plan.request.mxmNumber.trim() ||
    !validDateOnly(plan.request.date) ||
    !validDateOnly(plan.deliveryDate ?? "")
  )
    throw new Error(
      "Preencha número e data da requisição MXM e a data de entrega antes de enviar para análise.",
    );
  const result: DLPlan = {
    ...plan,
    stage: "Analisar requisição gerada",
    requestWorkflow: "mxm-review-v2",
    request: { ...plan.request, mxmNumber: plan.request.mxmNumber.trim() },
    requestSubmission: {
      timestamp: new Date().toISOString(),
      actor: "Sessão local · sem autenticação",
      mxmNumber: plan.request.mxmNumber.trim(),
      requestDate: plan.request.date,
    },
  };
  delete result.requestReview;
  return result;
}
export function returnDLRequest(plan: DLPlan, reason: string): DLPlan {
  if (plan.stage !== "Analisar requisição gerada")
    throw new Error(
      "Somente requisições aguardando análise podem ser devolvidas.",
    );
  if (!reason.trim())
    throw new Error("Informe uma observação explicando a correção necessária.");
  const result: DLPlan = {
    ...plan,
    stage: "Gerar requisição",
    requestWorkflow: "mxm-review-v2",
    requestReturn: {
      timestamp: new Date().toISOString(),
      actor: "Sessão local · sem autenticação",
      reason: reason.trim(),
      mxmNumber: plan.request.mxmNumber,
      requestDate: plan.request.date,
    },
  };
  delete result.requestReview;
  return result;
}
export function reopenDLPlanning(plan: DLPlan, confirmed: boolean): DLPlan {
  if (plan.contract?.release)
    throw new Error(
      "A contratação concluída está protegida; não pode ser reaberta por este fluxo.",
    );
  if (!confirmed) throw new Error("Confirme a reabertura do planejamento.");
  const result: DLPlan = { ...plan, stage: "Em planejamento" };
  delete result.requestReview;
  delete result.requestSubmission;
  if (result.processFlow) {
    result.processFlow = { ...result.processFlow };
    delete result.processFlow.suppliersSubmitted;
  }
  return result;
}
export function reviewDLRequest(plan: DLPlan, confirmed: boolean): DLPlan {
  if (plan.stage !== "Analisar requisição gerada")
    throw new Error(
      "A requisição precisa estar aguardando análise para seguir em processo.",
    );
  if (!confirmed)
    throw new Error("Confirme a análise da requisição no MXM antes de seguir.");
  if (
    !plan.request.mxmNumber.trim() ||
    !plan.request.date ||
    !plan.deliveryDate
  )
    throw new Error(
      "Preencha número/data da requisição e data de entrega antes de confirmar a análise.",
    );
  return {
    ...plan,
    stage: "Em processo",
    requestWorkflow: plan.requestWorkflow ?? "mxm-review-v1",
    requestReview: {
      timestamp: new Date().toISOString(),
      actor: "Sessão local · sem autenticação",
      mxmNumber: plan.request.mxmNumber.trim(),
      requestDate: plan.request.date,
    },
  };
}
export function dlRequestBrief(plan: DLPlan, items: Item[]) {
  return {
    planId: plan.id,
    code: plan.code,
    title: plan.title,
    observation: dlObservation(plan),
    deliveryDate: plan.deliveryDate ?? "",
    responsible: plan.responsible,
    items: plan.lines.map((line) => {
      const item = items.find((item) => item.id === line.itemId);
      return {
        itemId: line.itemId,
        code: item?.code ?? "Cadastro indisponível",
        description: item?.description ?? line.itemId,
        unit: line.unit,
        quantityMilli: line.quantityMilli,
        technicalSpecification: item?.technicalSpecification ?? "",
      };
    }),
  };
}
