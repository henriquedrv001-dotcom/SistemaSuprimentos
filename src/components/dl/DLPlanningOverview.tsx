import type { DLPlan } from "../../types/dl";
import { dlObservation } from "../../services/dlRequest";

export default function DLPlanningOverview({ plan }: { plan: DLPlan }) {
  const date = (value?: string) =>
    value ? value.split("-").reverse().join("/") : "A definir";
  return (
    <section
      className="dl-planning-overview"
      aria-label="Dados do planejamento concluído"
    >
      <dl className="dl-planning-facts">
        <div>
          <dt>Categoria</dt>
          <dd>{plan.category || "Não informada"}</dd>
        </div>
        <div>
          <dt>Abertura</dt>
          <dd>{date(plan.openedOn)}</dd>
        </div>
        <div>
          <dt>Entrega prevista</dt>
          <dd>{date(plan.deliveryDate)}</dd>
        </div>
        <div>
          <dt>Vigência prevista</dt>
          <dd>
            {plan.plannedValidityMonths
              ? `${plan.plannedValidityMonths} meses`
              : "A definir"}
          </dd>
        </div>
        <div>
          <dt>Solicitante</dt>
          <dd>{plan.responsible || "Não informado"}</dd>
        </div>
      </dl>
      <details className="dl-planning-context">
        <summary>Observação / Justificativa</summary>
        <p>{dlObservation(plan) || "Não informada"}</p>
      </details>
    </section>
  );
}
