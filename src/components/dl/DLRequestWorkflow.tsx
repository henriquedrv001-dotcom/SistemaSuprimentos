import DLWorkflowStep from "./DLWorkflowStep";
import type { ReactNode } from "react";
import type { DLPlan } from "../../types/dl";
import type { Item } from "../../types";
import DLRequestBrief from "./DLRequestBrief";
export type RequestAction =
  | "start"
  | "saveDraft"
  | "submit"
  | "approve"
  | "return"
  | "saveBuyer"
  | "suspend"
  | "cancel"
  | "notContracted";
export default function DLRequestWorkflow({
  plan,
  items,
  request,
  onChange,
  onAction,
  otherChanges,
  prelude,
  finalSteps,
}: {
  plan: DLPlan;
  items: Item[];
  request: DLPlan["request"];
  onChange: (request: DLPlan["request"]) => void;
  onAction: (action: RequestAction, reason?: string) => void;
  otherChanges: boolean;
  prelude?: ReactNode;
  finalSteps?: ReactNode;
}) {
  const generating =
    plan.stage === "Gerar requisição" && !plan.contract?.release;
  const analyzing =
    plan.stage === "Analisar requisição gerada" && !plan.contract?.release;
  const canEditBuyer =
    analyzing ||
    ([
      "Em processo",
      "Aguardando dados finais",
      "Requisição registrada",
      "Em tramitação",
    ].includes(plan.stage) &&
      !plan.contract?.release);
  return (
    <div className="dl-request-steps">
      {prelude}
      <DLWorkflowStep
        id="dl-generation-title"
        number={2}
        title="Gerar requisição"
        status={
          generating
            ? plan.requestReturn
              ? "Correção solicitada"
              : "Em preenchimento"
            : plan.requestSubmission ||
                plan.requestReview ||
                plan.contract?.release
              ? "Enviada"
              : plan.stage === "Planejamento concluído"
                ? "Pronta para iniciar"
                : "Aguardando planejamento"
        }
        completed={
          !generating &&
          !!(
            plan.requestSubmission ||
            plan.requestReview ||
            plan.contract?.release
          )
        }
        active={generating || plan.stage === "Planejamento concluído"}
        description="Registre os materiais no MXM e informe o número e a data da requisição."
      >
        {generating && plan.requestReturn && (
          <div className="dl-return-note" role="note">
            <strong>Devolvida para correção</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {plan.requestReturn.reason}
            </p>
          </div>
        )}
        <DLRequestBrief plan={plan} items={items} />
        <div className="form-grid">
          <label>
            Data da requisição
            <input
              type="date"
              disabled={!generating || otherChanges}
              value={request.date}
              onChange={(e) => onChange({ ...request, date: e.target.value })}
            />
          </label>
          <label>
            Número da requisição MXM
            <input
              disabled={!generating || otherChanges}
              value={request.mxmNumber}
              onChange={(e) =>
                onChange({ ...request, mxmNumber: e.target.value })
              }
            />
          </label>
        </div>
        {plan.stage === "Planejamento concluído" && (
          <button
            className="secondary-button"
            disabled={otherChanges}
            onClick={() => onAction("start")}
          >
            Iniciar geração da requisição
          </button>
        )}
        {generating && (
          <div className="dl-actions">
            <button
              className="secondary-button"
              disabled={otherChanges}
              onClick={() => onAction("saveDraft")}
            >
              Salvar rascunho da requisição
            </button>
            <button
              className="primary-button"
              disabled={otherChanges}
              onClick={() => {
                if (
                  window.confirm(
                    "Enviar a requisição para análise? O número e a data ficarão bloqueados até uma devolução para correção.",
                  )
                )
                  onAction("submit");
              }}
            >
              Enviar para análise
            </button>
          </div>
        )}
        {!generating && plan.requestSubmission && (
          <p className="muted">
            Enviada para análise em{" "}
            {new Date(plan.requestSubmission.timestamp).toLocaleString("pt-BR")}
            . Para corrigir, aguarde a devolução com observação.
          </p>
        )}
      </DLWorkflowStep>
      <DLWorkflowStep
        id="dl-analysis-title"
        number={3}
        title="Analisar requisição"
        status={
          analyzing
            ? "Aguardando análise"
            : plan.requestReview
              ? "Aprovada"
              : "Aguardando envio"
        }
        completed={!!plan.requestReview}
        active={analyzing}
        description="Confira no MXM. Aprove para seguir em processo ou devolva com uma observação."
      >
        <p>
          <strong>Requisição:</strong>{" "}
          {plan.request.mxmNumber || "Não informada"} ·{" "}
          {plan.request.date
            ? plan.request.date.split("-").reverse().join("/")
            : "Data a definir"}
        </p>
        <div className="form-grid">
          <label>
            Responsável pelo estoque
            <input
              disabled={!canEditBuyer || otherChanges}
              value={request.responsible}
              onChange={(e) =>
                onChange({ ...request, responsible: e.target.value })
              }
            />
          </label>
          <label>
            Situação
            <input readOnly value={plan.stage} />
          </label>
        </div>
        {analyzing && (
          <div className="dl-actions">
            <button
              className="secondary-button"
              disabled={otherChanges}
              onClick={() => {
                const reason = window.prompt(
                  "Qual correção precisa ser feita? A observação é obrigatória para devolver ao responsável pela geração.",
                );
                if (reason !== null) onAction("return", reason);
              }}
            >
              Devolver para correção
            </button>
            <button
              className="primary-button"
              disabled={otherChanges}
              onClick={() => {
                if (
                  window.confirm(
                    `Você conferiu a requisição MXM ${plan.request.mxmNumber} e confirma a aprovação para seguir Em processo?`,
                  )
                )
                  onAction("approve");
              }}
            >
              Aprovar e enviar para processo
            </button>
          </div>
        )}
        {canEditBuyer && !analyzing && (
          <button
            className="secondary-button"
            disabled={otherChanges}
            onClick={() => onAction("saveBuyer")}
          >
            Salvar responsável pelo estoque
          </button>
        )}
        {[
          "Em processo",
          "Aguardando dados finais",
          "Requisição registrada",
          "Em tramitação",
        ].includes(plan.stage) &&
          !plan.contract?.release && (
            <details className="dl-request-outcomes">
              <summary>Outras situações do processo</summary>
              <div className="dl-actions">
                {(
                  [
                    ["suspend", "Suspender processo"],
                    ["cancel", "Cancelar processo"],
                    ["notContracted", "Registrar não contratado"],
                  ] as const
                ).map(([action, label]) => (
                  <button
                    className="secondary-button"
                    key={action}
                    disabled={otherChanges}
                    onClick={() => {
                      const note = window.prompt(
                        `${label}: informe o motivo. A observação ficará no histórico.`,
                      );
                      if (note !== null) onAction(action, note);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </details>
          )}
        {plan.requestReview && (
          <p className="muted">
            Análise aprovada em{" "}
            {new Date(plan.requestReview.timestamp).toLocaleString("pt-BR")}. O
            número e a data permanecem bloqueados.
          </p>
        )}
      </DLWorkflowStep>
      {finalSteps}
      {otherChanges && (
        <p className="catalog-feedback">
          Salve as alterações pendentes na etapa em edição antes de continuar.
        </p>
      )}
    </div>
  );
}
