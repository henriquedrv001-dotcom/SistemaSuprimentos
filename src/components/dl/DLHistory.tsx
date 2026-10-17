import type { DLPlanEvent } from "../../types/dl";
export default function DLHistory({
  planId,
  events,
}: {
  planId: string;
  events: DLPlanEvent[];
}) {
  const entries = events.filter((event) => event.planId === planId);
  return (
    <>
      {entries.length ? (
        entries.map((event) => (
          <article className="dl-event" key={event.id}>
            <strong>{event.action}</strong>
            <p style={{ whiteSpace: "pre-wrap" }}>{event.details}</p>
            <small>
              {new Date(event.timestamp).toLocaleString("pt-BR")} ·{" "}
              {event.actor}
            </small>
          </article>
        ))
      ) : (
        <p className="muted">Nenhuma alteração registrada para esta DL.</p>
      )}
    </>
  );
}
