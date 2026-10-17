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
  const number = plan.request.mxmNumber.trim();
  const requestChanged =
    !!previous?.requestReview &&
    (previous.requestReview.mxmNumber !== number ||
      previous.requestReview.requestDate !== plan.request.date);
  const workflow =
    previous?.requestWorkflow ||
    plan.requestWorkflow ||
    (["Gerar requisição", "Analisar requisição gerada", "Em processo"].includes(
      plan.stage,
    )
      ? ("mxm-review-v1" as const)
      : undefined);
  const result: DLPlan = {
    ...plan,
    ...(workflow ? { requestWorkflow: workflow } : {}),
  };
  if (requestChanged) delete result.requestReview;
  if (result.stage === "Gerar requisição" && number)
    return { ...result, stage: "Analisar requisição gerada" };
  if (
    ["Em processo", "Aguardando dados finais"].includes(result.stage) &&
    requestChanged
  )
    return {
      ...result,
      stage: number ? "Analisar requisição gerada" : "Gerar requisição",
    };
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
    requestWorkflow: "mxm-review-v1",
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
