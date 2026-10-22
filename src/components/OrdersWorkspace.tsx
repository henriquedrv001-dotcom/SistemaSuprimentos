import DLMovementWorkspace from "./DLMovementWorkspace";
import {
  newMovementOrder,
  saveMovementDraft,
  confirmMovementDistribution,
} from "../services/dlMovement";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import type {
  Order,
  OrderKind,
  OrderLine,
  OrderWorkspace,
} from "../types/orders";
import { orderKinds, orderStatuses } from "../types/orders";
import {
  orderKindNames,
  newOrder,
  itemOrderLine,
  originOrderLine,
  orderTotal,
  orderControlRows,
  saveOrderDraft,
  transitionOrder,
  removeOrderDraft,
} from "../services/orders";
import type { OrderContext, OrderAction } from "../services/orders";
import {
  decimalInput,
  formatMoney,
  parseScaledInput,
} from "../services/dlPlanning";
import { DEFAULT_DL_REQUESTER } from "../config/uiDefaults";
import FilterSearch from "./ui/FilterSearch";
import FilterSelect from "./ui/FilterSelect";
import SegmentedControl from "./ui/SegmentedControl";
import "./DLOrders.css";
import "./OrdersWorkspace.css";

type Props = {
  initialOrderId?: string;
  kind?: OrderKind;
  allowCreate?: boolean;
  workspace: OrderWorkspace;
  context: OrderContext;
  error: string;
  onCommit: (
    change: (current: OrderWorkspace, context: OrderContext) => OrderWorkspace,
  ) => void;
  onDirtyChange: (dirty: boolean) => void;
};
const date = (value: string) =>
  value ? value.slice(0, 10).split("-").reverse().join("/") : "A definir";
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
const label = (order: Order) =>
  order.code || `Rascunho · ${order.id.slice(0, 8)}`;
function receiptCheck(line: OrderLine, input: string | undefined) {
  if (!input?.trim()) return "Não informado";
  try {
    const value = parseScaledInput(input, 3, "Recebimento") || 0;
    const pending =
      line.quantityMilli - line.receivedMilli - line.unfulfilledMilli;
    return value > pending
      ? "Acima do pendente"
      : value === 0
        ? "Não veio"
        : value === pending
          ? "Integral"
          : "Parcial";
  } catch {
    return "Revisar quantidade";
  }
}
const actionTitles: Record<OrderAction, string> = {
  submit: "Encaminhar para análise",
  approve: "Aprovar pedido",
  return: "Devolver para correção",
  send: "Registrar envio",
  receive: "Registrar recebimento",
  cancel: "Cancelar pedido",
};
const actionFeedback: Record<OrderAction, string> = {
  submit: "Pedido encaminhado para análise.",
  approve: "Aprovação registrada.",
  return: "Pedido devolvido para correção.",
  send: "Envio registrado.",
  receive: "Recebimento registrado.",
  cancel: "Pedido cancelado. Recebimentos anteriores foram preservados.",
};

export default function OrdersWorkspace({
  initialOrderId,
  allowCreate = false,
  kind,
  workspace,
  context,
  error: storageError,
  onCommit,
  onDirtyChange,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(
    initialOrderId || null,
  );
  const [movementInputDirty, setMovementInputDirty] = useState(false);
  const [choosingType, setChoosingType] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [baseline, setBaseline] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [supplier, setSupplier] = useState("");
  const [cycle, setCycle] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState("all");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerSupplier, setPickerSupplier] = useState("");
  const [pickerGroup, setPickerGroup] = useState("");
  const [pickerPlan, setPickerPlan] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<OrderAction | null>(null);
  const active = workspace.orders.find((order) => order.id === activeId);
  const dirty =
    movementInputDirty ||
    (!!editing &&
      (JSON.stringify(editing) !== baseline ||
        (!editing.movementFlow &&
          editing.lines.some(
            (line) =>
              quantities[line.id] !== decimalInput(line.quantityMilli, 3) ||
              prices[line.id] !== decimalInput(line.unitPriceCents, 2),
          ))));
  useEffect(() => {
    onDirtyChange(dirty);
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    if (dirty) window.addEventListener("beforeunload", prevent);
    return () => {
      onDirtyChange(false);
      window.removeEventListener("beforeunload", prevent);
    };
  }, [dirty, onDirtyChange]);
  function begin(order?: Order, creationKind?: OrderKind) {
    const next = structuredClone(
      order ||
        ((creationKind || kind) === "MOV"
          ? newMovementOrder(DEFAULT_DL_REQUESTER)
          : newOrder(creationKind || kind || "PCD", DEFAULT_DL_REQUESTER)),
    );
    setMovementInputDirty(false);
    setEditing(next);
    setBaseline(JSON.stringify(next));
    setActiveId(next.id);
    setPicker(!order);
    setError("");
    setMessage("");
    setQuantities(
      Object.fromEntries(
        next.lines.map((line) => [
          line.id,
          decimalInput(line.quantityMilli, 3),
        ]),
      ),
    );
    setPrices(
      Object.fromEntries(
        next.lines.map((line) => [
          line.id,
          decimalInput(line.unitPriceCents, 2),
        ]),
      ),
    );
    setPickerQuery("");
    setPickerGroup("");
    setPickerPlan("");
    setPickerSupplier("");
    setPage(1);
  }
  function back() {
    if (
      dirty &&
      !window.confirm("Descartar as alterações não salvas deste pedido?")
    )
      return;
    setMovementInputDirty(false);
    setEditing(null);
    setActiveId(null);
    setPicker(false);
    setError("");
    setMessage("");
  }
  function commit(change: Parameters<Props["onCommit"]>[0], feedback: string) {
    try {
      onCommit(change);
      setError("");
      setMessage(feedback);
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível registrar a alteração.",
      );
      return false;
    }
  }
  function save() {
    if (!editing) return;
    try {
      const next = {
        ...editing,
        lines: editing.lines.map((line) => ({
          ...line,
          quantityMilli:
            parseScaledInput(
              quantities[line.id] || "",
              3,
              `Quantidade de ${line.description}`,
            ) || 0,
          unitPriceCents:
            editing.kind === "PDL"
              ? line.unitPriceCents
              : parseScaledInput(
                  prices[line.id] || "",
                  2,
                  `Preço de ${line.description}`,
                ),
        })),
      };
      if (
        commit(
          (current, context) => saveOrderDraft(current, next, context),
          next.kind === "PDL"
            ? "PDL salvo. Materiais reservados até o recebimento."
            : "Rascunho salvo.",
        )
      ) {
        setEditing(null);
        setPicker(false);
        setActiveId(next.id);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Confira as quantidades e os preços.",
      );
    }
  }
  function toggle(line: OrderLine) {
    if (!editing) return;
    const same = (candidate: OrderLine) =>
      editing.kind === "PDL"
        ? candidate.planId === line.planId &&
          candidate.originId === line.originId
        : candidate.itemId === line.itemId;
    const exists = editing.lines.some(same);
    setEditing({
      ...editing,
      lines: exists
        ? editing.lines.filter((candidate) => !same(candidate))
        : [...editing.lines, line],
    });
    if (!exists) {
      setQuantities((previous) => ({ ...previous, [line.id]: "" }));
      setPrices((previous) => ({
        ...previous,
        [line.id]: decimalInput(line.unitPriceCents, 2),
      }));
    }
    setError("");
  }
  const rows = useMemo(
    () => orderControlRows(context, workspace, editing?.id || ""),
    [context, workspace, editing?.id],
  );
  const sources: OrderLine[] = useMemo(
    () =>
      editing?.kind === "PDL"
        ? rows
            .filter((row) => row.item?.active && row.origin.availableMilli > 0)
            .map(originOrderLine)
        : context.items
            .filter(
              (item) =>
                item.active &&
                (editing?.kind !== "PCD" ||
                  context.cycleWorkspace.lines.some(
                    (line) =>
                      line.cycleId === editing.cycleId &&
                      line.itemId === item.id,
                  )),
            )
            .map(itemOrderLine),
    [
      rows,
      context.items,
      context.cycleWorkspace,
      editing?.kind,
      editing?.cycleId,
    ],
  );
  // Source identity is independent of freshly generated candidate line ids.
  const candidates = sources.filter(
    (line) =>
      (!pickerPlan || line.planId === pickerPlan) &&
      (!pickerSupplier || line.supplier === pickerSupplier) &&
      (!pickerGroup ||
        context.items.find((item) => item.id === line.itemId)?.group ===
          pickerGroup) &&
      (!pickerQuery ||
        fold(
          `${line.code} ${line.description} ${line.dlCode} ${line.supplier} ${line.mxmOrder}`,
        ).includes(fold(pickerQuery))),
  );
  const pages = Math.max(1, Math.ceil(candidates.length / 30));
  const currentPage = Math.min(page, pages);
  const groups = [
    ...new Set(
      sources
        .map(
          (line) =>
            context.items.find((item) => item.id === line.itemId)?.group,
        )
        .filter((value): value is string => !!value),
    ),
  ].sort();
  const suppliers = [
    ...new Set(
      workspace.orders
        .flatMap((order) => [
          order.supplier,
          ...order.lines.map((line) => line.supplier),
        ])
        .filter(Boolean),
    ),
  ].sort();
  const baseOrders = workspace.orders.filter(
    (order) => !kind || order.kind === kind,
  );
  const sourcePlans = context.plans.filter(
    (plan) => plan.stage === "Concluído" && plan.contract?.release,
  );
  const overdue = (order: Order) =>
    !!order.expectedDelivery &&
    order.expectedDelivery < context.today &&
    ["Enviado", "Recebimento parcial"].includes(order.status);
  const matches = baseOrders
    .filter(
      (order) =>
        (!type || order.kind === type) &&
        (!planFilter ||
          order.lines.some((line) => line.planId === planFilter)) &&
        (!status || order.status === status) &&
        (!cycle || order.cycleId === cycle) &&
        (!supplier ||
          order.supplier === supplier ||
          order.lines.some((line) => line.supplier === supplier)) &&
        (view === "all" ||
          (view === "late"
            ? overdue(order)
            : view === "partial"
              ? order.status === "Recebimento parcial"
              : view === "done"
                ? order.status === "Concluído"
                : !["Concluído", "Cancelado"].includes(order.status))) &&
        (!query ||
          fold(
            `${order.code} ${order.requester} ${order.externalReference} ${order.contractReference} ${order.supplier} ${order.lines.map((line) => `${line.description} ${line.code} ${line.dlCode} ${line.mxmOrder} ${line.supplier}`).join(" ")}`,
          ).includes(fold(query))),
    )
    .sort((a, b) =>
      sort === "old"
        ? a.createdAt.localeCompare(b.createdAt)
        : sort === "delivery"
          ? (a.expectedDelivery || "9999").localeCompare(
              b.expectedDelivery || "9999",
            )
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const shown = editing || active;
  const preview = editing
    ? {
        ...editing,
        lines: editing.lines.map((line) => {
          try {
            return {
              ...line,
              quantityMilli:
                parseScaledInput(quantities[line.id] || "", 3, "Quantidade") ||
                0,
              unitPriceCents:
                editing.kind === "PDL"
                  ? line.unitPriceCents
                  : parseScaledInput(prices[line.id] || "", 2, "Preço"),
            };
          } catch {
            return { ...line, quantityMilli: 0, unitPriceCents: null };
          }
        }),
      }
    : shown;
  const total = preview ? orderTotal(preview) : null;
  const invalidPreview = editing?.lines.some((line) => {
    try {
      parseScaledInput(quantities[line.id] || "", 3, "Quantidade");
      if (editing.kind !== "PDL")
        parseScaledInput(prices[line.id] || "", 2, "Preço");
      return false;
    } catch {
      return true;
    }
  });
  const totalLabel =
    invalidPreview || total?.cents === null
      ? "Revisar valor"
      : total
        ? formatMoney(total.cents)
        : "—";
  if (shown?.movementFlow)
    return (
      <DLMovementWorkspace
        key={`${shown.id}:${editing ? "edit" : "view"}`}
        order={shown}
        editable={!!editing}
        workspace={workspace}
        context={context}
        error={storageError || error}
        blocked={!!storageError}
        message={message}
        onChange={setEditing}
        onLocalDirtyChange={setMovementInputDirty}
        onBack={back}
        onEdit={() => begin(active)}
        onCommit={commit}
        onSave={(confirm) => {
          if (!editing) return;
          if (
            commit(
              (current, ctx) => {
                const next = saveMovementDraft(current, editing, ctx);
                return confirm
                  ? confirmMovementDistribution(
                      next,
                      editing.id,
                      editing.requester,
                      ctx,
                    )
                  : next;
              },
              confirm
                ? "Distribuição confirmada. Aguardando entrada da NF."
                : "Distribuição salva. Quantidades reservadas na DL.",
            )
          ) {
            setMovementInputDirty(false);
            setEditing(null);
            setActiveId(editing.id);
          }
        }}
      />
    );
  const Heading = allowCreate && !shown ? "h1" : "h2";
  return (
    <section
      className="dl-orders order-workspace"
      aria-labelledby="orders-workspace-title"
    >
      <header className="dl-orders-heading">
        <div>
          <Heading id="orders-workspace-title">
            {editing
              ? `Preparar solicitação · ${orderKindNames[editing.kind]}`
              : active
                ? label(active)
                : kind
                  ? orderKindNames[kind]
                  : allowCreate
                    ? "Pedidos"
                    : "Acompanhamento de pedidos"}
          </Heading>
          <p className="muted">
            {shown
              ? orderKindNames[shown.kind]
              : "Pedidos registrados neste navegador, com acompanhamento por etapa."}
          </p>
        </div>
        <div className="dl-orders-actions">
          {shown ? (
            <>
              <button className="secondary-button" onClick={back}>
                <ArrowLeft size={16} /> Voltar
              </button>
              {editing ? (
                <button
                  className="primary-button"
                  disabled={!!storageError}
                  onClick={save}
                >
                  <Save size={16} /> Salvar rascunho
                </button>
              ) : (
                active?.status === "Rascunho" &&
                active.kind !== "MOV" && (
                  <button
                    className="primary-button"
                    disabled={!!storageError}
                    onClick={() => begin(active)}
                  >
                    Editar rascunho
                  </button>
                )
              )}
            </>
          ) : (
            <>
              {(kind || allowCreate) && (
                <button
                  className="primary-button"
                  disabled={!!storageError}
                  onClick={() => setChoosingType(true)}
                >
                  <Plus size={16} /> Novo pedido
                </button>
              )}
            </>
          )}
        </div>
      </header>
      {(storageError || error) && (
        <p className="notice" role="alert">
          {storageError || error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <p className="order-local-note">
        Registro local. Aprovações, envios e recebimentos são informados pelo
        usuário; o sistema não transmite pedidos ao MXM nem ao fornecedor.
      </p>
      {(shown?.kind === "PDL" || kind === "PDL") && (
        <p className="order-local-note">
          Salvar o PDL reserva seus materiais. Receber baixa apenas o que
          chegou; o restante fica reservado até receber ou encerrar a entrega.
        </p>
      )}
      {active?.kind === "MOV" && !active.movementFlow && (
        <p className="notice">
          Registro anterior ao fluxo por áreas, preservado com seus dados
          originais. Para uma nova distribuição com saldo de DL, use Novo pedido
          → DL PARA ENTRADA E SAÍDA.
        </p>
      )}
      {active?.kind === "PDL" && !active.reservationActivated && (
        <p className="notice">
          Rascunho anterior à reserva automática. Edite e salve para conferir o
          saldo e reservar os materiais.
        </p>
      )}
      {!shown ? (
        <>
          <div className="dl-orders-metrics">
            <div>
              <span>Em preparação / análise</span>
              <strong>
                {
                  baseOrders.filter((order) =>
                    ["Rascunho", "Em análise"].includes(order.status),
                  ).length
                }
              </strong>
            </div>
            <div>
              <span>Aprovados / em entrega</span>
              <strong>
                {
                  baseOrders.filter((order) =>
                    ["Aprovado", "Enviado", "Recebimento parcial"].includes(
                      order.status,
                    ),
                  ).length
                }
              </strong>
            </div>
            <div>
              <span>Entregas atrasadas</span>
              <strong>{baseOrders.filter(overdue).length}</strong>
            </div>
          </div>
          <div className="orders-views">
            <SegmentedControl
              label="Situação do acompanhamento"
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: "Todos" },
                { value: "open", label: "Em aberto" },
                { value: "partial", label: "Parciais" },
                { value: "late", label: "Atrasados" },
                { value: "done", label: "Concluídos" },
              ]}
            />
          </div>
          <div
            className={`ui-filterbar order-list-filters${!kind || kind === "PDL" ? " order-list-six-filters" : ""}`}
          >
            <FilterSearch
              label="Buscar"
              placeholder="Pedido, item, DL, fornecedor ou MXM"
              value={query}
              onChange={setQuery}
            />
            <FilterSelect
              label="Situação"
              value={status}
              onChange={setStatus}
              options={[
                { value: "", label: "Todas" },
                ...orderStatuses.map((value) => ({ value, label: value })),
              ]}
            />
            <FilterSelect
              label="Fornecedor"
              value={supplier}
              onChange={setSupplier}
              options={[
                { value: "", label: "Todos" },
                ...suppliers.map((value) => ({ value, label: value })),
              ]}
            />
            <FilterSelect
              label="Ciclo"
              value={cycle}
              onChange={setCycle}
              options={[
                { value: "", label: "Todos" },
                ...context.cycles.map((cycle) => ({
                  value: cycle.id,
                  label: cycle.name,
                })),
              ]}
            />
            {(kind === "PDL" || type === "PDL") && (
              <FilterSelect
                label="DL"
                value={planFilter}
                onChange={setPlanFilter}
                options={[
                  { value: "", label: "Todas as DLs" },
                  ...sourcePlans.map((plan) => ({
                    value: plan.id,
                    label: `${plan.code} · ${plan.title}`,
                  })),
                ]}
              />
            )}
            {!kind && (
              <FilterSelect
                label="Tipo"
                value={type}
                onChange={setType}
                options={[
                  { value: "", label: "Todos" },
                  ...orderKinds.map((value) => ({
                    value,
                    label: orderKindNames[value],
                  })),
                ]}
              />
            )}
            <FilterSelect
              label="Ordenar"
              value={sort}
              onChange={setSort}
              options={[
                { value: "recent", label: "Atualizados recentemente" },
                { value: "old", label: "Mais antigos" },
                { value: "delivery", label: "Entrega prevista" },
              ]}
            />
          </div>
          <div className="orders-list-count">
            <span>
              {matches.length} de {baseOrders.length} pedidos
            </span>
            {(query ||
              status ||
              supplier ||
              cycle ||
              planFilter ||
              type ||
              view !== "all") && (
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setStatus("");
                  setSupplier("");
                  setCycle("");
                  setPlanFilter("");
                  setType("");
                  setView("all");
                }}
              >
                Limpar filtros
              </button>
            )}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pedido / tipo</th>
                  <th>Fornecedor / origem</th>
                  <th>Ciclo</th>
                  <th>Itens</th>
                  <th>Total previsto</th>
                  <th>Entrega prevista</th>
                  <th>Situação</th>
                  <th>Abrir</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((order) => {
                  const amount = orderTotal(order);
                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>{label(order)}</strong>
                        <small>{orderKindNames[order.kind]}</small>
                      </td>
                      <td>
                        {order.supplier ||
                          [
                            ...new Set(
                              order.lines
                                .map((line) => line.supplier)
                                .filter(Boolean),
                            ),
                          ].join(", ") ||
                          "A definir"}
                        <small>
                          {[
                            ...new Set(
                              order.lines
                                .map((line) => line.dlCode)
                                .filter(Boolean),
                            ),
                          ].join(", ") ||
                            order.contractReference ||
                            (order.kind === "PCD"
                              ? order.externalReference
                              : "") ||
                            "—"}
                        </small>
                      </td>
                      <td>
                        {context.cycles.find(
                          (cycle) => cycle.id === order.cycleId,
                        )?.name || "Sem vínculo"}
                      </td>
                      <td>{order.lines.length}</td>
                      <td>
                        {amount.cents === null
                          ? "Revisar valor"
                          : formatMoney(amount.cents)}
                        {amount.pending > 0 && (
                          <small>
                            Parcial · {amount.pending} itens a completar
                          </small>
                        )}
                      </td>
                      <td>
                        {date(order.expectedDelivery)}
                        {overdue(order) && (
                          <small className="order-overdue">Atrasado</small>
                        )}
                      </td>
                      <td>
                        <span
                          className={`tag ${order.status === "Concluído" ? "tag-green" : order.status === "Recebimento parcial" ? "tag-amber" : "tag-neutral"}`}
                        >
                          {order.movementFlow?.phase || order.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => {
                            setActiveId(order.id);
                            setError("");
                            setMessage("");
                          }}
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!matches.length && (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      {baseOrders.length
                        ? "Nenhum pedido corresponde aos filtros."
                        : "Nenhum pedido registrado nesta área."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {!editing && active && (
            <>
              <div className="order-status-bar">
                <span className="tag tag-neutral">{active.status}</span>
                <div className="dl-orders-actions">
                  {active.status === "Rascunho" && active.kind !== "MOV" && (
                    <button
                      className="primary-button"
                      disabled={!!storageError}
                      onClick={() => setAction("submit")}
                    >
                      Encaminhar para análise
                    </button>
                  )}
                  {active.status === "Em análise" && (
                    <button
                      className="primary-button"
                      disabled={!!storageError}
                      onClick={() => setAction("approve")}
                    >
                      Aprovar pedido
                    </button>
                  )}
                  {["Em análise", "Aprovado"].includes(active.status) && (
                    <button
                      className="secondary-button"
                      disabled={!!storageError}
                      onClick={() => setAction("return")}
                    >
                      Devolver para correção
                    </button>
                  )}
                  {active.status === "Aprovado" && (
                    <button
                      className="primary-button"
                      disabled={!!storageError}
                      onClick={() => setAction("send")}
                    >
                      Registrar envio
                    </button>
                  )}
                  {["Enviado", "Recebimento parcial"].includes(
                    active.status,
                  ) && (
                    <button
                      className="primary-button"
                      disabled={!!storageError}
                      onClick={() => setAction("receive")}
                    >
                      {active.kind === "MOV" && active.movement === "Saída"
                        ? "Registrar atendimento"
                        : "Registrar recebimento"}
                    </button>
                  )}
                  {!["Concluído", "Cancelado"].includes(active.status) && (
                    <button
                      className="secondary-button"
                      disabled={!!storageError}
                      onClick={() => setAction("cancel")}
                    >
                      Cancelar pedido
                    </button>
                  )}
                  {active.status === "Rascunho" && !active.code && (
                    <button
                      className="icon-button"
                      disabled={!!storageError}
                      aria-label="Excluir rascunho"
                      onClick={() => {
                        if (window.confirm("Excluir este rascunho?"))
                          if (
                            commit(
                              (current) => removeOrderDraft(current, active.id),
                              "Rascunho excluído.",
                            )
                          )
                            setActiveId(null);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <dl className="order-facts">
                <div>
                  <dt>Solicitante</dt>
                  <dd>{active.requester}</dd>
                </div>
                {active.kind !== "MOV" && (
                  <div>
                    <dt>Ciclo</dt>
                    <dd>
                      {context.cycles.find(
                        (cycle) => cycle.id === active.cycleId,
                      )?.name || "Sem vínculo"}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Entrega prevista</dt>
                  <dd>{date(active.expectedDelivery)}</dd>
                </div>
                <div>
                  <dt>Fornecedor</dt>
                  <dd>
                    {active.supplier ||
                      [
                        ...new Set(
                          active.lines
                            .map((line) => line.supplier)
                            .filter(Boolean),
                        ),
                      ].join(", ") ||
                      "A definir"}
                  </dd>
                </div>
                {active.kind === "PCD" && (
                  <div>
                    <dt>Requisição MXM</dt>
                    <dd>{active.externalReference || "Não informada"}</dd>
                  </div>
                )}
                {active.kind === "ATA" && (
                  <div>
                    <dt>Ata / contrato</dt>
                    <dd>{active.contractReference}</dd>
                  </div>
                )}
                {active.kind === "MOV" && (
                  <div>
                    <dt>Movimento</dt>
                    <dd>{active.movement}</dd>
                  </div>
                )}
                {active.reason && (
                  <div>
                    <dt>Justificativa</dt>
                    <dd>{active.reason}</dd>
                  </div>
                )}
              </dl>
            </>
          )}
          {editing && (
            <div className="dl-orders-fields">
              <label>
                Solicitante
                <input
                  aria-label="Solicitante"
                  value={editing.requester}
                  onChange={(event) =>
                    setEditing({ ...editing, requester: event.target.value })
                  }
                />
              </label>
              {editing.kind !== "MOV" && (
                <FilterSelect
                  label={
                    editing.kind === "PCD"
                      ? "Ciclo de suprimentos"
                      : "Ciclo (opcional)"
                  }
                  value={editing.cycleId}
                  onChange={(cycleId) => {
                    if (
                      editing.kind === "PCD" &&
                      editing.lines.length &&
                      !window.confirm(
                        "Mudar de ciclo remove os materiais selecionados deste rascunho. Continuar?",
                      )
                    )
                      return;
                    setEditing({
                      ...editing,
                      cycleId,
                      lines: editing.kind === "PCD" ? [] : editing.lines,
                    });
                  }}
                  options={[
                    { value: "", label: "Selecionar ciclo" },
                    ...context.cycles.map((cycle) => ({
                      value: cycle.id,
                      label: cycle.name,
                    })),
                  ]}
                />
              )}
              <label>
                Entrega prevista
                <input
                  aria-label="Entrega prevista"
                  type="date"
                  value={editing.expectedDelivery}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      expectedDelivery: event.target.value,
                    })
                  }
                />
              </label>
              {editing.kind !== "PDL" && (
                <label>
                  Fornecedor / unidade de atendimento
                  <input
                    aria-label="Fornecedor / unidade de atendimento"
                    value={editing.supplier}
                    onChange={(event) =>
                      setEditing({ ...editing, supplier: event.target.value })
                    }
                  />
                </label>
              )}
              {editing.kind === "PCD" &&
                workspace.orders.some(
                  (order) => order.id === editing.id && order.lines.length > 0,
                ) && (
                  <label>
                    Requisição MXM
                    <input
                      aria-label="Requisição MXM"
                      value={editing.externalReference}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          externalReference: event.target.value,
                        })
                      }
                    />
                  </label>
                )}
              {editing.kind === "ATA" && (
                <label>
                  Ata / contrato
                  <input
                    aria-label="Ata / contrato"
                    value={editing.contractReference}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        contractReference: event.target.value,
                      })
                    }
                  />
                </label>
              )}
              {editing.kind === "MOV" && (
                <FilterSelect
                  label="Tipo de movimento"
                  value={editing.movement}
                  onChange={(movement) =>
                    setEditing({
                      ...editing,
                      movement: movement as Order["movement"],
                    })
                  }
                  options={[
                    { value: "", label: "Selecionar" },
                    { value: "Entrada", label: "Entrada" },
                    { value: "Saída", label: "Saída" },
                  ]}
                />
              )}
              <label className="dl-orders-notes">
                {editing.kind === "PFR"
                  ? "Justificativa do pedido FR"
                  : "Justificativa (opcional)"}
                <textarea
                  aria-label="Justificativa"
                  rows={2}
                  value={editing.reason}
                  onChange={(event) =>
                    setEditing({ ...editing, reason: event.target.value })
                  }
                />
              </label>
            </div>
          )}
          <div className="dl-orders-heading">
            <div>
              <h3>Materiais do pedido</h3>
              <span className="muted">
                {shown.lines.length}{" "}
                {shown.lines.length === 1 ? "item" : "itens"}
              </span>
            </div>
            {editing && (
              <button
                className="secondary-button"
                onClick={() => setPicker((value) => !value)}
              >
                {picker ? "Concluir seleção" : "Adicionar materiais"}
              </button>
            )}
          </div>
          {editing && picker && (
            <section
              className="dl-orders-picker"
              aria-label="Selecionar materiais do pedido"
            >
              <div className="ui-filterbar order-picker-filters">
                <FilterSearch
                  label="Buscar material"
                  placeholder="Código, descrição, DL ou MXM"
                  value={pickerQuery}
                  onChange={(value) => {
                    setPickerQuery(value);
                    setPage(1);
                  }}
                />
                <FilterSelect
                  label="Grupo"
                  value={pickerGroup}
                  onChange={(value) => {
                    setPickerGroup(value);
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "Todos" },
                    ...groups.map((value) => ({ value, label: value })),
                  ]}
                />
                {editing.kind === "PDL" && (
                  <FilterSelect
                    label="DL de origem"
                    value={pickerPlan}
                    onChange={(value) => {
                      setPickerPlan(value);
                      setPage(1);
                    }}
                    options={[
                      { value: "", label: "Todas as DLs" },
                      ...sourcePlans.map((plan) => ({
                        value: plan.id,
                        label: `${plan.code} · ${plan.title}`,
                      })),
                    ]}
                  />
                )}
                {editing.kind === "PDL" && (
                  <FilterSelect
                    label="Fornecedor da origem"
                    value={pickerSupplier}
                    onChange={(value) => {
                      setPickerSupplier(value);
                      setPage(1);
                    }}
                    options={[
                      { value: "", label: "Todos" },
                      ...[...new Set(sources.map((line) => line.supplier))]
                        .sort()
                        .map((value) => ({ value, label: value })),
                    ]}
                  />
                )}
              </div>
              {editing.kind === "PCD" && !editing.cycleId && (
                <p className="notice">
                  Selecione o ciclo para consultar seus materiais planejados.
                </p>
              )}
              {editing.kind === "PDL" && (
                <p className="order-local-note">
                  Para encaminhar um pedido DL, selecione materiais de um único
                  fornecedor. Rascunhos podem conter mais de um fornecedor.
                </p>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Selecionar</th>
                      <th>Material</th>
                      <th>Unidade</th>
                      {editing.kind === "PDL" && (
                        <>
                          <th>DL / fornecedor</th>
                          <th>Disponível</th>
                          <th>Unitário</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {candidates
                      .slice((currentPage - 1) * 30, currentPage * 30)
                      .map((line) => {
                        const selected = editing.lines.some((candidate) =>
                          editing.kind === "PDL"
                            ? candidate.planId === line.planId &&
                              candidate.originId === line.originId
                            : candidate.itemId === line.itemId,
                        );
                        const origin = rows.find(
                          (row) =>
                            row.plan.id === line.planId &&
                            row.origin.id === line.originId,
                        );
                        return (
                          <tr
                            key={
                              editing.kind === "PDL"
                                ? `${line.planId}:${line.originId}`
                                : line.itemId
                            }
                          >
                            <td>
                              <input
                                type="checkbox"
                                className="ui-checkbox"
                                aria-label={`Selecionar ${line.description}${line.dlCode ? ` da ${line.dlCode}` : ""}`}
                                checked={selected}
                                onChange={() => toggle(line)}
                              />
                            </td>
                            <td>
                              {line.description}
                              <small>{line.code}</small>
                            </td>
                            <td>{line.unit}</td>
                            {editing.kind === "PDL" && (
                              <>
                                <td>
                                  {line.dlCode}
                                  <small>
                                    Vigência:{" "}
                                    {date(
                                      origin?.plan.contract?.validFrom || "",
                                    )}{" "}
                                    a{" "}
                                    {date(
                                      origin?.plan.contract?.validUntil || "",
                                    )}
                                  </small>
                                  <small>
                                    {line.supplier} · MXM {line.mxmOrder}
                                  </small>
                                </td>
                                <td>
                                  {decimalInput(
                                    origin?.origin.availableMilli || 0,
                                    3,
                                  )}{" "}
                                  {line.unit}
                                </td>
                                <td>
                                  {line.unitPriceCents === null
                                    ? "—"
                                    : formatMoney(line.unitPriceCents)}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    {!candidates.length && (
                      <tr>
                        <td
                          colSpan={editing.kind === "PDL" ? 6 : 3}
                          className="empty-state"
                        >
                          Nenhum material disponível para os filtros e o ciclo
                          selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="dl-orders-pagination">
                <span>{candidates.length} materiais</span>
                <button
                  className="secondary-button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Anterior
                </button>
                <span>
                  Página {currentPage} de {pages}
                </span>
                <button
                  className="secondary-button"
                  disabled={currentPage >= pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Próxima
                </button>
              </footer>
            </section>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Material / origem</th>
                  <th>Quantidade</th>
                  <th>Unitário</th>
                  <th>Subtotal</th>
                  {!editing && (
                    <>
                      <th>Recebido / atendido</th>
                      <th>Pendente</th>
                      <th>Não entregue</th>
                    </>
                  )}
                  {editing && <th>Ação</th>}
                </tr>
              </thead>
              <tbody>
                {shown.lines.map((line) => {
                  const value = preview?.lines.find(
                    (candidate) => candidate.id === line.id,
                  );
                  const amount = value
                    ? orderTotal({ ...shown, lines: [value] })
                    : null;
                  return (
                    <tr key={line.id}>
                      <td>
                        {line.description}
                        <small>
                          {line.code} · {line.unit}
                          {line.dlCode
                            ? ` · ${line.dlCode} · ${line.supplier} · MXM ${line.mxmOrder}`
                            : ""}
                        </small>
                      </td>
                      <td>
                        {editing ? (
                          <input
                            className="dl-orders-quantity"
                            inputMode="decimal"
                            aria-label={`Quantidade de ${line.description}`}
                            value={quantities[line.id] || ""}
                            onChange={(event) => {
                              setError("");
                              setQuantities((previous) => ({
                                ...previous,
                                [line.id]: event.target.value,
                              }));
                            }}
                          />
                        ) : (
                          `${decimalInput(line.quantityMilli, 3)} ${line.unit}`
                        )}
                      </td>
                      <td>
                        {editing && editing.kind !== "PDL" ? (
                          <input
                            className="dl-orders-quantity"
                            inputMode="decimal"
                            aria-label={`Preço de ${line.description}`}
                            value={prices[line.id] || ""}
                            onChange={(event) => {
                              setError("");
                              setPrices((previous) => ({
                                ...previous,
                                [line.id]: event.target.value,
                              }));
                            }}
                          />
                        ) : line.unitPriceCents === null ? (
                          "A definir"
                        ) : (
                          formatMoney(line.unitPriceCents)
                        )}
                      </td>
                      <td>
                        {amount && !amount.pending && amount.cents !== null
                          ? formatMoney(amount.cents)
                          : "A completar"}
                      </td>
                      {!editing && (
                        <>
                          <td>
                            {decimalInput(line.receivedMilli, 3)} {line.unit}
                          </td>
                          <td>
                            {decimalInput(
                              line.quantityMilli -
                                line.receivedMilli -
                                line.unfulfilledMilli,
                              3,
                            )}{" "}
                            {line.unit}
                          </td>
                          <td>
                            {decimalInput(line.unfulfilledMilli, 3)} {line.unit}
                          </td>
                        </>
                      )}
                      {editing && (
                        <td>
                          <button
                            className="text-button"
                            onClick={() =>
                              setEditing({
                                ...editing,
                                lines: editing.lines.filter(
                                  (candidate) => candidate.id !== line.id,
                                ),
                              })
                            }
                          >
                            Retirar
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {!shown.lines.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Selecione materiais para preparar o pedido.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="dl-orders-total">
            <div>
              <span>Total previsto</span>
              {!!total?.pending && (
                <small>
                  Parcial · {total.pending}{" "}
                  {total.pending === 1
                    ? "item a completar"
                    : "itens a completar"}
                </small>
              )}
            </div>
            <div>
              <strong>{totalLabel}</strong>
              <small>
                {shown.kind === "PDL"
                  ? "Preços das origens contratadas."
                  : "Preços informados neste pedido."}
              </small>
            </div>
          </footer>
          {!editing && active && (
            <section className="order-history">
              <h3>Histórico do pedido</h3>
              {[...active.events].reverse().map((record) => (
                <article key={record.id}>
                  <strong>{record.action}</strong>
                  <span>
                    {record.actor} ·{" "}
                    {new Date(record.timestamp).toLocaleString("pt-BR")}
                  </span>
                  {record.details && <p>{record.details}</p>}
                  {record.quantities?.map((line) => (
                    <p key={line.lineId}>
                      {
                        active.lines.find(
                          (candidate) => candidate.id === line.lineId,
                        )?.description
                      }{" "}
                      · {decimalInput(line.quantityMilli, 3)}{" "}
                      {
                        active.lines.find(
                          (candidate) => candidate.id === line.lineId,
                        )?.unit
                      }
                    </p>
                  ))}
                </article>
              ))}
            </section>
          )}
        </>
      )}
      {choosingType && (
        <NewOrderDialog
          onClose={() => setChoosingType(false)}
          onContinue={(selected) => {
            setChoosingType(false);
            begin(undefined, selected);
          }}
        />
      )}
      {action && active && (
        <OrderActionDialog
          key={`${active.id}:${action}`}
          order={active}
          action={action}
          onClose={() => {
            setAction(null);
            setError("");
          }}
          onSave={(payload) => {
            if (
              commit(
                (current, context) =>
                  transitionOrder(current, active.id, action, payload, context),
                actionFeedback[action],
              )
            )
              setAction(null);
          }}
          error={error}
        />
      )}
    </section>
  );
}

function OrderActionDialog({
  order,
  action,
  error,
  onClose,
  onSave,
}: {
  order: Order;
  action: OrderAction;
  error: string;
  onClose: () => void;
  onSave: (payload: {
    actor: string;
    reason?: string;
    externalReference?: string;
    quantities?: Record<string, number>;
    closePending?: boolean;
  }) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [actor, setActor] = useState(DEFAULT_DL_REQUESTER);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState(order.externalReference);
  const [received, setReceived] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState("");
  const [closePending, setClosePending] = useState(false);
  const receiving = action === "receive";
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const title =
    receiving && order.kind === "MOV" && order.movement === "Saída"
      ? "Registrar atendimento"
      : actionTitles[action];
  function save() {
    try {
      const quantities = receiving
        ? Object.fromEntries(
            order.lines.map((line) => [
              line.id,
              parseScaledInput(
                received[line.id] || "",
                3,
                `Quantidade de ${line.description}`,
              ) || 0,
            ]),
          )
        : undefined;
      setLocalError("");
      onSave({
        actor,
        reason,
        externalReference: order.kind === "PCD" ? reference : undefined,
        quantities,
        closePending,
      });
    } catch (cause) {
      setLocalError(
        cause instanceof Error ? cause.message : "Confira as quantidades.",
      );
    }
  }
  return (
    <dialog
      ref={ref}
      className={`item-edit-dialog ${receiving ? "ui-data-dialog order-action-dialog" : "order-small-dialog"}`}
      aria-labelledby="order-action-title"
      onClose={onClose}
    >
      <header className="ui-data-dialog-heading">
        <h2 id="order-action-title">{title}</h2>
        <p>
          {label(order)} · {orderKindNames[order.kind]}
        </p>
      </header>
      <div className="ui-data-dialog-body">
        <label className="order-action-field">
          Responsável pelo registro
          <input
            aria-label="Responsável pelo registro"
            value={actor}
            onChange={(event) => setActor(event.target.value)}
          />
        </label>
        {action === "send" && order.kind === "PCD" && (
          <label className="order-action-field">
            Requisição MXM
            <input
              aria-label="Requisição MXM"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
        )}
        {["return", "cancel"].includes(action) && (
          <label className="order-action-field">
            Motivo (obrigatório)
            <textarea
              aria-label="Motivo do registro"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        )}
        {receiving && (
          <>
            <p>
              Informe apenas as quantidades desta entrega. Os recebimentos
              anteriores serão preservados.
            </p>
            <button
              className="text-button"
              onClick={() =>
                setReceived(
                  Object.fromEntries(
                    order.lines.map((line) => [
                      line.id,
                      decimalInput(
                        line.quantityMilli -
                          line.receivedMilli -
                          line.unfulfilledMilli,
                        3,
                      ),
                    ]),
                  ),
                )
              }
            >
              Preencher todo o pendente
            </button>
            <label className="order-close-pending">
              <input
                className="ui-checkbox"
                type="checkbox"
                checked={closePending}
                onChange={(event) => setClosePending(event.target.checked)}
              />
              Encerrar entrega: o que não veio não será mais entregue
            </label>
            {closePending && (
              <p>
                As quantidades informadas serão baixadas. Campos vazios contam
                como zero recebido. O que faltar será marcado como não entregue
                e sua reserva será liberada.
              </p>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Solicitado</th>
                    <th>Já recebido</th>
                    <th>Pendente</th>
                    <th>Nesta entrega</th>
                    <th>Conferência</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        {line.description}
                        <small>
                          {line.unit} · {line.dlCode}
                        </small>
                      </td>
                      <td>{decimalInput(line.quantityMilli, 3)}</td>
                      <td>{decimalInput(line.receivedMilli, 3)}</td>
                      <td>
                        {decimalInput(
                          line.quantityMilli -
                            line.receivedMilli -
                            line.unfulfilledMilli,
                          3,
                        )}
                      </td>
                      <td>
                        <input
                          aria-label={`Recebimento de ${line.description}`}
                          className="dl-orders-quantity"
                          inputMode="decimal"
                          disabled={
                            line.receivedMilli + line.unfulfilledMilli ===
                            line.quantityMilli
                          }
                          value={received[line.id] || ""}
                          onChange={(event) => {
                            setLocalError("");
                            setReceived((previous) => ({
                              ...previous,
                              [line.id]: event.target.value,
                            }));
                          }}
                        />
                      </td>
                      <td>{receiptCheck(line, received[line.id])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {action === "cancel" && (
          <p>
            O cancelamento preserva os recebimentos já registrados e encerra
            somente a quantidade pendente. Um atraso por si só não cancela nem
            libera reservas.
          </p>
        )}
        {action === "approve" && (
          <p>
            Este é o registro manual de uma aprovação. O nome informado
            identifica o responsável no histórico; ainda não há autenticação por
            perfil.
          </p>
        )}
        {action === "send" && (
          <p>
            Confirme somente após realizar o envio pelos canais utilizados pela
            equipe. Esta ação registra o envio, sem transmitir mensagens.
          </p>
        )}
        {(error || localError) && (
          <p role="alert" className="catalog-error">
            {localError || error}
          </p>
        )}
      </div>
      <footer className="ui-data-dialog-footer">
        <button
          className="secondary-button"
          onClick={() => ref.current?.close()}
        >
          Fechar
        </button>
        <button className="primary-button" onClick={save}>
          Confirmar registro
        </button>
      </footer>
    </dialog>
  );
}

function NewOrderDialog({
  onClose,
  onContinue,
}: {
  onClose: () => void;
  onContinue: (kind: OrderKind) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const explanations: Record<OrderKind, string> = {
    PCD: "Selecione um ciclo e os materiais para solicitar a transferência.",
    PFR: "Selecione materiais do catálogo e informe a justificativa para uso do fundo rotativo.",
    PDL: "Selecione materiais de uma DL vigente. Ao salvar o rascunho, as quantidades ficam reservadas.",
    ATA: "Informe a ata ou contrato, o fornecedor e os materiais solicitados.",
    MOV: "Distribua os itens de uma DL com saldo entre as áreas, confira a conta e acompanhe a entrada da NF e as solicitações.",
  };
  const chosen = orderKinds.find((kind) => kind === selected);
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog order-small-dialog"
      aria-labelledby="new-order-title"
      onClose={onClose}
    >
      <header className="ui-data-dialog-heading">
        <h2 id="new-order-title">Novo pedido</h2>
        <p>Escolha o tipo para iniciar a solicitação.</p>
      </header>
      <div className="ui-data-dialog-body">
        <FilterSelect
          label="Selecione o tipo de pedido"
          value={selected}
          onChange={setSelected}
          options={[
            { value: "", label: "Selecionar tipo", disabled: true },
            ...orderKinds
              .filter((kind) => kind !== "ATA")
              .map((kind) => ({
                value: kind,
                label: orderKindNames[kind],
                group: ["PCD", "PFR", "PDL"].includes(kind)
                  ? "Estoque"
                  : "Compras",
              })),
          ]}
        />
        {chosen && (
          <p className="muted" role="status">
            {explanations[chosen]}
          </p>
        )}
      </div>
      <footer className="ui-data-dialog-footer">
        <button
          className="secondary-button"
          onClick={() => ref.current?.close()}
        >
          Cancelar
        </button>
        <button
          className="primary-button"
          disabled={!chosen}
          onClick={() => chosen && onContinue(chosen)}
        >
          Continuar
        </button>
      </footer>
    </dialog>
  );
}
