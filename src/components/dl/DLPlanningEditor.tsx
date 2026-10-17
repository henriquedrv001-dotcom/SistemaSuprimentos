import DLContractForm, {
  contractInput,
  materializeContract,
} from "./DLContractForm";
import DLReleaseDialog from "./DLReleaseDialog";
import { releaseDLPlan, validateDLContract } from "../../services/dlContract";
import { useEffect, useState } from "react";
import type { DLPlan } from "../../types/dl";
import { dlStages } from "../../types/dl";
import type { DLStage } from "../../types/dl";
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
  const [draft, setDraft] = useState<DLPlan>(() => structuredClone(plan));
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
  const [contractDraft, setContractDraft] = useState(() =>
    contractInput(plan.contract),
  );
  const [releaseOpen, setReleaseOpen] = useState(false);
  useEffect(() => {
    setDraft(structuredClone(plan));
    setContractDraft(contractInput(plan.contract));
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
    JSON.stringify(contractInput(plan.contract));
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState("");
  const dirty =
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
  let budgetText = "";
  try {
    previewLines = materialize().lines;
    const budget = planBudget(previewLines);
    budgetText = `${formatMoney(budget.totalCents)}${budget.incomplete ? ` · parcial, ${budget.incomplete} item(ns) a completar` : ""}`;
  } catch {
    budgetText = "Revise os valores digitados";
  }
  const editable = editableDLItems(plan);
  function save(stage = draft.stage, action = "Planejamento atualizado") {
    try {
      const candidate = materialize(stage);
      validateDLPlan(candidate);
      const saved = onSave(candidate, action);
      setDraft(structuredClone(saved));
      setContractDraft(contractInput(saved.contract));
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
    <section className="panel dl-editor">
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
          <h2>
            {plan.code} · {plan.title}
          </h2>
          <p className="muted">
            {plan.stage} ·{" "}
            {dirty ? "Alterações não salvas" : "Salvo neste navegador"}
          </p>
        </div>
        <div className="dl-actions">
          <button
            className="primary-button"
            disabled={released}
            onClick={() => save()}
          >
            Salvar alterações
          </button>
          {released ? null : editable ? (
            <button
              className="secondary-button"
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
            <button
              className="secondary-button"
              onClick={() => {
                if (
                  window.confirm(
                    "Reabrir o planejamento para revisar materiais e orçamento?",
                  )
                )
                  save("Em planejamento", "Planejamento reaberto");
              }}
            >
              Reabrir planejamento
            </button>
          )}
        </div>
      </div>
      <div className="tabs">
        {[
          ["items", "Materiais e orçamento"],
          ["request", "Requisição e processo"],
          ["contract", "Contratação e fornecedores"],
          ["history", "Histórico"],
        ].map(([id, label]) => (
          <button
            className={`tab ${tab === id ? "active" : ""}`}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p className="catalog-error" role="alert">
          {error}
        </p>
      )}
      {tab === "contract" && (
        <>
          <DLContractForm
            plan={plan}
            items={items}
            value={contractDraft}
            onChange={setContractDraft}
            readOnly={
              released ||
              editable ||
              ["Cancelado", "Suspenso", "Não contratado"].includes(plan.stage)
            }
          />
          {!released && (
            <div className="form-actions">
              <span className="muted">
                {dirty
                  ? "Salve as alterações para conferir a conclusão."
                  : "A conclusão exige pedidos MXM emitidos e dados finais conferidos."}
              </span>
              <button
                className="primary-button"
                disabled={
                  dirty ||
                  editable ||
                  ["Cancelado", "Suspenso", "Não contratado"].includes(
                    plan.stage,
                  )
                }
                onClick={() => {
                  try {
                    validateDLContract(plan, true);
                    setReleaseOpen(true);
                    setError("");
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Revise a contratação.",
                    );
                  }
                }}
              >
                Concluir DL e disponibilizar no Controle
              </button>
            </div>
          )}
        </>
      )}
      {releaseOpen && (
        <DLReleaseDialog
          plan={plan}
          items={items}
          onClose={() => setReleaseOpen(false)}
          onConfirm={(checked, text) => {
            onSave(
              releaseDLPlan(plan, checked, text),
              "DL concluída e disponibilizada no Controle",
              { release: true },
            );
            setReleaseOpen(false);
          }}
        />
      )}
      {tab === "items" && (
        <>
          <div className="form-grid">
            {(
              [
                ["title", "Objeto / título"],
                ["category", "Categoria"],
                ["openedOn", "Data de abertura"],
                ["responsible", "Responsável"],
                ["justification", "Justificativa"],
                ["notes", "Observações"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  disabled={released}
                  type={key === "openedOn" ? "date" : "text"}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <div className="panel-heading">
            <div>
              <h3>Orçamento previsto: {budgetText}</h3>
              <p className="muted">
                Quantidade: até 3 casas decimais. Preço unitário: reais, até 2
                casas. Sem separador de milhar.
              </p>
            </div>
            <button
              className="secondary-button"
              disabled={!editable}
              onClick={() => setPicker(true)}
            >
              Adicionar materiais
            </button>
          </div>
          <div className="table-wrap">
            <table className="dl-budget-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Material</th>
                  <th>Unidade</th>
                  <th>Quantidade</th>
                  <th>Preço unitário previsto (R$)</th>
                  <th>Subtotal previsto</th>
                  <th>Ação</th>
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
                      <td>{item?.code ?? "Cadastro indisponível"}</td>
                      <td>
                        {item?.description ?? line.itemId}
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
                          disabled={!editable}
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
                        <input
                          aria-label={`Preço ${item?.code}`}
                          inputMode="decimal"
                          disabled={!editable}
                          value={values[line.id]?.price ?? ""}
                          onChange={(e) =>
                            setValues({
                              ...values,
                              [line.id]: {
                                ...values[line.id],
                                price: e.target.value,
                              },
                            })
                          }
                        />
                      </td>
                      <td>{subtotal}</td>
                      <td>
                        <button
                          className="text-button"
                          disabled={!editable}
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
                      </td>
                    </tr>
                  );
                })}
                {!draft.lines.length && (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      Adicione materiais do catálogo MXM para montar o
                      orçamento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="muted">
            Rascunhos podem ter quantidades ou preços em branco. O orçamento não
            representa saldo contratado.
          </p>
        </>
      )}
      {tab === "request" && (
        <>
          <div className="form-grid">
            <label>
              Situação
              <select
                disabled={released}
                value={draft.stage}
                onChange={(e) =>
                  setDraft({ ...draft, stage: e.target.value as DLStage })
                }
              >
                {dlStages
                  .filter(
                    (stage) =>
                      stage === draft.stage ||
                      (stage !== "Concluído" &&
                        (editable
                          ? [
                              "Rascunho",
                              "Em planejamento",
                              "Suspenso",
                              "Cancelado",
                              "Não contratado",
                            ].includes(stage)
                          : !["Rascunho", "Em planejamento"].includes(stage))),
                  )
                  .map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
              </select>
            </label>
            {(
              [
                ["mxmNumber", "Número da requisição MXM"],
                ["date", "Data da requisição"],
                ["processNumber", "Número do processo"],
                ["officialDLNumber", "Referência oficial da DL"],
                ["responsible", "Responsável pela tramitação"],
                ["notes", "Observações / motivo da situação"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type={key === "date" ? "date" : "text"}
                  disabled={released}
                  value={draft.request[key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      request: { ...draft.request, [key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <p className="muted">
            DL identifica o processo de aquisição. PCD é o pedido ao CD; PDL
            utiliza saldo de uma DL; PFR é emergencial. Os pedidos serão
            conectados na próxima etapa.
          </p>
        </>
      )}
      {tab === "history" && (
        <>
          <h3>Histórico desta DL</h3>
          {workspace.events
            .filter((event) => event.planId === plan.id)
            .map((event) => (
              <article className="dl-event" key={event.id}>
                <strong>{event.action}</strong>
                <p style={{ whiteSpace: "pre-wrap" }}>{event.details}</p>
                <small>
                  {new Date(event.timestamp).toLocaleString("pt-BR")} ·{" "}
                  {event.actor}
                </small>
              </article>
            ))}
        </>
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
