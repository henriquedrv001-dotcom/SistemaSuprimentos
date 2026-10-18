import { Check, Clock3 } from "lucide-react";
import type { DLPlan } from "../../types/dl";
import { dlProcessProgress } from "../../services/dlProgress";
export default function DLProcessProgress({ plan }: { plan: DLPlan }) {
  const progress = dlProcessProgress(plan);
  return (
    <section className="dl-process-progress" aria-label="Andamento das etapas">
      <div>
        <strong>Andamento do processo</strong>
        <span>{progress.label}</span>
      </div>
      <ol>
        {progress.steps.map((step, index) => (
          <li
            key={step.title}
            className={`is-${step.state}`}
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <span className="dl-progress-point" aria-hidden="true">
              {step.state === "completed" ? (
                <Check size={14} />
              ) : step.state === "current" ? (
                index + 1
              ) : (
                <Clock3 size={13} />
              )}
            </span>
            <span>
              {step.title}
              <small>
                {step.state === "completed"
                  ? "Concluída"
                  : step.state === "current"
                    ? "Em andamento"
                    : step.optional
                      ? "Opcional"
                      : "Aguardando"}
              </small>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
