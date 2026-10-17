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
  children,
}: {
  id: string;
  number: number;
  title: string;
  status: string;
  completed?: boolean;
  active?: boolean;
  description: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(active && !completed);
  useEffect(() => setOpen(active && !completed), [active, completed]);
  return (
    <section
      className={`dl-request-step dl-workflow-step${active && !completed ? " is-active" : ""}`}
      aria-labelledby={id}
    >
      <details
        className="dl-stage-disclosure"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary className="dl-step-heading">
          <h3 id={id}>
            <span className="dl-step-number">{number}.</span>{" "}
            <span>{title}</span>
          </h3>
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
