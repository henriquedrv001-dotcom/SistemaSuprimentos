import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Plus, Printer, Save, Trash2 } from "lucide-react";
import type { Order, OrderLine, OrderWorkspace } from "../types/orders";
import type { DLMovementFlow, MovementArea } from "../types/dlMovement";
import type { OrderContext } from "../services/orders";
import { originOrderLine } from "../services/orders";
import {
  movementSources,
  recordMovementInvoice,
  movementInvoiceCents,
  recordMovementRequest,
  serveMovementRequest,
  finishMovement,
  cancelMovement,
} from "../services/dlMovement";
import {
  emptyMovementFlow,
  movementTotals,
  movementPlanIds,
  movementAreaSuggestions,
  allocatedMilli,
  areaRequestedMilli,
} from "../services/dlMovementMath";
import { printMovementArea } from "../services/dlMovementPrint";
import {
  decimalInput,
  formatMoney,
  parseScaledInput,
} from "../services/dlPlanning";
import FilterSelect from "./ui/FilterSelect";
import DLMoneyInput from "./dl/DLMoneyInput";
import FilterSearch from "./ui/FilterSearch";
import "./DLMovementWorkspace.css";

type Props = {
  order: Order;
  editable: boolean;
  workspace: OrderWorkspace;
  context: OrderContext;
  blocked: boolean;
  error: string;
  message: string;
  onChange: (order: Order) => void;
  onLocalDirtyChange: (dirty: boolean) => void;
  onBack: () => void;
  onEdit: () => void;
  onSave: (confirm: boolean) => void;
  onCommit: (
    change: (
      workspace: OrderWorkspace,
      context: OrderContext,
    ) => OrderWorkspace,
    feedback: string,
  ) => boolean;
};
export default function DLMovementWorkspace({
  order,
  editable,
  workspace,
  context,
  error,
  blocked,
  message,
  onChange,
  onLocalDirtyChange,
  onBack,
  onEdit,
  onSave,
  onCommit,
}: Props) {
  const flow = order.movementFlow!;
  const formRef = useRef<HTMLElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<Record<string, boolean>>({});
  const [localError, setLocalError] = useState("");
  const [newArea, setNewArea] = useState("");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<
    "invoice" | "request" | "serve" | "cancel" | null
  >(null);
  const [number, setNumber] = useState("");
  const [issuedOn, setIssuedOn] = useState(context.today);
  const [enteredOn, setEnteredOn] = useState(context.today);
  const [areaId, setAreaId] = useState(flow.areas[0]?.id || "");
  const [requestId, setRequestId] = useState("");
  const [entryQuantities, setEntryQuantities] = useState<
    Record<string, string>
  >({});
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [actor, setActor] = useState(order.requester);
  const [cancelReason, setCancelReason] = useState("");
  useEffect(() => {
    if (form) formRef.current?.focus();
  }, [form]);
  useEffect(() => {
    if (error || localError) alertRef.current?.focus();
  }, [error, localError]);
  let sources: ReturnType<typeof movementSources> = [];
  let sourceError = "";
  try {
    sources = movementSources(context, workspace, order.id);
  } catch (cause) {
    sourceError =
      cause instanceof Error
        ? cause.message
        : "Não foi possível conferir os saldos.";
  }
  let totals: ReturnType<typeof movementTotals>;
  try {
    totals = movementTotals(flow, order.lines);
  } catch (cause) {
    sourceError =
      cause instanceof Error
        ? cause.message
        : "Revise os valores da distribuição.";
    totals = movementTotals(emptyMovementFlow(), []);
  }
  const selectedPlanIds = movementPlanIds(flow);
  const supplierOptions = (ids: string[]) =>
    ids.length
      ? [
          ...new Set(
            sources
              .filter((row) => ids.includes(row.plan.id))
              .map((row) => row.origin.supplier),
          ),
        ].filter((supplier) =>
          ids.every((id) =>
            sources.some(
              (row) => row.plan.id === id && row.origin.supplier === supplier,
            ),
          ),
        )
      : [];
  const commonSuppliers = supplierOptions(selectedPlanIds);
  const plansWithBalance = [
    ...new Map(sources.map((row) => [row.plan.id, row.plan])).values(),
  ];
  const fold = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const selectedSources = sources.filter(
    (row) =>
      selectedPlanIds.includes(row.plan.id) &&
      (!order.supplier || row.origin.supplier === order.supplier),
  );
  const visibleSources = selectedSources.filter((row) =>
    fold(
      `${row.item?.description} ${row.item?.code} ${row.plan.code} ${row.origin.supplier}`,
    ).includes(fold(query.trim())),
  );
  const lineTitle = (line: OrderLine) =>
    order.lines.filter((other) => other.description === line.description)
      .length > 1
      ? `${line.description} · ${line.dlCode} · Pedido ${line.mxmOrder}`
      : line.description;
  const patch = (changes: Partial<Order>, nextFlow?: DLMovementFlow) =>
    onChange({ ...order, ...changes, movementFlow: nextFlow || flow });
  const patchFlow = (changes: Partial<DLMovementFlow>) =>
    patch({}, { ...flow, ...changes });
  function numeric(
    key: string,
    value: number,
    scale: 2 | 3,
    name: string,
    apply: (n: number) => void,
    compact = false,
  ) {
    return (
      <label className={compact ? "movement-quantity-field" : undefined}>
        <span>{name}</span>
        {scale === 2 ? (
          <DLMoneyInput
            label={name}
            disabled={false}
            value={raw[key] ?? decimalInput(value, scale)}
            onChange={(text) => {
              setRaw((current) => ({ ...current, [key]: text }));
              onLocalDirtyChange(true);
              try {
                const n = parseScaledInput(text, scale, name) || 0;
                apply(n);
                setInvalid((current) => ({ ...current, [key]: false }));
                setLocalError("");
              } catch (cause) {
                setInvalid((current) => ({ ...current, [key]: true }));
                setLocalError(
                  cause instanceof Error ? cause.message : "Revise o valor.",
                );
              }
            }}
          />
        ) : (
          <input
            aria-label={name}
            inputMode="decimal"
            value={raw[key] ?? decimalInput(value, scale)}
            aria-invalid={invalid[key] || undefined}
            onChange={(event) => {
              const text = event.target.value;
              setRaw((current) => ({ ...current, [key]: text }));
              onLocalDirtyChange(true);
              try {
                const n = parseScaledInput(text, scale, name) || 0;
                apply(n);
                setInvalid((current) => ({ ...current, [key]: false }));
                setLocalError("");
              } catch (cause) {
                setInvalid((current) => ({ ...current, [key]: true }));
                setLocalError(
                  cause instanceof Error ? cause.message : "Revise o valor.",
                );
              }
            }}
          />
        )}
      </label>
    );
  }
  function addArea(name: string) {
    name = name.trim();
    if (!name) return;
    if (
      flow.areas.some(
        (area) =>
          area.name.toLocaleLowerCase("pt-BR") ===
          name.toLocaleLowerCase("pt-BR"),
      )
    ) {
      setLocalError("Esta área já foi selecionada.");
      return;
    }
    patchFlow({
      areas: [
        ...flow.areas,
        { id: crypto.randomUUID(), name, targetCents: 0, allocations: [] },
      ],
    });
    setNewArea("");
    setLocalError("");
  }
  function removeArea(area: MovementArea) {
    if (
      area.allocations.some((a) => a.quantityMilli) &&
      !window.confirm(
        `Retirar ${area.name} e suas quantidades da distribuição em edição? A reserva só mudará ao salvar.`,
      )
    )
      return;
    const areas = flow.areas.filter((candidate) => candidate.id !== area.id);
    const lines = order.lines.map((line) => ({
      ...line,
      quantityMilli: areas.reduce(
        (sum, a) => sum + allocatedMilli(a, line.id),
        0,
      ),
    }));
    patch({ lines }, { ...flow, areas });
  }
  function allocate(areaId: string, line: OrderLine, quantityMilli: number) {
    const areas = flow.areas.map((area) =>
      area.id !== areaId
        ? area
        : {
            ...area,
            allocations: [
              ...area.allocations.filter((a) => a.lineId !== line.id),
              { lineId: line.id, quantityMilli },
            ],
          },
    );
    patch(
      {
        lines: order.lines.map((candidate) =>
          candidate.id !== line.id
            ? candidate
            : {
                ...candidate,
                quantityMilli: areas.reduce(
                  (sum, area) => sum + allocatedMilli(area, line.id),
                  0,
                ),
              },
        ),
      },
      { ...flow, areas },
    );
  }
  function start(next: typeof form, selectedRequest = "") {
    setForm(next);
    setNumber("");
    setEntryQuantities({});
    setInvoiceAmount("");
    setIssuedOn(context.today);
    setEnteredOn(context.today);
    setRequestId(selectedRequest);
    setAreaId(flow.areas[0]?.id || "");
    setLocalError("");
    setCancelReason("");
  }
  function closeForm() {
    if (
      !window.confirm(
        "Fechar esta conferência? Os dados ainda não registrados serão descartados.",
      )
    )
      return;
    setForm(null);
    onLocalDirtyChange(false);
    setLocalError("");
  }
  function quantities() {
    return Object.fromEntries(
      Object.entries(entryQuantities).map(([id, value]) => [
        id,
        parseScaledInput(value, 3, "Quantidade") || 0,
      ]),
    );
  }
  function register() {
    try {
      let success = false;
      if (form === "invoice") {
        const q = quantities();
        const totalCents =
          parseScaledInput(invoiceAmount, 2, "Valor da NF") || 0;
        success = onCommit(
          (ws, ctx) =>
            recordMovementInvoice(
              ws,
              order.id,
              { actor, number, issuedOn, enteredOn, totalCents, quantities: q },
              ctx,
            ),
          "Entrada da NF registrada. Saldo da DL atualizado uma única vez.",
        );
      }
      if (form === "request") {
        const q = quantities();
        success = onCommit(
          (ws, ctx) =>
            recordMovementRequest(
              ws,
              order.id,
              {
                actor,
                areaId,
                reference: number,
                requestedOn: issuedOn,
                quantities: q,
              },
              ctx,
            ),
          "Solicitação da área registrada.",
        );
      }
      if (form === "serve") {
        const q = quantities();
        success = onCommit(
          (ws) => serveMovementRequest(ws, order.id, requestId, q, actor),
          "Atendimento registrado, sem nova baixa na DL.",
        );
      }
      if (form === "cancel")
        success = onCommit(
          (ws) => cancelMovement(ws, order.id, actor, cancelReason),
          "Distribuição cancelada; reserva liberada.",
        );
      if (success) {
        setForm(null);
        onLocalDirtyChange(false);
        setLocalError("");
      }
    } catch (cause) {
      setLocalError(
        cause instanceof Error ? cause.message : "Confira os dados.",
      );
    }
  }
  const selectedRequest = flow.requests.find(
    (request) => request.id === requestId,
  );
  const selectedArea = flow.areas.find((area) => area.id === areaId);
  const formLines = order.lines.filter(
    (line) =>
      form === "invoice" ||
      (form === "request" &&
        selectedArea &&
        allocatedMilli(selectedArea, line.id) > 0) ||
      (form === "serve" &&
        selectedRequest?.lines.some((entry) => entry.lineId === line.id)),
  );
  const pending = (line: OrderLine) =>
    form === "invoice"
      ? line.quantityMilli - line.receivedMilli
      : form === "request" && selectedArea
        ? allocatedMilli(selectedArea, line.id) -
          areaRequestedMilli(flow, areaId, line.id)
        : (selectedRequest?.lines.find((entry) => entry.lineId === line.id)
            ?.quantityMilli || 0) -
          (selectedRequest?.lines.find((entry) => entry.lineId === line.id)
            ?.servedMilli || 0);
  let invoicePreview: number | null = null;
  let invoiceDifference: number | null = null;
  let invoicePreviewError = "";
  if (form === "invoice") {
    try {
      invoicePreview = movementInvoiceCents(order, quantities());
      const informed = parseScaledInput(invoiceAmount, 2, "Valor da NF");
      invoiceDifference = informed === null ? null : informed - invoicePreview;
    } catch (cause) {
      invoicePreviewError =
        cause instanceof Error ? cause.message : "Revise a entrada.";
    }
  }
  const closed = ["Concluído", "Cancelado"].includes(flow.phase);
  const complete = flow.areas.every((area) =>
    order.lines.every(
      (line) =>
        areaRequestedMilli(flow, area.id, line.id, true) ===
        allocatedMilli(area, line.id),
    ),
  );
  const delta = (value: number) =>
    value === 0
      ? "Conferido"
      : `${value > 0 ? "Falta distribuir" : "Acima do previsto"}: ${formatMoney(Math.abs(value))}`;
  const requestStatus = (request: (typeof flow.requests)[number]) =>
    request.lines.every((line) => line.servedMilli === line.quantityMilli)
      ? "Atendida"
      : request.lines.some((line) => line.servedMilli > 0)
        ? "Atendimento parcial"
        : "Aguardando atendimento";
  return (
    <section className="dl-movement" aria-labelledby="movement-title">
      <header className="movement-heading">
        <div>
          <h1 id="movement-title">DL PARA ENTRADA E SAÍDA</h1>
          <p>
            {order.code || "Nova distribuição"} · {flow.phase}
          </p>
        </div>
        <div className="movement-actions">
          <button className="secondary-button" onClick={onBack}>
            <ArrowLeft size={16} /> Voltar
          </button>
          {editable ? (
            <>
              <button
                className="secondary-button"
                disabled={blocked || Object.values(invalid).some(Boolean)}
                onClick={() => onSave(false)}
              >
                <Save size={16} /> Salvar distribuição
              </button>
              <button
                className="primary-button"
                disabled={blocked || Object.values(invalid).some(Boolean)}
                onClick={() => onSave(true)}
              >
                <Check size={16} /> Confirmar distribuição
              </button>
            </>
          ) : flow.phase === "Distribuição" ? (
            <button
              className="primary-button"
              disabled={blocked}
              onClick={onEdit}
            >
              Editar distribuição
            </button>
          ) : null}
        </div>
      </header>
      <ol className="movement-steps" aria-label="Etapas do fluxo">
        {[
          "Distribuição",
          "Entrada da NF",
          "Solicitações das áreas",
          "Concluído",
        ].map((step, index) => (
          <li
            key={step}
            aria-current={flow.phase === step ? "step" : undefined}
          >
            <span>{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      {(error || localError || sourceError) && (
        <p className="notice" role="alert" ref={alertRef} tabIndex={-1}>
          {error || localError || sourceError}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <p className="movement-note">
        Salvar reserva os materiais. A entrada da NF baixa as quantidades na DL;
        as solicitações das áreas não fazem nova baixa. Registros de entrada e
        atendimento são informados por você.
      </p>
      <section className="movement-panel">
        <h2>Dados da solicitação</h2>
        {editable ? (
          <div className="movement-fields">
            <label>
              Responsável
              <input
                aria-label="Responsável pela distribuição"
                value={order.requester}
                onChange={(event) => patch({ requester: event.target.value })}
              />
            </label>
            <div className="movement-dl-picker">
              <FilterSelect
                label="DLs com saldo"
                value=""
                options={[
                  {
                    value: "",
                    label: selectedPlanIds.length
                      ? "Adicionar outra DL"
                      : "Selecionar DLs",
                  },
                  ...plansWithBalance
                    .filter((plan) => !selectedPlanIds.includes(plan.id))
                    .map((plan) => {
                      const compatible = supplierOptions([
                        ...selectedPlanIds,
                        plan.id,
                      ]);
                      return {
                        value: plan.id,
                        label: `${plan.code} · ${plan.title}`,
                        disabled: order.supplier
                          ? !compatible.includes(order.supplier)
                          : !compatible.length,
                      };
                    }),
                ]}
                onChange={(id) => {
                  if (!id || selectedPlanIds.includes(id)) return;
                  const planIds = [...selectedPlanIds, id];
                  const options = supplierOptions(planIds);
                  patch(
                    {
                      supplier:
                        order.supplier ||
                        (options.length === 1 ? options[0] : ""),
                    },
                    { ...flow, planId: planIds[0], planIds },
                  );
                  setQuery("");
                }}
              />
              <div className="movement-selected-dls">
                {selectedPlanIds.map((id) => {
                  const plan = context.plans.find((plan) => plan.id === id);
                  return (
                    <span key={id}>
                      {plan?.code || id}
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Retirar DL ${plan?.code || id}`}
                        onClick={() => {
                          const removed = order.lines.filter(
                            (line) => line.planId === id,
                          );
                          if (
                            removed.some((line) => line.quantityMilli > 0) &&
                            !window.confirm(
                              "Retirar esta DL e suas quantidades de todas as áreas desta edição? A reserva só muda ao salvar.",
                            )
                          )
                            return;
                          const planIds = selectedPlanIds.filter(
                            (planId) => planId !== id,
                          );
                          const lines = order.lines.filter(
                            (line) => line.planId !== id,
                          );
                          const options = supplierOptions(planIds);
                          patch(
                            {
                              lines,
                              supplier: planIds.length
                                ? order.supplier ||
                                  (options.length === 1 ? options[0] : "")
                                : "",
                            },
                            {
                              ...flow,
                              planId: planIds[0] || "",
                              planIds,
                              areas: flow.areas.map((area) => ({
                                ...area,
                                allocations: area.allocations.filter(
                                  (a) =>
                                    !removed.some(
                                      (line) => line.id === a.lineId,
                                    ),
                                ),
                              })),
                            },
                          );
                          setQuery("");
                          setRaw({});
                          setInvalid({});
                        }}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
            <FilterSelect
              label="Fornecedor"
              value={order.supplier}
              options={[
                { value: "", label: "Selecionar fornecedor" },
                ...commonSuppliers.map((supplier) => ({
                  value: supplier,
                  label: supplier,
                })),
              ]}
              onChange={(supplier) => {
                if (supplier === order.supplier) return;
                if (
                  order.lines.length &&
                  !window.confirm(
                    "Trocar o fornecedor remove os itens desta edição. Continuar?",
                  )
                )
                  return;
                patch(
                  { supplier, lines: [] },
                  {
                    ...flow,
                    areas: flow.areas.map((area) => ({
                      ...area,
                      allocations: [],
                    })),
                  },
                );
                setRaw({});
                setInvalid({});
                setQuery("");
              }}
            />
            <label>
              Justificativa
              <input
                aria-label="Justificativa"
                value={flow.billReference}
                onChange={(event) =>
                  patchFlow({ billReference: event.target.value })
                }
              />
            </label>
            <label>
              Data da solicitação
              <input
                aria-label="Data da solicitação"
                type="date"
                value={flow.billDate}
                max={context.today}
                onChange={(event) =>
                  patchFlow({ billDate: event.target.value })
                }
              />
            </label>
            {numeric(
              "bill-total",
              flow.billTotalCents,
              2,
              "Valor total (R$)",
              (billTotalCents) => patchFlow({ billTotalCents }),
            )}
          </div>
        ) : (
          <dl className="movement-facts">
            <div>
              <dt>Justificativa</dt>
              <dd>{flow.billReference || "Não informada"}</dd>
            </div>
            <div>
              <dt>Fornecedor</dt>
              <dd>{order.supplier}</dd>
            </div>
            <div>
              <dt>DLs</dt>
              <dd>
                {selectedPlanIds
                  .map(
                    (id) =>
                      context.plans.find((plan) => plan.id === id)?.code || id,
                  )
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt>Data da solicitação</dt>
              <dd>
                {flow.billDate.split("-").reverse().join("/") ||
                  "Não informada"}
              </dd>
            </div>
            <div>
              <dt>Responsável</dt>
              <dd>{order.requester}</dd>
            </div>
          </dl>
        )}
      </section>
      <div className="movement-summary">
        <div>
          <span>Valor total</span>
          <strong>{formatMoney(flow.billTotalCents)}</strong>
        </div>
        <div>
          <span>Previsto para as áreas</span>
          <strong>{formatMoney(totals.targetCents)}</strong>
          <small>{delta(totals.targetDifferenceCents)}</small>
        </div>
        <div>
          <span>Itens distribuídos</span>
          <strong>{formatMoney(totals.totalCents)}</strong>
          <small>{delta(totals.billDifferenceCents)}</small>
        </div>
      </div>
      <section className="movement-panel">
        <h2>Áreas e valores</h2>
        {editable && (
          <>
            <div className="movement-area-options">
              {movementAreaSuggestions.map((name) => (
                <label key={name}>
                  <input
                    className="ui-checkbox"
                    type="checkbox"
                    checked={flow.areas.some((area) => area.name === name)}
                    onChange={(event) => {
                      if (event.target.checked) addArea(name);
                      else {
                        const area = flow.areas.find(
                          (area) => area.name === name,
                        );
                        if (area) removeArea(area);
                      }
                    }}
                  />
                  {name}
                </label>
              ))}
            </div>
            <div className="movement-add-area">
              <label>
                Outra área
                <input
                  aria-label="Outra área"
                  value={newArea}
                  onChange={(event) => {
                    setNewArea(event.target.value);
                    onLocalDirtyChange(true);
                  }}
                />
              </label>
              <button
                className="secondary-button"
                onClick={() => addArea(newArea)}
                disabled={!newArea.trim()}
              >
                <Plus size={16} /> Adicionar área
              </button>
            </div>
          </>
        )}
        <div className="movement-areas">
          {flow.areas.map((area) => (
            <article key={area.id}>
              <header>
                <h3>{area.name}</h3>
                <div className="movement-actions">
                  <button
                    className="icon-button"
                    aria-label={`Imprimir distribuição de ${area.name}`}
                    onClick={() => {
                      try {
                        printMovementArea(order, area.id);
                      } catch (cause) {
                        setLocalError(
                          cause instanceof Error
                            ? cause.message
                            : "Não foi possível imprimir.",
                        );
                      }
                    }}
                  >
                    <Printer size={17} />
                  </button>
                  {editable && (
                    <button
                      className="icon-button"
                      aria-label={`Retirar área ${area.name}`}
                      onClick={() => removeArea(area)}
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>
              </header>
              {editable ? (
                numeric(
                  `target:${area.id}`,
                  area.targetCents,
                  2,
                  `Valor previsto para ${area.name} (R$)`,
                  (targetCents) =>
                    patchFlow({
                      areas: flow.areas.map((candidate) =>
                        candidate.id === area.id
                          ? { ...area, targetCents }
                          : candidate,
                      ),
                    }),
                )
              ) : (
                <p>Previsto: {formatMoney(area.targetCents)}</p>
              )}
              <p>
                Distribuído:{" "}
                <strong>
                  {formatMoney(totals.areaCents.get(area.id) || 0)}
                </strong>
              </p>
              <small
                className={
                  area.targetCents === (totals.areaCents.get(area.id) || 0)
                    ? "movement-matched"
                    : ""
                }
              >
                {delta(area.targetCents - (totals.areaCents.get(area.id) || 0))}
              </small>
            </article>
          ))}
        </div>
        {!flow.areas.length && (
          <p className="muted">
            Selecione as áreas para distribuir os materiais e conferir os
            valores.
          </p>
        )}
      </section>
      <section className="movement-panel">
        <h2>Materiais das DLs e distribuição</h2>
        <p className="movement-note">
          Informe as quantidades de cada área. Unidade, fornecedor e preço vêm
          da origem contratada. Quantidades: até 3 casas decimais. Centavos
          residuais são repartidos entre as áreas para que a soma coincida com o
          total dos itens.
        </p>
        {editable && (
          <>
            <FilterSearch
              label="Buscar material nas DLs"
              value={query}
              onChange={setQuery}
              placeholder="Código ou descrição"
            />
            <div className="movement-source-list">
              {visibleSources.map((row) => {
                const selected = order.lines.some(
                  (line) =>
                    line.originId === row.origin.id &&
                    line.planId === row.plan.id,
                );
                return (
                  <div key={`${row.plan.id}:${row.origin.id}`}>
                    <div>
                      <strong>{row.item?.description}</strong>
                      <small>
                        {row.plan.code} · {row.origin.supplier} ·{" "}
                        {row.item?.code} · Pedido MXM {row.origin.mxmOrder} ·{" "}
                        {formatMoney(row.origin.unitPriceCents)}/
                        {row.origin.unit} · Saldo livre para esta edição:{" "}
                        {decimalInput(row.origin.availableMilli, 3)}{" "}
                        {row.origin.unit}
                      </small>
                    </div>
                    <button
                      className="secondary-button"
                      disabled={selected || !order.supplier}
                      onClick={() =>
                        patch({
                          lines: [...order.lines, originOrderLine(row)],
                        })
                      }
                    >
                      {selected ? "Incluído" : "Adicionar material"}
                    </button>
                  </div>
                );
              })}
              {!selectedPlanIds.length ? (
                <p className="muted">
                  Selecione uma ou mais DLs com saldo acima.
                </p>
              ) : !order.supplier ? (
                <p className="muted">
                  Selecione um fornecedor para incluir os materiais. A
                  distribuição usa um único fornecedor.
                </p>
              ) : selectedSources.length === 0 ? (
                <p className="muted">
                  Não há materiais ativos com saldo disponível para o fornecedor
                  nas DLs selecionadas.
                </p>
              ) : visibleSources.length === 0 ? (
                <p className="muted">
                  Nenhum material corresponde à busca.{" "}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setQuery("")}
                  >
                    Limpar busca
                  </button>
                </p>
              ) : null}
            </div>
          </>
        )}
        <div className="table-wrap movement-table">
          <table>
            <thead>
              <tr>
                <th>Material / origem</th>
                <th>Preço contratado</th>
                {flow.areas.map((area) => (
                  <th key={area.id}>{area.name}</th>
                ))}
                <th>Quantidade total</th>
                <th>Total</th>
                {editable && <th>Ação</th>}
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    {line.description}
                    <small>
                      {line.code} · {line.dlCode} · Pedido MXM {line.mxmOrder}
                    </small>
                  </td>
                  <td>
                    {formatMoney(line.unitPriceCents || 0)} / {line.unit}
                  </td>
                  {flow.areas.map((area) => (
                    <td key={area.id}>
                      {editable ? (
                        numeric(
                          `qty:${area.id}:${line.id}`,
                          allocatedMilli(area, line.id),
                          3,
                          `Quantidade de ${lineTitle(line)} para ${area.name}`,
                          (q) => allocate(area.id, line, q),
                          true,
                        )
                      ) : (
                        <span>
                          {decimalInput(allocatedMilli(area, line.id), 3)}{" "}
                          {line.unit}
                        </span>
                      )}
                      <small>
                        {formatMoney(
                          totals.allocationCents.get(`${area.id}:${line.id}`) ||
                            0,
                        )}
                      </small>
                    </td>
                  ))}
                  <td>
                    {decimalInput(totals.quantities.get(line.id) || 0, 3)}{" "}
                    {line.unit}
                  </td>
                  <td>
                    {formatMoney(
                      [...flow.areas].reduce(
                        (sum, area) =>
                          sum +
                          (totals.allocationCents.get(
                            `${area.id}:${line.id}`,
                          ) || 0),
                        0,
                      ),
                    )}
                  </td>
                  {editable && (
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Retirar material ${lineTitle(line)}`}
                        onClick={() => {
                          if (
                            !window.confirm(
                              "Retirar este material de todas as áreas desta edição?",
                            )
                          )
                            return;
                          patch(
                            {
                              lines: order.lines.filter(
                                (candidate) => candidate.id !== line.id,
                              ),
                            },
                            {
                              ...flow,
                              areas: flow.areas.map((area) => ({
                                ...area,
                                allocations: area.allocations.filter(
                                  (a) => a.lineId !== line.id,
                                ),
                              })),
                            },
                          );
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!order.lines.length && (
                <tr>
                  <td colSpan={5 + flow.areas.length} className="empty-state">
                    Adicione os materiais das DLs para distribuir suas
                    quantidades por área.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      {!editable && (
        <>
          <section className="movement-panel">
            <div className="movement-heading">
              <div>
                <h2>Entrada da NF</h2>
                <p className="movement-note">
                  A confirmação registra a entrada informada e baixa somente
                  suas quantidades no saldo da DL. Entradas parciais mantêm o
                  restante reservado.
                </p>
              </div>
              {flow.phase === "Entrada da NF" && !form && (
                <button
                  className="primary-button"
                  disabled={blocked}
                  onClick={() => start("invoice")}
                >
                  Registrar entrada da NF
                </button>
              )}
            </div>
            {!flow.invoices.length ? (
              <p className="muted">Nenhuma entrada registrada.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>NF</th>
                      <th>Emissão</th>
                      <th>Entrada</th>
                      <th>Valor</th>
                      <th>Itens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flow.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{invoice.number}</td>
                        <td>
                          {invoice.issuedOn.split("-").reverse().join("/")}
                        </td>
                        <td>
                          {invoice.enteredOn.split("-").reverse().join("/")}
                        </td>
                        <td>{formatMoney(invoice.totalCents)}</td>
                        <td>
                          {invoice.lines.map((entry) => {
                            const line = order.lines.find(
                              (line) => line.id === entry.lineId,
                            )!;
                            return (
                              <small key={entry.lineId}>
                                {line.description}:{" "}
                                {decimalInput(entry.quantityMilli, 3)}{" "}
                                {line.unit}
                              </small>
                            );
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="movement-panel">
            <div className="movement-heading">
              <div>
                <h2>Solicitações e atendimento das áreas</h2>
                <p className="movement-note">
                  Liberado após a entrada completa da NF. Registre a referência
                  e as quantidades solicitadas; depois confirme o atendimento,
                  inclusive parcial.
                </p>
              </div>
              {flow.phase === "Solicitações das áreas" && !form && (
                <button
                  className="primary-button"
                  disabled={blocked}
                  onClick={() => start("request")}
                >
                  Registrar solicitação da área
                </button>
              )}
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Área</th>
                    <th>Distribuído</th>
                    <th>Solicitado</th>
                    <th>Atendido</th>
                    <th>Pendente de solicitação</th>
                  </tr>
                </thead>
                <tbody>
                  {flow.areas.flatMap((area) =>
                    order.lines
                      .filter((line) => allocatedMilli(area, line.id) > 0)
                      .map((line) => (
                        <tr key={`${area.id}:${line.id}`}>
                          <td>
                            {area.name}
                            <small>{line.description}</small>
                          </td>
                          <td>
                            {decimalInput(allocatedMilli(area, line.id), 3)}{" "}
                            {line.unit}
                          </td>
                          <td>
                            {decimalInput(
                              areaRequestedMilli(flow, area.id, line.id),
                              3,
                            )}
                          </td>
                          <td>
                            {decimalInput(
                              areaRequestedMilli(flow, area.id, line.id, true),
                              3,
                            )}
                          </td>
                          <td>
                            {decimalInput(
                              allocatedMilli(area, line.id) -
                                areaRequestedMilli(flow, area.id, line.id),
                              3,
                            )}
                          </td>
                        </tr>
                      )),
                  )}
                </tbody>
              </table>
            </div>
            {flow.requests.map((request) => (
              <article className="movement-request" key={request.id}>
                <div>
                  <strong>
                    {request.reference} ·{" "}
                    {
                      flow.areas.find((area) => area.id === request.areaId)
                        ?.name
                    }
                  </strong>
                  <p>
                    {requestStatus(request)} ·{" "}
                    {request.requestedOn.split("-").reverse().join("/")}
                  </p>
                  {request.lines.map((entry) => {
                    const line = order.lines.find(
                      (line) => line.id === entry.lineId,
                    )!;
                    return (
                      <small key={entry.lineId}>
                        {line.description}: {decimalInput(entry.servedMilli, 3)}{" "}
                        de {decimalInput(entry.quantityMilli, 3)} {line.unit}{" "}
                        atendidos
                      </small>
                    );
                  })}
                </div>
                {!closed && requestStatus(request) !== "Atendida" && !form && (
                  <button
                    className="secondary-button"
                    onClick={() => start("serve", request.id)}
                  >
                    Registrar atendimento de {request.reference}
                  </button>
                )}
              </article>
            ))}
          </section>
        </>
      )}
      {form && (
        <section
          className="movement-panel movement-entry"
          ref={formRef}
          tabIndex={-1}
          aria-labelledby="movement-entry-title"
        >
          <h2 id="movement-entry-title">
            {form === "invoice"
              ? "Registrar entrada da NF"
              : form === "request"
                ? "Registrar solicitação da área"
                : form === "serve"
                  ? `Atender ${selectedRequest?.reference}`
                  : "Cancelar distribuição"}
          </h2>
          <div className="movement-fields">
            <label>
              Responsável pelo registro
              <input
                aria-label="Responsável pelo registro"
                value={actor}
                onChange={(event) => {
                  setActor(event.target.value);
                  onLocalDirtyChange(true);
                }}
              />
            </label>
            {form !== "serve" && form !== "cancel" && (
              <>
                <label>
                  {form === "invoice"
                    ? "Número da NF"
                    : "Referência da solicitação"}
                  <input
                    aria-label={
                      form === "invoice"
                        ? "Número da NF"
                        : "Referência da solicitação"
                    }
                    value={number}
                    onChange={(event) => {
                      setNumber(event.target.value);
                      onLocalDirtyChange(true);
                    }}
                  />
                </label>
                <label>
                  {form === "invoice" ? "Emissão da NF" : "Data da solicitação"}
                  <input
                    aria-label={
                      form === "invoice"
                        ? "Emissão da NF"
                        : "Data da solicitação"
                    }
                    type="date"
                    max={context.today}
                    value={issuedOn}
                    onChange={(event) => {
                      setIssuedOn(event.target.value);
                      onLocalDirtyChange(true);
                    }}
                  />
                </label>
              </>
            )}
            {form === "invoice" && (
              <>
                <label>
                  Data da entrada
                  <input
                    aria-label="Data da entrada"
                    type="date"
                    max={context.today}
                    value={enteredOn}
                    onChange={(event) => {
                      setEnteredOn(event.target.value);
                      onLocalDirtyChange(true);
                    }}
                  />
                </label>
                <label>
                  Valor da NF (R$)
                  <DLMoneyInput
                    label="Valor da NF (R$)"
                    disabled={false}
                    value={invoiceAmount}
                    onChange={(value) => {
                      setInvoiceAmount(value);
                      onLocalDirtyChange(true);
                    }}
                  />
                </label>
              </>
            )}
            {form === "request" && (
              <FilterSelect
                label="Área solicitante"
                value={areaId}
                options={flow.areas.map((area) => ({
                  value: area.id,
                  label: area.name,
                }))}
                onChange={(value) => {
                  setAreaId(value);
                  setEntryQuantities({});
                  onLocalDirtyChange(true);
                }}
              />
            )}
            {form === "cancel" && (
              <label>
                Motivo do cancelamento
                <textarea
                  aria-label="Motivo do cancelamento"
                  value={cancelReason}
                  onChange={(event) => {
                    setCancelReason(event.target.value);
                    onLocalDirtyChange(true);
                  }}
                />
              </label>
            )}
          </div>
          {form !== "cancel" && (
            <>
              <button
                className="text-button"
                onClick={() => {
                  const q = Object.fromEntries(
                    formLines.map((line) => [line.id, pending(line)]),
                  );
                  setEntryQuantities(
                    Object.fromEntries(
                      Object.entries(q).map(([id, n]) => [
                        id,
                        decimalInput(n, 3),
                      ]),
                    ),
                  );
                  if (form === "invoice")
                    setInvoiceAmount(
                      decimalInput(movementInvoiceCents(order, q), 2),
                    );
                  onLocalDirtyChange(true);
                }}
              >
                Preencher quantidades pendentes
              </button>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Pendente</th>
                      <th>
                        Quantidade desta{" "}
                        {form === "request"
                          ? "solicitação"
                          : "entrada / entrega"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {formLines.map((line) => (
                      <tr key={line.id}>
                        <td>
                          {line.description}
                          <small>{line.code}</small>
                        </td>
                        <td>
                          {decimalInput(pending(line), 3)} {line.unit}
                        </td>
                        <td>
                          <input
                            aria-label={`Quantidade de ${lineTitle(line)} nesta operação`}
                            inputMode="decimal"
                            value={entryQuantities[line.id] || ""}
                            onChange={(event) => {
                              setEntryQuantities({
                                ...entryQuantities,
                                [line.id]: event.target.value,
                              });
                              onLocalDirtyChange(true);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {form === "invoice" && (
            <p className="movement-note" role="status">
              {invoicePreviewError || (
                <>
                  Calculado pelos itens desta entrada:{" "}
                  <strong>{formatMoney(invoicePreview || 0)}</strong>.{" "}
                  {invoiceDifference === null
                    ? "Informe o valor da NF para conferir."
                    : invoiceDifference === 0
                      ? "Valor informado da NF confere."
                      : `Diferença do valor informado: ${formatMoney(invoiceDifference)}.`}
                </>
              )}
            </p>
          )}
          <div className="movement-actions">
            <button className="secondary-button" onClick={closeForm}>
              Fechar conferência
            </button>
            <button
              className="primary-button"
              disabled={blocked}
              onClick={register}
            >
              {form === "cancel"
                ? "Confirmar cancelamento"
                : "Confirmar registro"}
            </button>
          </div>
        </section>
      )}
      {!editable && !closed && !form && (
        <footer className="movement-actions">
          {flow.phase === "Solicitações das áreas" && (
            <button
              className="primary-button"
              disabled={blocked || !complete}
              onClick={() => {
                if (
                  !window.confirm(
                    "Finalizar o fluxo? A distribuição, a entrada da NF e o atendimento de todas as áreas serão encerrados.",
                  )
                )
                  return;
                onCommit(
                  (ws) => finishMovement(ws, order.id, order.requester),
                  "Fluxo concluído.",
                );
              }}
            >
              Finalizar fluxo
            </button>
          )}
          {!flow.invoices.length && (
            <button
              className="secondary-button"
              disabled={blocked}
              onClick={() => start("cancel")}
            >
              Cancelar distribuição
            </button>
          )}
        </footer>
      )}
      {order.events.length > 0 && (
        <section className="movement-panel">
          <h2>Histórico</h2>
          {[...order.events].reverse().map((event) => (
            <article className="movement-history" key={event.id}>
              <strong>{event.action}</strong>
              <small>
                {event.actor} ·{" "}
                {new Date(event.timestamp).toLocaleString("pt-BR")}
              </small>
              <p>{event.details}</p>
              {event.quantities?.map((entry) => {
                const line = order.lines.find(
                  (line) => line.id === entry.lineId,
                );
                return (
                  <small key={entry.lineId}>
                    {line?.description}: {decimalInput(entry.quantityMilli, 3)}{" "}
                    {line?.unit}
                  </small>
                );
              })}
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
