import { contractTotal } from "../../services/dlContract";
import DLControl from "../../components/dl/DLControl";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Item } from "../../types";
import { dlStages } from "../../types/dl";
import type { DLPlan, DLWorkspace } from "../../types/dl";
import {
  addDLItems,
  editableDLItems,
  formatDLCode,
  formatMoney,
  newDLPlan,
  nextDLNumber,
  planBudget,
  todayInBrazil,
} from "../../services/dlPlanning";
import DLPlanningEditor from "../../components/dl/DLPlanningEditor";

export type DLPlanningProps = {
  tab: "planning" | "control";
  onChange: (tab: "planning" | "control") => void;
  items: Item[];
  workspace: DLWorkspace;
  error: string;
  onSave: (
    plan: DLPlan,
    action: string,
    options?: { release?: boolean; reviewRequest?: boolean },
  ) => DLPlan;
  pendingItems: Item[] | null;
  onPendingClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
};
export default function PlanejamentoControleDLs(props: DLPlanningProps) {
  const [active, setActive] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const plan = props.workspace.plans.find((plan) => plan.id === active);
  function create() {
    try {
      let candidate = newDLPlan(props.workspace, {
        title,
        openedOn: todayInBrazil(),
        category: "",
        responsible: "",
        justification: "",
        notes: "",
      });
      if (props.pendingItems)
        candidate = addDLItems(
          candidate,
          props.items,
          props.pendingItems.map((item) => item.id),
        ).plan;
      const saved = props.onSave(candidate, "Planejamento criado");
      setActive(saved.id);
      setCreating(false);
      setTitle("");
      props.onPendingClose();
      setError("");
    } catch (cause) {
      setError(String(cause instanceof Error ? cause.message : cause));
    }
  }
  const disabled = !!props.error;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ESTOQUE · AQUISIÇÕES</p>
          <h1>Planejamento e Controle DLs</h1>
          <p className="muted">
            Da necessidade de aquisição ao acompanhamento do processo.
          </p>
        </div>
      </div>
      <div className="tabs">
        <button
          className={`tab ${props.tab === "planning" ? "active" : ""}`}
          onClick={() => props.onChange("planning")}
        >
          Planejamento
        </button>
        <button
          className={`tab ${props.tab === "control" ? "active" : ""}`}
          onClick={() => props.onChange("control")}
        >
          Controle
        </button>
      </div>
      {props.error && (
        <p className="catalog-error" role="alert">
          {props.error} Nenhum dado salvo será substituído.
        </p>
      )}
      {props.tab === "control" ? (
        <DLControl
          workspace={props.workspace}
          items={props.items}
          onOpenPlanning={(id) => {
            setActive(id);
            props.onChange("planning");
          }}
        />
      ) : plan ? (
        <DLPlanningEditor
          key={plan.id}
          {...props}
          plan={plan}
          onBack={() => setActive(null)}
        />
      ) : (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Processos de aquisição</h2>
              <p className="muted">
                {props.workspace.plans.length} DL(s) cadastrada(s)
              </p>
            </div>
            <button
              className="primary-button"
              disabled={disabled}
              onClick={() => {
                setCreating(true);
                setError("");
              }}
            >
              Nova DL
            </button>
          </div>
          <label className="catalog-search">
            <input
              aria-label="Buscar DL"
              placeholder="Buscar número, objeto ou categoria"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="dl-stage-filter">
            Situação
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="">Todas</option>
              {dlStages.map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </select>
          </label>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DL</th>
                  <th>Objeto</th>
                  <th>Categoria</th>
                  <th>Abertura</th>
                  <th>Materiais</th>
                  <th>Orçamento previsto</th>
                  <th>Contratação final</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {props.workspace.plans
                  .filter(
                    (plan) =>
                      `${plan.code} ${plan.title} ${plan.category}`
                        .toLocaleLowerCase()
                        .includes(query.toLocaleLowerCase()) &&
                      (!stageFilter || plan.stage === stageFilter),
                  )
                  .map((plan) => {
                    const budget = planBudget(plan.lines);
                    return (
                      <tr key={plan.id}>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => setActive(plan.id)}
                          >
                            {plan.code}
                          </button>
                        </td>
                        <td>{plan.title}</td>
                        <td>{plan.category?.toLocaleUpperCase("pt-BR") || "—"}</td>
                        <td>{plan.openedOn.split("-").reverse().join("/")}</td>
                        <td>{plan.lines.length}</td>
                        <td>
                          {formatMoney(budget.totalCents)}
                          {budget.incomplete > 0 && (
                            <small className="muted"> · parcial</small>
                          )}
                        </td>
                        <td>
                          {plan.contract?.awards.length ? (
                            <>
                              {formatMoney(
                                contractTotal(plan.contract).totalCents,
                              )}
                              {!plan.contract.release && (
                                <small className="muted">
                                  {" "}
                                  · em conferência
                                </small>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{plan.stage}</td>
                      </tr>
                    );
                  })}
                {!props.workspace.plans.length && (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      Crie sua primeira DL para começar o planejamento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {(creating || props.pendingItems) && (
        <DLCreateDialog
          onClose={() => {
            setCreating(false);
            props.onPendingClose();
            setError("");
            setDestination("");
          }}
        >
          <h2>
            {props.pendingItems
              ? `Adicionar ${props.pendingItems.length} materiais ao planejamento`
              : `Nova ${formatDLCode(nextDLNumber(props.workspace))}`}
          </h2>
          <p className="muted">
            O número interno é reservado somente ao salvar. Não é o número
            oficial do processo MXM.
          </p>
          {props.pendingItems && (
            <label>
              Destino
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="">Criar nova DL</option>
                {props.workspace.plans.filter(editableDLItems).map((plan) => (
                  <option value={plan.id} key={plan.id}>
                    {plan.code} · {plan.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!destination && (
            <label>
              Objeto / título
              <input
                aria-label="Objeto da nova DL"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Materiais de informática"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="catalog-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setCreating(false);
                props.onPendingClose();
                setError("");
                setDestination("");
              }}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={disabled}
              onClick={() => {
                if (!destination) {
                  create();
                  return;
                }
                try {
                  const target = props.workspace.plans.find(
                    (plan) => plan.id === destination,
                  );
                  if (!target) throw new Error("Escolha uma DL válida.");
                  const result = addDLItems(
                    target,
                    props.items,
                    props.pendingItems?.map((item) => item.id) ?? [],
                  );
                  if (!result.added.length)
                    throw new Error(
                      "Nenhum novo material ativo. Os itens repetidos foram preservados.",
                    );
                  const saved = props.onSave(
                    result.plan,
                    "Materiais incluídos pelo cadastro",
                  );
                  setActive(saved.id);
                  props.onPendingClose();
                  setDestination("");
                  setError("");
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Falha ao adicionar.",
                  );
                }
              }}
            >
              {destination ? "Adicionar materiais" : "Criar rascunho"}
            </button>
          </div>
        </DLCreateDialog>
      )}
    </>
  );
}
function DLCreateDialog({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog dl-create"
      aria-label="Criar ou escolher DL"
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}
