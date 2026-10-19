import { dlOrderDocuments } from "../../services/dlOrderDocuments";
import DLProcessStages, { DLJustificationStep } from "./DLProcessStages";
import DLContractSummary from "./DLContractSummary";
import DLPlanningOverview from "./DLPlanningOverview";
import DLPlanningMaterialDialog from "./DLPlanningMaterialDialog";
import { canRegisterDLOrder } from "../../services/dlProcess";
import {
  CalendarDays,
  CircleCheck,
  Clock3,
  Eye,
  ChevronDown,
} from "lucide-react";
import DLHistory from "./DLHistory";
import DLRequestWorkflow from "./DLRequestWorkflow";
import type { RequestAction } from "./DLRequestWorkflow";
import DLSchedulePanel from "./DLSchedulePanel";
import { emptyDLSchedule } from "../../services/dlSchedule";
import DLMoneyInput from "./DLMoneyInput";
import {
  dlObservation,
  resolveDLRequestStage,
  reviewDLRequest,
  submitDLRequest,
  returnDLRequest,
  reopenDLPlanning,
} from "../../services/dlRequest";
import { contractInput, materializeContract } from "./DLContractForm";
import DLReleaseDialog from "./DLReleaseDialog";
import { releaseDLPlan } from "../../services/dlContract";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_DL_REQUESTER } from "../../config/uiDefaults";
import type { DLPlan } from "../../types/dl";
import type { DLPlanningProps } from "../../pages/estoque/PlanejamentoControleDLs";
import {
  addDLItems,
  decimalInput,
  editableDLItems,
  formatMoney,
  lineSubtotal,
  parseScaledInput,
  planBudget,
  validateDLPlan,
} from "../../services/dlPlanning";
import CycleItemPicker from "../CycleItemPicker";
export default function DLPlanningEditor({
  plan,
  items,
  workspace,
  onSave,
  onBack,
  onDirtyChange,
}: DLPlanningProps & { plan: DLPlan; onBack: () => void }) {
  const [draft, setDraft] = useState<DLPlan>(() => {
    const initial = structuredClone(plan);
    if (editableDLItems(plan) && !initial.responsible.trim()) {
      initial.responsible = DEFAULT_DL_REQUESTER;
    }
    return initial;
  });
  const lastPlan = useRef(plan);
  const [values, setValues] = useState<
    Record<string, { quantity: string; price: string }>
  >(() =>
    Object.fromEntries(
      plan.lines.map((line) => [
        line.id,
        {
          quantity: decimalInput(line.quantityMilli, 3),
          price: decimalInput(line.estimatedPriceCents, 2),
        },
      ]),
    ),
  );
  const [tab, setTab] = useState("items");
  const [orderRevealKey, setOrderRevealKey] = useState(0);
  const [scheduleDraft, setScheduleDraft] = useState(
    () => plan.schedule ?? emptyDLSchedule(),
  );
  const scheduleDirty =
    JSON.stringify(scheduleDraft) !==
    JSON.stringify(plan.schedule ?? emptyDLSchedule());
  const [contractDraft, setContractDraft] = useState(() =>
    contractInput(plan.contract, plan.lines),
  );
  const [justificationText, setJustificationText] = useState(
    plan.processFlow?.justification?.text ?? "",
  );
  const justificationDirty =
    justificationText !== (plan.processFlow?.justification?.text ?? "");
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [openedMaterial, setOpenedMaterial] = useState<string | null>(null);
  useEffect(() => {
    // Initial state already includes the suggested requester. Later saves use
    // exactly the saved values, including an intentionally cleared field.
    if (lastPlan.current === plan) return;
    lastPlan.current = plan;
    setDraft(structuredClone(plan));
    setJustificationText(plan.processFlow?.justification?.text ?? "");
    setScheduleDraft(plan.schedule ?? emptyDLSchedule());
    setContractDraft(contractInput(plan.contract, plan.lines));
    setValues(
      Object.fromEntries(
        plan.lines.map((line) => [
          line.id,
          {
            quantity: decimalInput(line.quantityMilli, 3),
            price: decimalInput(line.estimatedPriceCents, 2),
          },
        ]),
      ),
    );
  }, [plan]);
  const released = !!plan.contract?.release;
  const contractDirty =
    JSON.stringify(contractDraft) !==
    JSON.stringify(contractInput(plan.contract, plan.lines));
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState("");
  const dirty =
    justificationDirty ||
    scheduleDirty ||
    contractDirty ||
    JSON.stringify(draft) !== JSON.stringify(plan) ||
    draft.lines.some(
      (line) =>
        values[line.id]?.quantity !== decimalInput(line.quantityMilli, 3) ||
        values[line.id]?.price !== decimalInput(line.estimatedPriceCents, 2),
    );
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function materialize(stage = draft.stage) {
    return {
      ...draft,
      stage,
      ...(plan.schedule || scheduleDirty ? { schedule: scheduleDraft } : {}),
      contract:
        plan.contract || contractDirty
          ? materializeContract(contractDraft)
          : undefined,
      lines: draft.lines.map((line) => ({
        ...line,
        quantityMilli: parseScaledInput(
          values[line.id]?.quantity ?? "",
          3,
          "Quantidade",
        ),
        estimatedPriceCents: parseScaledInput(
          values[line.id]?.price ?? "",
          2,
          "Preço previsto",
        ),
      })),
    };
  }
  let previewLines: DLPlan["lines"] = [];
  let budgetSummary: { amount: string; incomplete: number } | null = null;
  try {
    previewLines = materialize().lines;
    const budget = planBudget(previewLines);
    budgetSummary = {
      amount: formatMoney(budget.totalCents),
      incomplete: budget.incomplete,
    };
  } catch {
    /* Invalid inputs are shown explicitly in the summary below. */
  }
  const editable = editableDLItems(plan);
  const canEditContract =
    canRegisterDLOrder(plan) &&
    !!dlOrderDocuments(plan).length &&
    !plan.processFlow?.suppliersSubmitted;
  const planningDirty =
    JSON.stringify({ ...draft, request: plan.request }) !==
      JSON.stringify(plan) ||
    draft.lines.some(
      (line) =>
        values[line.id]?.quantity !== decimalInput(line.quantityMilli, 3) ||
        values[line.id]?.price !== decimalInput(line.estimatedPriceCents, 2),
    );
  const requestDirty =
    JSON.stringify(draft.request) !== JSON.stringify(plan.request);
  const processBlocked =
    planningDirty || scheduleDirty || requestDirty || justificationDirty;
  const otherRequestChanges =
    planningDirty || scheduleDirty || contractDirty || justificationDirty;
  function saveContract() {
    try {
      if (!canEditContract || processBlocked)
        throw new Error(
          "Salve as outras alterações e registre o pedido antes de preencher fornecedores.",
        );
      const candidate = {
        ...plan,
        contract: materializeContract(contractDraft),
      };
      validateDLPlan(candidate);
      onSave(candidate, "Fornecedores e valores salvos");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar os fornecedores.",
      );
    }
  }
  function requestAction(action: RequestAction, reason = "") {
    try {
      if (otherRequestChanges)
        throw new Error(
          "Salve as alterações nas outras abas antes de continuar.",
        );
      let candidate: DLPlan = { ...plan, request: { ...plan.request } };
      let options: Parameters<typeof onSave>[2];
      let label = "";
      if (action === "start") {
        candidate.stage = "Gerar requisição";
        candidate.requestWorkflow = "mxm-review-v2";
        delete candidate.requestSubmission;
        delete candidate.requestReview;
        options = { startRequest: true };
        label = "Geração da requisição iniciada";
      } else if (action === "saveDraft" || action === "submit") {
        if (plan.stage !== "Gerar requisição")
          throw new Error(
            "A geração está bloqueada. Aguarde a devolução para correção.",
          );
        candidate.request.mxmNumber = draft.request.mxmNumber;
        candidate.request.date = draft.request.date;
        if (action === "submit") {
          candidate = submitDLRequest(candidate, true);
          options = { submitRequest: true };
          label = "Requisição enviada para análise";
        } else label = "Rascunho da requisição salvo";
      } else {
        candidate.request.responsible = draft.request.responsible;
        if (action === "approve") {
          candidate = reviewDLRequest(candidate, true);
          options = { reviewRequest: true };
          label = "Requisição aprovada e enviada para processo";
        } else if (action === "return") {
          candidate = returnDLRequest(candidate, reason);
          options = { returnRequest: true };
          label = "Requisição devolvida para correção";
        } else if (["suspend", "cancel", "notContracted"].includes(action)) {
          if (!reason.trim())
            throw new Error("Informe o motivo da alteração de situação.");
          candidate.stage =
            action === "suspend"
              ? "Suspenso"
              : action === "cancel"
                ? "Cancelado"
                : "Não contratado";
          candidate.request.notes = reason.trim();
          label = `Processo ${candidate.stage.toLocaleLowerCase("pt-BR")}: ${reason.trim()}`;
        } else label = "Responsável pelo estoque atualizado";
      }
      validateDLPlan(candidate);
      onSave(candidate, label, options);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar a requisição.",
      );
    }
  }

  function save(stage = draft.stage, action = "Planejamento atualizado") {
    try {
      if (justificationDirty)
        throw new Error("Salve a justificativa na etapa 1 antes de continuar.");
      if (tab === "request") {
        requestAction(
          plan.stage === "Gerar requisição" ? "saveDraft" : "saveBuyer",
        );
        return;
      }
      const scheduleOnly = released && tab === "schedule";
      const candidate = scheduleOnly
        ? { ...plan, schedule: scheduleDraft }
        : resolveDLRequestStage(materialize(stage), plan);
      validateDLPlan(candidate);
      const saved = onSave(
        candidate,
        scheduleOnly ? "Cronograma atualizado" : action,
        scheduleOnly ? { scheduleOnly: true } : undefined,
      );
      setDraft(structuredClone(saved));
      setContractDraft(contractInput(saved.contract, saved.lines));
      setValues(
        Object.fromEntries(
          saved.lines.map((line) => [
            line.id,
            {
              quantity: decimalInput(line.quantityMilli, 3),
              price: decimalInput(line.estimatedPriceCents, 2),
            },
          ]),
        ),
      );
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    }
  }
  return (
    <section
      className={`panel dl-editor${tab === "request" ? "" : " dl-compact"}${tab === "items" && !editable ? " dl-planning-readonly" : ""}`}
      data-view={tab}
    >
      <div className="panel-heading">
        <div>
          <button
            className="text-button"
            onClick={() => {
              if (
                !dirty ||
                window.confirm(
                  "Descartar alterações ainda não salvas desta DL?",
                )
              )
                onBack();
            }}
          >
            ← Todas as DLs
          </button>
          <div className="dl-record-title">
            <h2>
              {plan.code} · {plan.title}
            </h2>
            <span className="dl-record-stage" data-released={released}>
              {plan.stage}
            </span>
          </div>
          <p className="muted">
            {dirty ? "Alterações não salvas" : "Salvo neste navegador"}
          </p>
        </div>
        <div className="dl-actions">
          <button
            className="secondary-button"
            onClick={() => setTab("schedule")}
            aria-label="Abrir cronograma"
            aria-pressed={tab === "schedule"}
          >
            <CalendarDays size={16} />
            Cronograma
          </button>
          <button
            className={`primary-button${!dirty ? " is-saved" : ""}`}
            disabled={
              !dirty ||
              justificationDirty ||
              (tab === "items"
                ? !editable
                : tab === "contract" || tab === "request"
                  ? true
                  : tab === "history" || (released && tab !== "schedule"))
            }
            onClick={() => save()}
          >
            Salvar alterações
          </button>
          {released ? null : editable ? (
            <button
              className="secondary-button"
              disabled={justificationDirty}
              onClick={() => {
                try {
                  validateDLPlan(materialize("Planejamento concluído"));
                  if (
                    window.confirm(
                      `Concluir o planejamento de ${plan.code}? O orçamento será bloqueado para edição até ser reaberto. Isso não gera saldo de DL.`,
                    )
                  )
                    save("Planejamento concluído", "Planejamento concluído");
                } catch (cause) {
                  setError(
                    cause instanceof Error ? cause.message : "Revise os dados.",
                  );
                }
              }}
            >
              Concluir planejamento
            </button>
          ) : (
            <details className="dl-record-more">
              <summary className="secondary-button">
                Mais ações <ChevronDown size={14} />
              </summary>
              <div>
                <button
                  className="text-button"
                  onClick={() => {
                    try {
                      if (dirty)
                        throw new Error(
                          "Salve ou descarte as alterações antes de reabrir o planejamento.",
                        );
                      if (
                        window.confirm(
                          "Reabrir o planejamento? As informações serão liberadas para edição e a requisição precisará ser enviada e analisada novamente.",
                        )
                      )
                        onSave(
                          reopenDLPlanning(plan, true),
                          "Planejamento reaberto; novo envio e análise necessários",
                          { reopenPlanning: true },
                        );
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Não foi possível reabrir.",
                      );
                    }
                  }}
                >
                  Reabrir planejamento
                </button>
              </div>
            </details>
          )}
        </div>
      </div>
      {!editable && (
        <DLPlanningOverview plan={plan} showObservation={tab === "items"} />
      )}
      <div className="tabs dl-record-tabs">
        {[
          ["items", "Materiais e orçamento"],
          ["request", "Requisição e processo"],
          ["contract", "Contratação e fornecedores"],
          ["schedule", "Cronograma"],
          ["history", "Histórico"],
        ].map(([id, label]) => (
          <button
            className={`tab ${tab === id ? "active" : ""}`}
            key={id}
            aria-label={id === "schedule" ? "Cronograma da DL" : label}
            title={
              id === "items"
                ? editable
                  ? "Etapa aguardando"
                  : "Planejamento fechado"
                : id === "request"
                  ? plan.requestReview
                    ? "Etapa concluída"
                    : "Etapa aguardando"
                  : id === "contract"
                    ? plan.contract?.release
                      ? "Etapa concluída"
                      : "Etapa aguardando"
                    : label
            }
            onClick={() => {
              setOrderRevealKey(0);
              setTab(id);
            }}
          >
            {id === "items" || id === "request" || id === "contract" ? (
              (
                id === "items"
                  ? [
                      "Planejamento concluído",
                      "Gerar requisição",
                      "Analisar requisição gerada",
                      "Em processo",
                      "Pedido gerado",
                      "Requisição registrada",
                      "Em tramitação",
                      "Aguardando dados finais",
                      "Concluído",
                    ].includes(plan.stage)
                  : id === "request"
                    ? Boolean(plan.requestReview)
                    : Boolean(plan.contract?.release)
              ) ? (
                <CircleCheck
                  size={15}
                  className="dl-step-complete"
                  aria-hidden="true"
                />
              ) : (
                <Clock3
                  size={15}
                  className="dl-step-pending"
                  aria-hidden="true"
                />
              )
            ) : null}
            {id === "items"
              ? "Materiais"
              : id === "request"
                ? "Processo"
                : id === "contract"
                  ? "Contratação"
                  : label}
          </button>
        ))}
      </div>
      {error && (
        <p className="catalog-error" role="alert">
          {error}
        </p>
      )}
      {tab === "schedule" && (
        <DLSchedulePanel
          plan={plan}
          value={scheduleDraft}
          onChange={setScheduleDraft}
          readOnly={justificationDirty}
        />
      )}
      {tab === "contract" && (
        <DLContractSummary
          plan={plan}
          items={items}
          onOpenProcess={() => {
            setOrderRevealKey(0);
            setTab("request");
          }}
          onOpenOrderDocuments={() => {
            setOrderRevealKey((current) => current + 1);
            setTab("request");
          }}
        />
      )}
      {releaseOpen && (
        <DLReleaseDialog
          plan={plan}
          items={items}
          onClose={() => setReleaseOpen(false)}
          onConfirm={(checked, confirmed) => {
            onSave(
              releaseDLPlan(plan, checked, confirmed),
              "DL concluída e disponibilizada no Controle",
              { release: true },
            );
            setReleaseOpen(false);
          }}
        />
      )}
      {openedMaterial &&
        draft.lines.some((line) => line.id === openedMaterial) && (
          <DLPlanningMaterialDialog
            plan={draft}
            line={draft.lines.find((line) => line.id === openedMaterial)!}
            item={items.find(
              (item) =>
                item.id ===
                draft.lines.find((line) => line.id === openedMaterial)!.itemId,
            )}
            quantity={values[openedMaterial]?.quantity ?? ""}
            price={values[openedMaterial]?.price ?? ""}
            dirty={planningDirty}
            onClose={() => setOpenedMaterial(null)}
          />
        )}
      {tab === "items" && (
        <>
          {editable ? (
            <div className="form-grid dl-planning-fields">
              {(
                [
                  ["title", "Objeto / título"],
                  ["category", "Categoria"],
                  ["openedOn", "Data de abertura"],
                  ["deliveryDate", "Data de entrega"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    aria-label={label}
                    disabled={!editable || justificationDirty}
                    type={
                      key === "openedOn" || key === "deliveryDate"
                        ? "date"
                        : "text"
                    }
                    value={draft[key] ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Vigência (meses)
                <input
                  aria-label="Vigência prevista (meses)"
                  type="number"
                  min="1"
                  max="1200"
                  step="1"
                  placeholder="A definir"
                  disabled={!editable || justificationDirty}
                  value={draft.plannedValidityMonths ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      plannedValidityMonths:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  title="Período previsto no planejamento. A vigência contratual é definida após a emissão do pedido."
                />
              </label>
              <label className="dl-observation-field dl-planning-observation">
                Observação / Justificativa
                <textarea
                  aria-label="Observação / Justificativa"
                  rows={2}
                  disabled={!editable || justificationDirty}
                  value={dlObservation(draft)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      justification: e.target.value,
                      notes: "",
                    })
                  }
                />
              </label>
              <label className="dl-planning-requester">
                Solicitante
                <input
                  aria-label="Solicitante"
                  disabled={!editable || justificationDirty}
                  value={draft.responsible}
                  onChange={(e) =>
                    setDraft({ ...draft, responsible: e.target.value })
                  }
                />
              </label>
            </div>
          ) : null}
          <div className="panel-heading dl-budget-heading">
            <div>
              <h3>Materiais do planejamento</h3>
              <p className="muted">
                {draft.lines.length} materiais ·{" "}
                {editable
                  ? "Informe quantidades e preços para compor o orçamento."
                  : "Planejamento concluído · valores previstos preservados."}
              </p>
            </div>
            <button
              className="secondary-button"
              disabled={!editable || justificationDirty}
              onClick={() => setPicker(true)}
            >
              Adicionar materiais
            </button>
          </div>
          <div
            className="table-wrap"
            role="region"
            aria-label="Materiais e orçamento"
            tabIndex={0}
          >
            <table className="dl-budget-table">
              <colgroup>
                <col className="dl-budget-material" />
                <col className="dl-budget-unit" />
                <col className="dl-budget-quantity" />
                <col className="dl-budget-price" />
                <col className="dl-budget-subtotal" />
                <col className="dl-budget-action" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Material</th>
                  <th scope="col">Unidade</th>
                  <th scope="col">QTD</th>
                  <th scope="col">Preço previsto</th>
                  <th scope="col">Subtotal</th>
                  <th scope="col">Ação</th>
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((line) => {
                  const item = items.find((item) => item.id === line.itemId);
                  let subtotal = "A definir";
                  try {
                    const current = previewLines.find(
                      (value) => value.id === line.id,
                    );
                    if (!current) throw new Error("Revise os valores");
                    const amount = lineSubtotal(current);
                    if (amount !== null) subtotal = formatMoney(amount);
                  } catch {
                    subtotal = "Revisar";
                  }
                  return (
                    <tr key={line.id}>
                      <td className="dl-budget-description">
                        <button
                          className="text-button"
                          onClick={() => setOpenedMaterial(line.id)}
                        >
                          {item?.description ?? line.itemId}
                        </button>
                        <small className="dl-budget-item-code">
                          {item?.code ?? "Cadastro indisponível"}
                        </small>
                        {item?.technicalSpecification && (
                          <small className="dl-spec">
                            {item.technicalSpecification}
                          </small>
                        )}
                      </td>
                      <td>
                        {line.unit}
                        {item && item.unit !== line.unit && (
                          <small className="dl-spec">
                            Unidade atual do cadastro: {item.unit}. Confira
                            antes de solicitar.
                          </small>
                        )}
                      </td>
                      <td>
                        <input
                          aria-label={`Quantidade ${item?.code}`}
                          inputMode="decimal"
                          disabled={!editable || justificationDirty}
                          value={values[line.id]?.quantity ?? ""}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              [line.id]: {
                                ...values[line.id],
                                quantity: e.target.value,
                              },
                            })
                          }
                        />
                      </td>
                      <td>
                        <DLMoneyInput
                          label={`Preço ${item?.code}`}
                          disabled={!editable || justificationDirty}
                          value={values[line.id]?.price ?? ""}
                          onChange={(price) =>
                            setValues((current) => ({
                              ...current,
                              [line.id]: { ...current[line.id], price },
                            }))
                          }
                        />
                      </td>
                      <td>{subtotal}</td>
                      <td className="dl-budget-row-actions">
                        <button
                          className="icon-button"
                          aria-label={`Consultar material ${item?.code || line.itemId}`}
                          onClick={() => setOpenedMaterial(line.id)}
                        >
                          <Eye size={16} />
                        </button>
                        {editable && (
                          <button
                            className="text-button"
                            disabled={justificationDirty}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Retirar ${item?.code} deste planejamento?`,
                                )
                              )
                                setDraft({
                                  ...draft,
                                  lines: draft.lines.filter(
                                    (value) => value.id !== line.id,
                                  ),
                                });
                            }}
                          >
                            Retirar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!draft.lines.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Adicione materiais do catálogo MXM para montar o
                      orçamento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <section
            className="dl-budget-summary"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="dl-budget-summary-label">
              <div>
                <span>Total previsto</span>
                {budgetSummary && budgetSummary.incomplete > 0 && (
                  <span className="dl-budget-partial">Parcial</span>
                )}
              </div>
              <p>
                {budgetSummary?.incomplete
                  ? "Soma dos materiais com quantidade e preço informados."
                  : "Orçamento do planejamento."}
              </p>
            </div>
            <div className="dl-budget-summary-value">
              <strong
                className={budgetSummary ? "" : "dl-budget-summary-error"}
              >
                {budgetSummary?.amount || "Revise os valores digitados"}
              </strong>
              <p>
                {budgetSummary
                  ? budgetSummary.incomplete
                    ? `${budgetSummary.incomplete} ${budgetSummary.incomplete === 1 ? "material a completar" : "materiais a completar"}`
                    : draft.lines.length
                      ? "Todos os materiais preenchidos"
                      : "Adicione materiais para começar"
                  : "Confira as quantidades e os preços."}
              </p>
            </div>
          </section>
          <section
            className="dl-planning-help"
            aria-label="Orientações do orçamento"
          >
            <p>
              Quantidade: até 3 casas decimais. Preço em R$: até 2 casas, sem
              separador de milhar ao editar. Rascunhos podem ter quantidades ou
              preços em branco. O orçamento não representa saldo contratado.
            </p>
          </section>
        </>
      )}
      {tab === "request" && (
        <DLRequestWorkflow
          plan={plan}
          items={items}
          request={draft.request}
          onChange={(request) => setDraft({ ...draft, request })}
          onAction={requestAction}
          otherChanges={otherRequestChanges}
          prelude={
            <DLJustificationStep
              plan={plan}
              text={justificationText}
              onTextChange={setJustificationText}
              blocked={
                planningDirty || scheduleDirty || contractDirty || requestDirty
              }
              onPersist={(candidate, label, options) => {
                onSave(candidate, label, options);
              }}
            />
          }
          finalSteps={
            <DLProcessStages
              plan={plan}
              items={items}
              value={contractDraft}
              onChange={setContractDraft}
              contractDirty={contractDirty}
              blocked={processBlocked}
              onPersist={(candidate, label, options) => {
                onSave(candidate, label, options);
              }}
              onSaveContract={saveContract}
              onApprove={() => setReleaseOpen(true)}
              orderRevealKey={orderRevealKey}
            />
          }
        />
      )}
      {tab === "history" && (
        <section
          className="dl-history-section"
          aria-labelledby="dl-history-title"
        >
          <DLHistory
            heading="Histórico de atividades"
            planId={plan.id}
            events={workspace.events}
          />
        </section>
      )}
      {picker && (
        <CycleItemPicker
          context="dl"
          items={items}
          existingIds={draft.lines.map((line) => line.itemId)}
          groups={[]}
          defaultGroupId={null}
          onClose={() => setPicker(false)}
          onAdd={(ids) => {
            const result = addDLItems(draft, items, ids);
            setDraft(result.plan);
            setValues((current) => ({
              ...current,
              ...Object.fromEntries(
                result.added.map((line) => [
                  line.id,
                  { quantity: "", price: "" },
                ]),
              ),
            }));
            setPicker(false);
          }}
        />
      )}
    </section>
  );
}
