import { useEffect, useState } from "react";
import { Check, ChevronDown, Clock3 } from "lucide-react";
import type { ReactNode } from "react";
export default function DLWorkflowStep({
  id,
  number,
  title,
  status,
  completed = false,
  active = false,
  description,
  context,
  revealKey,
  children,
}: {
  id: string;
  number: number;
  title: string;
  status: string;
  completed?: boolean;
  active?: boolean;
  description: string;
  context?: string;
  revealKey?: number;
  children: ReactNode;
}) {
  const roles: Record<number, [string, string]> = {
    1: ["Estoque", "Responsável pelo estoque"],
    2: ["Aprendiz", "Jovem aprendiz"],
    3: ["Estoque", "Responsável pelo estoque"],
    4: ["Compradora", "Compradora"],
    5: ["Aprendiz", "Jovem aprendiz"],
    6: ["Estoque", "Responsável pelo estoque"],
  };
  const [open, setOpen] = useState(active && !completed);
  useEffect(() => setOpen(active && !completed), [active, completed]);
  useEffect(() => {
    if (!revealKey) return;
    setOpen(true);
    const frame = requestAnimationFrame(() => {
      const summary = document.getElementById(id)?.closest("summary");
      summary?.scrollIntoView({ block: "start" });
      summary?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [revealKey, id]);
  return (
    <section
      className={`dl-request-step dl-workflow-step${completed ? " is-complete" : active ? " is-active" : ""}`}
      aria-labelledby={id}
    >
      <details
        className="dl-stage-disclosure"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary className="dl-step-heading">
          <h3 id={id}>
            <span className="dl-step-number">{number}</span>{" "}
            <span>{title}</span>
          </h3>
          <span className="dl-step-context">
            {context ||
              (completed
                ? "Etapa concluída."
                : active
                  ? "Etapa disponível para execução."
                  : "Aguardando etapa anterior.")}
          </span>
          {roles[number] && (
            <span
              className="dl-step-role"
              title={`Perfil previsto: ${roles[number][1]}`}
            >
              {roles[number][0]}
            </span>
          )}
          <span
            className={`dl-step-pill ${completed ? "is-complete" : active ? "is-current" : "is-pending"}`}
          >
            {completed ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              <Clock3 size={13} aria-hidden="true" />
            )}
            {status}
          </span>
          <ChevronDown
            className="dl-step-chevron"
            size={15}
            aria-hidden="true"
          />
        </summary>
        <div className="dl-workflow-body">
          <p className="dl-step-description muted">{description}</p>
          {children}
        </div>
      </details>
    </section>
  );
}
