import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock3,
  Columns3,
  List,
  RotateCcw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import {
  advancePreviewFlow,
  initialPreviewFlows,
  previewRoles,
  previewStates,
  previewSteps,
  returnPreviewFlow,
  startPreviewFlow,
} from "../../services/taskPreview";
import type {
  PreviewFlow,
  PreviewRole,
  PreviewTaskState,
} from "../../services/taskPreview";
import "./Tarefas.css";
const states = Object.keys(previewStates) as PreviewTaskState[];
export default function Tarefas() {
  const [flows, setFlows] = useState(initialPreviewFlows);
  const [profile, setProfile] = useState<PreviewRole | "">("");
  const [state, setState] = useState<PreviewTaskState | "">("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [active, setActive] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [nextRole, setNextRole] = useState<PreviewRole | null>(null);
  const shown = flows.filter(
    (flow) =>
      (!profile || previewSteps[flow.stage].role === profile) &&
      (!state || flow.state === state) &&
      `${flow.reference} ${flow.object} ${previewSteps[flow.stage].title}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  const selected = flows.find((flow) => flow.id === active);
  function apply(next: PreviewFlow) {
    setFlows((current) =>
      current.map((flow) => (flow.id === next.id ? next : flow)),
    );
    setActive(null);
    const role = previewSteps[next.stage].role;
    setNextRole(next.state === "done" ? null : role);
    setMessage(
      next.state === "done"
        ? `${next.reference}: fluxo de exemplo concluído.`
        : `${next.reference}: ${previewSteps[next.stage].title} · fila de ${previewRoles[role]}.`,
    );
  }
  return (
    <section className="tasks-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO · EXECUÇÃO</p>
          <h1>Tarefas</h1>
          <p className="muted">
            Etapas do processo organizadas por perfil funcional.
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => {
            setFlows(initialPreviewFlows());
            setProfile("");
            setState("");
            setQuery("");
            setActive(null);
            setMessage("Exemplos reiniciados.");
            setNextRole(null);
          }}
        >
          <RotateCcw size={15} />
          Reiniciar exemplos
        </button>
      </div>
      <p className="tasks-preview-note">
        <strong>ESBOÇO INTERATIVO</strong> Exemplos para testar as filas. As
        simulações não alteram DLs, pedidos ou saldos.
      </p>
      <div className="tasks-counts">
        {states.map((id) => (
          <div key={id}>
            <span>{previewStates[id]}</span>
            <strong>{shown.filter((flow) => flow.state === id).length}</strong>
          </div>
        ))}
      </div>
      <section
        className="panel tasks-workspace"
        aria-label="Fila de tarefas por perfil"
      >
        <div className="tasks-filters">
          <label>
            Visualizar como
            <select
              aria-label="Visualizar fila do perfil"
              value={profile}
              onChange={(e) => {
                setProfile(e.target.value as PreviewRole | "");
                setActive(null);
              }}
            >
              <option value="">Todos os perfis</option>
              {Object.entries(previewRoles).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="tasks-search">
            Buscar
            <span>
              <Search size={15} aria-hidden="true" />
              <input
                aria-label="Buscar tarefa"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Etapa ou aquisição"
              />
            </span>
          </label>
          <label>
            Situação
            <select
              aria-label="Situação da tarefa"
              value={state}
              onChange={(e) =>
                setState(e.target.value as PreviewTaskState | "")
              }
            >
              <option value="">Todas</option>
              {states.map((id) => (
                <option value={id} key={id}>
                  {previewStates[id]}
                </option>
              ))}
            </select>
          </label>
          <div
            className="tasks-view-switch"
            aria-label="Visualização das tarefas"
          >
            <button
              className={view === "list" ? "is-active" : ""}
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={15} />
              Lista
            </button>
            <button
              className={view === "kanban" ? "is-active" : ""}
              aria-pressed={view === "kanban"}
              onClick={() => setView("kanban")}
            >
              <Columns3 size={15} />
              Kanban
            </button>
          </div>
        </div>
        <div className="tasks-queue-heading">
          <h2>
            {profile
              ? `Fila de ${previewRoles[profile]}`
              : "Fila atribuída · todos os perfis"}
          </h2>
          <div className="list-result-actions">
            <span role="status">{shown.length} tarefa(s) de exemplo</span>
            {(query || profile || state) && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setProfile("");
                  setState("");
                }}
              >
                Limpar filtros de tarefas
              </button>
            )}
          </div>
        </div>
        {message && (
          <div className="tasks-feedback" role="status">
            <span>{message}</span>
            {nextRole && (
              <button
                className="text-button"
                onClick={() => {
                  setProfile(nextRole);
                  setState("");
                  setQuery("");
                }}
              >
                Ver fila de {previewRoles[nextRole]} <ArrowRight size={13} />
              </button>
            )}
          </div>
        )}
        {view === "list" ? (
          <div
            className="table-wrap tasks-table-wrap"
            role="region"
            aria-label="Tarefas atribuídas em lista"
            tabIndex={0}
          >
            <table className="tasks-table">
              <thead>
                <tr>
                  <th scope="col">Tarefa / aquisição</th>
                  <th scope="col">Perfil responsável</th>
                  <th scope="col">Prioridade</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Etapa</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((flow) => (
                  <tr key={flow.id}>
                    <td>
                      <button
                        className="tasks-open"
                        onClick={() => setActive(flow.id)}
                      >
                        {previewSteps[flow.stage].title}
                      </button>
                      <small>
                        {flow.reference} · {flow.object}
                      </small>
                    </td>
                    <td>{previewRoles[previewSteps[flow.stage].role]}</td>
                    <td>
                      <span
                        className={`tasks-priority ${flow.priority === "Alta" ? "is-high" : ""}`}
                      >
                        {flow.priority}
                      </span>
                    </td>
                    <td>
                      <span className={`tasks-state is-${flow.state}`}>
                        {previewStates[flow.state]}
                      </span>
                    </td>
                    <td>{flow.stage + 1} / 6</td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Nenhuma tarefa nesta seleção.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="tasks-board">
            {states.map((id) => (
              <section
                className="tasks-column"
                key={id}
                aria-label={previewStates[id]}
              >
                <header>
                  <h3>{previewStates[id]}</h3>
                  <span>
                    {shown.filter((flow) => flow.state === id).length}
                  </span>
                </header>
                {shown
                  .filter((flow) => flow.state === id)
                  .map((flow) => (
                    <button
                      className="tasks-card"
                      key={flow.id}
                      onClick={() => setActive(flow.id)}
                    >
                      <span className="tasks-card-ref">
                        {flow.reference} · {flow.stage + 1}/6
                      </span>
                      <strong>{previewSteps[flow.stage].title}</strong>
                      <span className="tasks-card-object">{flow.object}</span>
                      <span className="tasks-card-role">
                        <UserRound size={13} />
                        {previewRoles[previewSteps[flow.stage].role]}
                      </span>
                      <span
                        className={`tasks-priority ${flow.priority === "Alta" ? "is-high" : ""}`}
                      >
                        {flow.priority}
                      </span>
                    </button>
                  ))}
                {!shown.some((flow) => flow.state === id) && (
                  <p className="tasks-column-empty">Sem tarefas</p>
                )}
              </section>
            ))}
          </div>
        )}
      </section>
      {selected && (
        <TaskPreviewDialog
          key={`${selected.id}-${selected.stage}-${selected.state}`}
          flow={selected}
          onClose={() => setActive(null)}
          onApply={apply}
        />
      )}
    </section>
  );
}
function TaskPreviewDialog({
  flow,
  onClose,
  onApply,
}: {
  flow: PreviewFlow;
  onClose: () => void;
  onApply: (next: PreviewFlow) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const step = previewSteps[flow.stage];
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const review = flow.stage === 2 || flow.stage === 5;
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog tasks-dialog"
      aria-labelledby="tasks-dialog-title"
      onClose={onClose}
    >
      <header>
        <div>
          <p>{flow.reference} · SIMULAÇÃO</p>
          <h2 id="tasks-dialog-title">{step.title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Fechar tarefa"
          onClick={() => ref.current?.close()}
        >
          <X size={18} />
        </button>
      </header>
      <div className="tasks-dialog-body">
        <p className="tasks-dialog-object">{flow.object}</p>
        <dl>
          <div>
            <dt>Atribuída ao perfil</dt>
            <dd>{previewRoles[step.role]}</dd>
          </div>
          <div>
            <dt>Situação</dt>
            <dd>{previewStates[flow.state]}</dd>
          </div>
        </dl>
        <p>{step.instruction}</p>
        {flow.returnNote && (
          <p className="tasks-return-note">
            <strong>Correção solicitada:</strong> {flow.returnNote}
          </p>
        )}
        <h3>Fluxo de exemplo</h3>
        <ol className="tasks-flow">
          {previewSteps.map((entry, index) => (
            <li
              key={entry.title}
              className={
                index === flow.stage
                  ? "is-current"
                  : index < flow.stage || flow.state === "done"
                    ? "is-done"
                    : ""
              }
            >
              {index < flow.stage || flow.state === "done" ? (
                <CheckCircle2 size={15} />
              ) : index === flow.stage ? (
                <Clock3 size={15} />
              ) : (
                <Circle size={15} />
              )}
              <span>
                {entry.title}
                <small>{previewRoles[entry.role]}</small>
              </span>
            </li>
          ))}
        </ol>
        {flow.state !== "done" && flow.stage < 5 && (
          <p className="tasks-next-role">
            Próximo perfil:{" "}
            <strong>{previewRoles[previewSteps[flow.stage + 1].role]}</strong>
          </p>
        )}
        {returning && (
          <label className="tasks-reason">
            Observação para correção
            <textarea
              aria-label="Observação da devolução"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </label>
        )}
        {error && (
          <p className="catalog-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer>
        {flow.state === "done" ? (
          <button
            className="secondary-button"
            onClick={() => ref.current?.close()}
          >
            Fechar
          </button>
        ) : returning ? (
          <>
            <button
              className="secondary-button"
              onClick={() => setReturning(false)}
            >
              Cancelar devolução
            </button>
            <button
              className="primary-button"
              onClick={() => {
                try {
                  onApply(returnPreviewFlow(flow, reason));
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Revise a observação.",
                  );
                }
              }}
            >
              Simular devolução
            </button>
          </>
        ) : (
          <>
            {review && (
              <button
                className="secondary-button"
                onClick={() => setReturning(true)}
              >
                Devolver para correção
              </button>
            )}
            {flow.state === "todo" ? (
              <button
                className="primary-button"
                onClick={() => onApply(startPreviewFlow(flow))}
              >
                Simular início da tarefa
              </button>
            ) : (
              <button
                className="primary-button"
                onClick={() => onApply(advancePreviewFlow(flow))}
              >
                Simular: {step.action}
              </button>
            )}
          </>
        )}
      </footer>
    </dialog>
  );
}
