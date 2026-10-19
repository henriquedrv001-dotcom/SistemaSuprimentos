import { Tag, CalendarDays, Clock3, UserRound } from "lucide-react";
import type { DLPlan } from "../../types/dl";
import { dlObservation } from "../../services/dlRequest";

export default function DLPlanningOverview({
  plan,
  showObservation = true,
}: {
  plan: DLPlan;
  showObservation?: boolean;
}) {
  const date = (value?: string) =>
    value ? value.split("-").reverse().join("/") : "A definir";
  return (
    <section
      className="dl-planning-overview"
      aria-label="Dados do planejamento concluído"
    >
      <dl className="dl-planning-facts">
        <div>
          <dt>
            <Tag size={14} aria-hidden="true" />
            Categoria
          </dt>
          <dd>{plan.category || "Não informada"}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays size={14} aria-hidden="true" />
            Abertura
          </dt>
          <dd>{date(plan.openedOn)}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays size={14} aria-hidden="true" />
            Entrega prevista
          </dt>
          <dd>{date(plan.deliveryDate)}</dd>
        </div>
        <div>
          <dt>
            <Clock3 size={14} aria-hidden="true" />
            Vigência prevista
          </dt>
          <dd>
            {plan.plannedValidityMonths
              ? `${plan.plannedValidityMonths} meses`
              : "A definir"}
          </dd>
        </div>
        <div>
          <dt>
            <UserRound size={14} aria-hidden="true" />
            Solicitante
          </dt>
          <dd>{plan.responsible || "Não informado"}</dd>
        </div>
      </dl>
      {showObservation && (
        <section
          className="dl-planning-context"
          aria-labelledby="dl-observation-heading"
        >
          <h3 id="dl-observation-heading">Observação / Justificativa</h3>
          <p>{dlObservation(plan) || "Não informada"}</p>
        </section>
      )}
    </section>
  );
}
