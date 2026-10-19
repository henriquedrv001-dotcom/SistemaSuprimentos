import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Undo2,
  Link2,
  Paperclip,
  Truck,
  ClipboardList,
  Send,
  ListChecks,
  CalendarDays,
  FileText,
  CirclePause,
  Pencil,
  ChevronDown,
  Filter,
} from "lucide-react";
import type { DLPlanEvent } from "../../types/dl";
import {
  dlActivityLabels,
  dlActivityType,
  dlActivitySummary,
  dlActivityDetails,
  dlActivityDate,
} from "../../services/dlActivity";
import type { DLActivityType } from "../../services/dlActivity";
const icons = {
  approval: BadgeCheck,
  return: Undo2,
  order: Link2,
  attachment: Paperclip,
  supplier: Truck,
  request: ClipboardList,
  submission: Send,
  planning: ListChecks,
  schedule: CalendarDays,
  justification: FileText,
  status: CirclePause,
  other: Pencil,
};
export default function DLHistory({
  planId,
  events,
}: {
  planId: string;
  events: DLPlanEvent[];
}) {
  const [type, setType] = useState<DLActivityType | "">("");
  useEffect(() => setType(""), [planId]);
  const entries = events.filter((event) => event.planId === planId);
  const types = (Object.keys(dlActivityLabels) as DLActivityType[]).filter(
    (key) => entries.some((event) => dlActivityType(event.action) === key),
  );
  const matched = entries.filter(
    (event) => !type || dlActivityType(event.action) === type,
  );
  return (
    <div className="dl-history">
      <div className="dl-history-toolbar">
        <label>
          <Filter size={15} aria-hidden="true" />
          <span>Atividade</span>
          <select
            aria-label="Filtrar histórico por atividade"
            value={type}
            onChange={(event) =>
              setType(event.target.value as DLActivityType | "")
            }
          >
            <option value="">Todas as atividades</option>
            {types.map((key) => (
              <option key={key} value={key}>
                {dlActivityLabels[key]} (
                {
                  entries.filter(
                    (event) => dlActivityType(event.action) === key,
                  ).length
                }
                )
              </option>
            ))}
          </select>
        </label>
        <span role="status">
          {matched.length} de {entries.length} registros
        </span>
      </div>
      {matched.length ? (
        <div className="dl-history-list">
          {matched.map((event) => {
            const category = dlActivityType(event.action),
              Icon = icons[category];
            return (
              <article className="dl-event" key={event.id}>
                <details>
                  <summary className="dl-history-row">
                    <Icon
                      size={16}
                      className="dl-history-icon"
                      aria-hidden="true"
                    />
                    <span className="dl-history-type">
                      {dlActivityLabels[category]}
                    </span>
                    <span
                      className="dl-history-description"
                      title={dlActivitySummary(event)}
                    >
                      {dlActivitySummary(event)}
                    </span>
                    <span
                      className="dl-history-actor"
                      title={event.actor || "Responsável não informado"}
                    >
                      {event.actor || "Responsável não informado"}
                    </span>
                    <time dateTime={event.timestamp}>
                      {dlActivityDate(event.timestamp)}
                    </time>
                    <ChevronDown
                      size={14}
                      className="dl-history-chevron"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="dl-history-detail">
                    <strong>{event.action}</strong>
                    <ul>
                      {dlActivityDetails(event.details).map((detail, index) => (
                        <li key={index}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="muted">
          {entries.length
            ? "Nenhum registro para esta atividade."
            : "Nenhuma alteração registrada para esta DL."}
        </p>
      )}
    </div>
  );
}
