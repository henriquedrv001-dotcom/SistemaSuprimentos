import { Plus, X, Eye } from "lucide-react";
import FilterSelect from "../../components/ui/FilterSelect";
import FilterSearch from "../../components/ui/FilterSearch";
import SegmentedControl from "../../components/ui/SegmentedControl";
import { contractTotal } from "../../services/dlContract";
import DLControl from "../../components/dl/DLControl";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Item } from "../../types";
import { dlStages } from "../../types/dl";
import type { DLPlan, DLWorkspace, DLSaveOptions } from "../../types/dl";
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
import "../../components/dl/Acquisitions.css";

export type DLPlanningProps = {
  tab: "planning" | "control";
  onChange: (tab: "planning" | "control") => void;
  items: Item[];
  workspace: DLWorkspace;
  error: string;
  onSave: (plan: DLPlan, action: string, options?: DLSaveOptions) => DLPlan;
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
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState("recent");
  const categories = [
    ...new Set(
      props.workspace.plans
        .map((plan) => plan.category.toLocaleUpperCase("pt-BR"))
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
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
      if (props.tab !== "planning") props.onChange("planning");
      setCreating(false);
      setTitle("");
      props.onPendingClose();
      setError("");
    } catch (cause) {
      setError(String(cause instanceof Error ? cause.message : cause));
    }
  }
  const disabled = !!props.error;
  const filteredPlans = props.workspace.plans.filter(
    (plan) =>
      `${plan.code} ${plan.title} ${plan.category}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")) &&
      (!stageFilter || plan.stage === stageFilter) &&
      (!categoryFilter ||
        plan.category.toLocaleUpperCase("pt-BR") === categoryFilter),
  );
  filteredPlans.sort((a, b) =>
    sort === "code"
      ? a.code.localeCompare(b.code, "pt-BR", { numeric: true })
      : sort === "oldest"
        ? a.openedOn.localeCompare(b.openedOn) ||
          a.sequenceNumber - b.sequenceNumber
        : b.openedOn.localeCompare(a.openedOn) ||
          b.sequenceNumber - a.sequenceNumber,
  );
  const hasFilters = !!query || !!stageFilter || !!categoryFilter;
  return (
    <div
      className="acquisitions-page"
      data-area={props.tab}
      data-detail={!!plan && props.tab === "planning"}
    >
      {(!plan || props.tab === "control") && (
        <div className="page-heading dl-overview-heading">
          <div>
            <p className="eyebrow">SUPRIMENTOS</p>
            <h1>PROCESSOS DE COMPRA</h1>
          </div>
          <div className="dl-overview-actions">
            <SegmentedControl
              label="Visualização dos processos de compra"
              value={props.tab}
              onChange={(value) =>
                props.onChange(value as "planning" | "control")
              }
              options={[
                {
                  value: "planning",
                  label: "Planejamento",
                  ariaLabel: "Planejamento de DLs",
                },
                {
                  value: "control",
                  label: "Controle",
                  ariaLabel: "Controle de DLs",
                },
              ]}
            />
            <button
              className="primary-button"
              disabled={disabled}
              onClick={() => {
                setCreating(true);
                setError("");
              }}
            >
              <Plus size={16} aria-hidden="true" />
              Nova DL
            </button>
          </div>
        </div>
      )}
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
        <section
          className="panel dl-acquisition-list"
          aria-labelledby="dl-overview-title"
        >
          <div className="dl-list-results">
            <h2 id="dl-overview-title">Planejamento de DLs</h2>
            <span role="status">
              {filteredPlans.length} de {props.workspace.plans.length}{" "}
              aquisições
            </span>
          </div>
          <div className="ui-filterbar dl-planning-filterbar">
            <FilterSearch
              label="Buscar DL"
              placeholder="Número, objeto ou categoria"
              value={query}
              onChange={setQuery}
            />
            <FilterSelect
              label="Situação"
              value={stageFilter}
              onChange={setStageFilter}
              options={[
                { value: "", label: "Todas as situações" },
                ...dlStages.map((stage) => ({ value: stage, label: stage })),
              ]}
            />
            <FilterSelect
              label="Categoria"
              aria-label="Categoria da aquisição"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "", label: "Todas as categorias" },
                ...categories.map((category) => ({
                  value: category,
                  label: category,
                })),
              ]}
            />
            <FilterSelect
              label="Ordenar"
              aria-label="Ordenar aquisições"
              value={sort}
              onChange={setSort}
              options={[
                { value: "recent", label: "Mais recentes" },
                { value: "oldest", label: "Mais antigas" },
                { value: "code", label: "Número da DL" },
              ]}
            />
            {hasFilters && (
              <button
                className="text-button dl-clear-filters ui-filter-actions"
                onClick={() => {
                  setQuery("");
                  setStageFilter("");
                  setCategoryFilter("");
                }}
              >
                <X size={14} aria-hidden="true" />
                Limpar filtros
              </button>
            )}
          </div>
          <div
            className="table-wrap"
            role="region"
            aria-label="Processos de aquisição"
            tabIndex={0}
          >
            <table className="dl-overview-table">
              <colgroup>
                <col className="dl-col-code" />
                <col className="dl-col-title" />
                <col className="dl-col-category" />
                <col className="dl-col-date" />
                <col className="dl-col-money" />
                <col className="dl-col-stage" />
                <col className="dl-col-open" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">DL</th>
                  <th scope="col">Objeto</th>
                  <th scope="col">Categoria</th>
                  <th scope="col">Abertura</th>
                  <th scope="col">Orçamento</th>
                  <th scope="col">Etapa</th>
                  <th scope="col">Abrir</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((plan) => {
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
                      <td>
                        <strong>{plan.title}</strong>
                        <small>{plan.lines.length} materiais</small>
                      </td>
                      <td>
                        {plan.category?.toLocaleUpperCase("pt-BR") || "—"}
                      </td>
                      <td>{plan.openedOn.split("-").reverse().join("/")}</td>
                      <td>
                        {formatMoney(budget.totalCents)}
                        {budget.incomplete > 0 && (
                          <small className="muted">Parcial</small>
                        )}
                        <small>
                          Contratação final:{" "}
                          {plan.contract?.awards.length
                            ? formatMoney(
                                contractTotal(plan.contract).totalCents,
                              )
                            : "A definir"}
                          {plan.contract?.awards.length &&
                          !plan.contract.release
                            ? " · Em conferência"
                            : ""}
                        </small>
                      </td>
                      <td>
                        <span
                          className="dl-overview-stage"
                          data-tone={
                            plan.stage === "Concluído"
                              ? "complete"
                              : plan.stage === "Suspenso"
                                ? "warning"
                                : plan.stage === "Cancelado" ||
                                    plan.stage === "Não contratado"
                                  ? "inactive"
                                  : plan.stage === "Rascunho"
                                    ? "draft"
                                    : "active"
                          }
                        >
                          {plan.stage}
                        </span>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Consultar ${plan.code}`}
                          onClick={() => setActive(plan.id)}
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!filteredPlans.length && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      {props.workspace.plans.length
                        ? "Nenhuma DL encontrada. Revise a busca ou a situação selecionada."
                        : "Crie sua primeira DL para começar o planejamento."}
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
                  if (props.tab !== "planning") props.onChange("planning");
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
    </div>
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
      className="item-edit-dialog dl-create dl-overview-create"
      aria-label="Criar ou escolher DL"
      onClose={onClose}
    >
      {children}
    </dialog>
  );
}
