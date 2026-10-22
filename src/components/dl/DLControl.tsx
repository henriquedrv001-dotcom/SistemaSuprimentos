import FilterSelect from "../ui/FilterSelect";
import FilterSearch from "../ui/FilterSearch";
import DLControlItemDialog from "./DLControlItemDialog";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronRight,
  Info,
} from "lucide-react";
import DLControlAlertDialog from "./DLControlAlertDialog";
import {
  DEFAULT_DL_LOW_BALANCE_PERCENT,
  selectDLControlRows,
  dlControlAlertGroups,
} from "../../services/dlControl";
import type {
  DLControlSort,
  DLControlDirection,
  DLControlAlert,
  DLControlRow,
} from "../../services/dlControl";
import DLHistory from "./DLHistory";
import DLSchedulePanel from "./DLSchedulePanel";
import { emptyDLSchedule } from "../../services/dlSchedule";
import { useState } from "react";
import type { DLPlan, DLWorkspace } from "../../types/dl";
import type { Item } from "../../types";
import type { OrderWorkspace, DLManualDebitInput } from "../../types/orders";
import { orderControlRows, emptyOrderWorkspace } from "../../services/orders";
import { originKey } from "../../services/dlOrderDrafts";
import {
  awardTotal,
  contractStatus,
  contractTotal,
} from "../../services/dlContract";
import {
  decimalInput,
  formatMoney,
  planBudget,
  todayInBrazil,
} from "../../services/dlPlanning";
import "./DLControl.css";
export default function DLControl({
  workspace,
  items,
  onOpenPlanning,
  orders = emptyOrderWorkspace(),
  orderError,
  onOpenOrder,
  onManualDebit,
}: {
  workspace: DLWorkspace;
  items: Item[];
  onOpenPlanning: (id: string) => void;
  orders?: OrderWorkspace;
  orderError?: string;
  onOpenOrder?: (id: string) => void;
  onManualDebit?: (input: DLManualDebitInput) => void;
}) {
  const plans = workspace.plans.filter(
    (plan) => plan.stage === "Concluído" && plan.contract?.release,
  );
  const [active, setActive] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("");
  const [tab, setTab] = useState("overview");
  const [sortBy, setSortBy] = useState<DLControlSort>("dl");
  const [direction, setDirection] = useState<DLControlDirection>("asc");
  const [showZeroBalances, setShowZeroBalances] = useState(true);
  const [alert, setAlert] = useState<DLControlAlert | null>(null);
  const [openedOrigin, setOpenedOrigin] = useState<string | null>(null);
  const today = todayInBrazil();
  const selected = plans.find((plan) => plan.id === active);
  const lastOrder = (planId: string, originId: string) =>
    orders.orders
      .filter(
        (order) =>
          (order.kind === "PDL" || !!order.movementFlow) &&
          order.code &&
          order.lines.some(
            (line) => line.planId === planId && line.originId === originId,
          ),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const consolidated = plans.reduce(
    (sum, plan) => sum + BigInt(contractTotal(plan.contract!).totalCents),
    0n,
  );
  const rows = orderControlRows({ plans, items }, orders);
  const providers = [
    ...new Set(rows.map(({ origin }) => origin.supplier)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const matched = selectDLControlRows(
    rows,
    { query, status, supplier, category, showZeroBalances, sortBy, direction },
    today,
  );
  const openedItem: DLControlRow | undefined = rows.find(
    (row) => originKey(row.plan.id, row.origin.id) === openedOrigin,
  );
  const limit = DEFAULT_DL_LOW_BALANCE_PERCENT;
  const alerts = {
    lowBalance: dlControlAlertGroups(rows, "lowBalance", today, limit),
    zeroBalance: dlControlAlertGroups(rows, "zeroBalance", today, limit),
    expiring: dlControlAlertGroups(rows, "expiring", today, limit),
  };
  const alertCards = [
    {
      kind: "lowBalance" as const,
      label: "DLs com saldo próximo ao fim",
      value: alerts.lowBalance.length,
      note: `${alerts.lowBalance.reduce((sum, group) => sum + group.rows.length, 0)} item(ns) com saldo positivo até ${limit}%`,
    },
    {
      kind: "zeroBalance" as const,
      label: "Itens com saldo zerado",
      value: alerts.zeroBalance.reduce(
        (sum, group) => sum + group.rows.length,
        0,
      ),
      note: `${alerts.zeroBalance.length} DL(s) com itens sem saldo`,
    },
    {
      kind: "expiring" as const,
      label: "DLs vencendo em até 30 dias",
      value: alerts.expiring.length,
      note: "Vigência contratual próxima do fim",
    },
  ];
  return (
    <section className="dl-control">
      {orderError && (
        <p role="alert" className="catalog-error">
          {orderError} Os saldos abaixo não incluem os pedidos que não puderam
          ser lidos.
        </p>
      )}
      {!selected && (
        <>
          <div className="dl-control-indicators">
            {alertCards.map((card) => (
              <button
                key={card.kind}
                className="dl-control-indicator"
                onClick={() => setAlert(card.kind)}
                aria-label={`Ver detalhes: ${card.label}`}
              >
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.note}</small>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            ))}
            <div className="dl-control-indicator dl-control-financial">
              <span>Valor contratado inicial</span>
              <strong>
                {consolidated <= BigInt(Number.MAX_SAFE_INTEGER)
                  ? formatMoney(Number(consolidated))
                  : "Consulte por DL"}
              </strong>
              <small>{plans.length} DL(s) concluída(s)</small>
            </div>
          </div>
          <div className="dl-control-guidance">
            <Info size={16} aria-hidden="true" />
            <div>
              <p className="dl-control-metric-rule">
                Saldo disponível baixo: positivo e até {limit}% da quantidade
                contratada, por item; cada DL conta uma vez. Indicadores
                globais; os filtros afetam apenas a lista.
              </p>
              <p className="dl-control-note">
                Saldo disponível: contratado menos recebimentos, reservas dos
                pedidos de DL estocável e entrada e saída, e baixas manuais
                locais. Movimentações externas e consumos anteriores não estão
                integrados ao MXM.
              </p>
            </div>
          </div>
        </>
      )}
      {selected ? (
        <section className="panel dl-control-detail">
          <button
            className="text-button dl-control-back"
            onClick={() => setActive(null)}
          >
            ← Todos os itens do Controle
          </button>
          <div className="panel-heading dl-control-heading">
            <div>
              <h2>
                {selected.code} · {selected.title}
              </h2>
              <p className="muted">
                {contractStatus(selected, today)}
                {selected.request.officialDLNumber && (
                  <>
                    {" "}
                    · Referência oficial: {selected.request.officialDLNumber}
                  </>
                )}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => onOpenPlanning(selected.id)}
            >
              Consultar planejamento
            </button>
          </div>
          <div className="tabs dl-control-tabs">
            {[
              ["overview", "Visão geral"],
              ["balances", "Materiais e saldos"],
              ["schedule", "Cronograma"],
              ["orders", "Pedidos vinculados"],
              ["history", "Movimentações e histórico"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={`tab ${tab === id ? "active" : ""}`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "overview" && (
            <>
              <div className="dl-contract-summary dl-control-totals">
                <div>
                  <span>Previsto</span>
                  <strong>
                    {formatMoney(planBudget(selected.lines).totalCents)}
                  </strong>
                </div>
                <div>
                  <span>Contratado</span>
                  <strong>
                    {formatMoney(contractTotal(selected.contract!).totalCents)}
                  </strong>
                </div>
                <div>
                  <span>Diferença</span>
                  <strong>
                    {formatMoney(
                      contractTotal(selected.contract!).totalCents -
                        planBudget(selected.lines).totalCents,
                    )}
                  </strong>
                </div>
              </div>
              <dl className="dl-control-overview">
                <div>
                  <dt>Data da contratação</dt>
                  <dd>{date(selected.contract!.signedOn)}</dd>
                </div>
                <div>
                  <dt>Vigência</dt>
                  <dd>
                    {selected.contract!.validFrom
                      ? `${date(selected.contract!.validFrom)} a ${date(selected.contract!.validUntil)}`
                      : "Não informada / não aplicável"}
                  </dd>
                </div>
                <div>
                  <dt>Fornecedores</dt>
                  <dd>
                    {[
                      ...new Set(
                        selected.contract!.awards.map(
                          (award) => award.supplier,
                        ),
                      ),
                    ].join(", ")}
                  </dd>
                </div>
                <div>
                  <dt>Conferência para liberação</dt>
                  <dd>{selected.contract!.release!.reference}</dd>
                </div>
                <div>
                  <dt>Concluída em</dt>
                  <dd>
                    {new Date(
                      selected.contract!.release!.timestamp,
                    ).toLocaleString("pt-BR")}
                  </dd>
                </div>
                <div>
                  <dt>Observações</dt>
                  <dd>{selected.contract!.notes || "—"}</dd>
                </div>
              </dl>
              {!!selected.contract!.notAwarded.length && (
                <>
                  <h3>Materiais não contratados</h3>
                  {selected.contract!.notAwarded.map((result) => {
                    const line = selected.lines.find(
                      (line) => line.id === result.lineId,
                    );
                    const item = items.find((item) => item.id === line?.itemId);
                    return (
                      <p key={result.lineId}>
                        {item?.code} · {item?.description}: {result.reason}
                      </p>
                    );
                  })}
                </>
              )}
            </>
          )}
          {tab === "balances" && (
            <DLBalanceTable
              plan={selected}
              items={items}
              rows={rows.filter((row) => row.plan.id === selected.id)}
            />
          )}
          {tab === "schedule" && (
            <DLSchedulePanel
              plan={selected}
              value={selected.schedule ?? emptyDLSchedule()}
              onChange={() => {}}
              readOnly
            />
          )}
          {tab === "orders" && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Solicitante</th>
                    <th>Itens desta DL</th>
                    <th>Entrega prevista</th>
                    <th>Situação</th>
                    {onOpenOrder && <th>Consultar</th>}
                  </tr>
                </thead>
                <tbody>
                  {orders.orders
                    .filter(
                      (order) =>
                        (order.kind === "PDL" || !!order.movementFlow) &&
                        order.lines.some((line) => line.planId === selected.id),
                    )
                    .map((order) => (
                      <tr key={order.id}>
                        <td>
                          {order.code || `Rascunho · ${order.id.slice(0, 8)}`}
                        </td>
                        <td>{order.requester}</td>
                        <td>
                          {
                            order.lines.filter(
                              (line) => line.planId === selected.id,
                            ).length
                          }
                        </td>
                        <td>{date(order.expectedDelivery)}</td>
                        <td>{order.movementFlow?.phase || order.status}</td>
                        {onOpenOrder && (
                          <td>
                            <button
                              className="text-button"
                              onClick={() => onOpenOrder(order.id)}
                            >
                              Consultar pedido
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  {!orders.orders.some(
                    (order) =>
                      (order.kind === "PDL" || !!order.movementFlow) &&
                      order.lines.some((line) => line.planId === selected.id),
                  ) && (
                    <tr>
                      <td colSpan={onOpenOrder ? 6 : 5} className="empty-state">
                        Nenhum pedido ligado a esta DL.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {tab === "history" && (
            <DLHistory
              heading="Histórico de atividades"
              planId={selected.id}
              events={workspace.events}
            />
          )}
        </section>
      ) : (
        <section className="panel dl-control-list">
          <div className="panel-heading dl-control-heading">
            <h2>Materiais no Controle</h2>
            <div className="dl-control-heading-tools">
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={showZeroBalances}
                  onChange={(event) =>
                    setShowZeroBalances(event.target.checked)
                  }
                />
                Mostrar zerados
              </label>
              <span className="muted">
                {matched.length} de {rows.length} itens
              </span>
            </div>
          </div>
          <div className="ui-filterbar dl-control-filterbar">
            <FilterSearch
              label="Buscar"
              aria-label="Buscar no Controle de DLs"
              placeholder="DL, objeto, código, material, fornecedor ou MXM"
              value={query}
              onChange={setQuery}
            />
            <FilterSelect
              label="Situação"
              value={status}
              onChange={setStatus}
              options={[
                { value: "", label: "Todas" },
                ...[
                  "Ativa",
                  "Vence em até 30 dias",
                  "Vigência futura",
                  "Vigência encerrada",
                ].map((status) => ({ value: status, label: status })),
              ]}
            />
            <FilterSelect
              label="Fornecedor"
              value={supplier}
              onChange={setSupplier}
              options={[
                { value: "", label: "Todos" },
                ...providers.map((supplier) => ({
                  value: supplier,
                  label: supplier,
                })),
              ]}
            />
            <FilterSelect
              label="Categoria"
              value={category}
              onChange={setCategory}
              options={[
                { value: "", label: "Todas" },
                ...[
                  ...new Set(
                    plans.map((plan) => plan.category).filter(Boolean),
                  ),
                ]
                  .sort()
                  .map((category) => ({ value: category, label: category })),
              ]}
            />
            <div className="ui-filter-field">
              <span className="ui-filter-label" id="dl-control-sort-label">
                Ordenar por
              </span>
              <div className="dl-control-sort-controls">
                <FilterSelect
                  aria-label="Ordenar itens por"
                  value={sortBy}
                  onChange={(value) => setSortBy(value as DLControlSort)}
                  options={[
                    { value: "dl", label: "DL" },
                    { value: "supplier", label: "Fornecedor" },
                    { value: "item", label: "Item" },
                    { value: "balance", label: "Saldo" },
                  ]}
                />
                <button
                  className="secondary-button"
                  aria-label={`Ordenação ${direction === "asc" ? "crescente" : "decrescente"}`}
                  title={`Alternar ordenação ${direction === "asc" ? "crescente" : "decrescente"}`}
                  onClick={() =>
                    setDirection(direction === "asc" ? "desc" : "asc")
                  }
                >
                  {direction === "asc" ? (
                    <ArrowUpNarrowWide size={15} aria-hidden="true" />
                  ) : (
                    <ArrowDownWideNarrow size={15} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div
            className="table-wrap dl-control-table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Itens e saldos das DLs"
          >
            <table className="dl-control-table dl-control-items-table">
              <colgroup>
                <col className="dl-item-dl" />
                <col className="dl-item-description" />
                <col className="dl-item-quantity" />
                <col className="dl-item-price" />
                <col className="dl-item-mxm" />
                <col className="dl-item-supplier" />
                <col className="dl-item-balance" />
                <col className="dl-item-last-order" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">DL</th>
                  <th scope="col">Item / descrição</th>
                  <th scope="col" title="Quantidade contratada inicial">
                    QTD
                  </th>
                  <th scope="col">Valor unitário</th>
                  <th scope="col">Pedido MXM</th>
                  <th scope="col">Fornecedor</th>
                  <th
                    scope="col"
                    title="Disponível para novos pedidos: contratado menos recebido e reservado nos pedidos locais"
                  >
                    Saldo
                  </th>
                  <th scope="col">Último pedido</th>
                </tr>
              </thead>
              <tbody>
                {matched.map(({ plan, origin, item }) => (
                  <tr key={originKey(plan.id, origin.id)}>
                    <td>
                      <button
                        className="text-button"
                        aria-label={`Abrir ${plan.code}: ${item?.description || origin.itemId}`}
                        onClick={() => {
                          setActive(plan.id);
                          setTab("overview");
                        }}
                      >
                        {plan.code}
                      </button>
                    </td>
                    <td className="dl-control-material">
                      <button
                        className="dl-control-open-item"
                        aria-label={`Abrir item ${item?.description || origin.itemId} da ${plan.code}`}
                        onClick={() =>
                          setOpenedOrigin(originKey(plan.id, origin.id))
                        }
                      >
                        <span>
                          {item?.description || "Cadastro indisponível"}
                        </span>
                      </button>
                    </td>
                    <td className="dl-control-number">
                      {decimalInput(origin.quantityMilli, 3)}
                      <span className="dl-control-unit">{origin.unit}</span>
                    </td>
                    <td className="dl-control-number">
                      {formatMoney(origin.unitPriceCents)}
                    </td>
                    <td>{origin.mxmOrder}</td>
                    <td className="dl-control-supplier">{origin.supplier}</td>
                    <td className="dl-control-number dl-control-balance">
                      <span
                        className="dl-control-balance-value"
                        data-zero={origin.availableMilli === 0}
                      >
                        {decimalInput(origin.availableMilli, 3)}
                        <span className="dl-control-unit">{origin.unit}</span>
                      </span>
                    </td>
                    <td
                      title={
                        lastOrder(plan.id, origin.id)?.status ||
                        "Nenhum pedido de DL registrado"
                      }
                    >
                      {lastOrder(plan.id, origin.id)?.code || "—"}
                    </td>
                  </tr>
                ))}
                {!matched.length && (
                  <tr>
                    <td colSpan={8} className="empty-state">
                      {rows.length
                        ? "Nenhum material corresponde aos filtros."
                        : plans.length
                          ? "As DLs concluídas não possuem materiais contratados para exibir."
                          : "Conclua uma contratação no Planejamento para consultar os itens e saldos iniciais aqui."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="muted dl-control-items-note">
            QTD é a quantidade contratada; Valor é o preço unitário. Último
            pedido fica sem informação enquanto não há solicitação vinculada.
          </p>
        </section>
      )}
      {openedItem && (
        <DLControlItemDialog
          row={openedItem}
          orders={orders}
          onManualDebit={onManualDebit}
          onClose={() => setOpenedOrigin(null)}
          onOpenDL={(id) => {
            setOpenedOrigin(null);
            setActive(id);
            setTab("balances");
          }}
        />
      )}
      {alert && (
        <DLControlAlertDialog
          kind={alert}
          groups={alerts[alert]}
          limit={limit}
          today={today}
          onClose={() => setAlert(null)}
          onOpen={(id) => {
            setActive(id);
            setTab("balances");
            setAlert(null);
          }}
        />
      )}
    </section>
  );
}
function date(value: string) {
  return value ? value.split("-").reverse().join("/") : "—";
}
function DLBalanceTable({
  plan,
  items,
  rows,
}: {
  plan: DLPlan;
  items: Item[];
  rows: DLControlRow[];
}) {
  return (
    <>
      <p className="muted dl-control-note">
        Cada linha identifica uma origem única: DL, material, fornecedor e
        pedido de compra MXM. Valores em{" "}
        {plan.contract?.validUntil && plan.contract.validUntil < todayInBrazil()
          ? "vigência encerrada"
          : "controle inicial"}
        ; recebimentos e reservas consideram os pedidos locais.
      </p>
      <div
        className="table-wrap dl-control-table-wrap"
        tabIndex={0}
        role="region"
        aria-label="Materiais e saldos da DL"
      >
        <table className="dl-balance-table">
          <thead>
            <tr>
              <th>Código / material</th>
              <th>Fornecedor</th>
              <th>Pedido MXM</th>
              <th>Unidade</th>
              <th>Contratado</th>
              <th>Recebido</th>
              <th>Reservado</th>
              <th>Baixas manuais</th>
              <th>Disponível</th>
              <th>Preço final</th>
              <th>Valor inicial</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ origin }) => {
              const item = items.find((item) => item.id === origin.itemId);
              const award = plan.contract!.awards.find(
                (award) => award.id === origin.id,
              )!;
              return (
                <tr key={origin.id}>
                  <td>
                    <strong>{item?.code ?? origin.itemId}</strong>
                    <span className="dl-spec">{item?.description}</span>
                  </td>
                  <td>
                    {origin.supplier}
                    <small className="dl-spec">
                      {origin.supplierReference}
                    </small>
                  </td>
                  <td>{origin.mxmOrder}</td>
                  <td>{origin.unit}</td>
                  <td>{decimalInput(origin.quantityMilli, 3)}</td>
                  <td>{decimalInput(origin.receivedMilli, 3)}</td>
                  <td>{decimalInput(origin.reservedMilli, 3)}</td>
                  <td>{decimalInput(origin.manualDebitedMilli || 0, 3)}</td>
                  <td>{decimalInput(origin.availableMilli, 3)}</td>
                  <td>{formatMoney(origin.unitPriceCents)}</td>
                  <td>{formatMoney(awardTotal(award)!)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
