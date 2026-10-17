import type { DLPlan, DLPlanEvent } from "../../types/dl";
import type { Item } from "../../types";
import DLRequestBrief from "./DLRequestBrief";
import DLHistory from "./DLHistory";
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
  events,
}: {
  plan: DLPlan;
  items: Item[];
  request: DLPlan["request"];
  onChange: (request: DLPlan["request"]) => void;
  onAction: (action: RequestAction, reason?: string) => void;
  otherChanges: boolean;
  events: DLPlanEvent[];
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
      <section
        className="dl-request-step"
        aria-labelledby="dl-generation-title"
      >
        <div className="panel-heading">
          <h3 id="dl-generation-title">1. Gerar requisição</h3>
          <span className={`tag ${generating ? "tag-green" : "tag-neutral"}`}>
            {generating ? "Preenchimento liberado" : "Somente consulta"}
          </span>
        </div>
        <p className="muted">
          Abra as informações, registre os materiais no MXM e preencha abaixo o
          número e a data da requisição gerada.
        </p>
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
              disabled={!generating}
              value={request.date}
              onChange={(e) => onChange({ ...request, date: e.target.value })}
            />
          </label>
          <label>
            Número da requisição MXM
            <input
              disabled={!generating}
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
      </section>
      <section className="dl-request-step" aria-labelledby="dl-analysis-title">
        <div className="panel-heading">
          <h3 id="dl-analysis-title">2. Analisar requisição</h3>
          <span className={`tag ${analyzing ? "tag-amber" : "tag-neutral"}`}>
            {analyzing
              ? "Aguardando análise"
              : plan.requestReview
                ? "Análise aprovada"
                : "Aguardando envio"}
          </span>
        </div>
        <p className="muted">
          Confira a requisição no MXM. Aprove para seguir em processo ou devolva
          com uma observação para correção.
        </p>
        <p>
          <strong>Requisição:</strong>{" "}
          {plan.request.mxmNumber || "Não informada"} ·{" "}
          {plan.request.date
            ? plan.request.date.split("-").reverse().join("/")
            : "Data a definir"}
        </p>
        <div className="form-grid">
          <label>
            Responsável pela compra
            <input
              disabled={!canEditBuyer}
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
            Salvar responsável pela compra
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
      </section>
      {otherChanges && (
        <p className="catalog-feedback">
          Salve as alterações nas outras abas antes de executar as ações da
          requisição.
        </p>
      )}
      <details className="dl-request-history">
        <summary>Histórico da DL</summary>
        <DLHistory planId={plan.id} events={events} />
      </details>
    </div>
  );
}
