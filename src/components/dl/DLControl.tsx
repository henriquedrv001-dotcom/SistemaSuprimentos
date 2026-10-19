import DLHistory from "./DLHistory";
import DLSchedulePanel from "./DLSchedulePanel";
import { emptyDLSchedule } from "../../services/dlSchedule";
import { useState } from "react";
import type { DLPlan, DLWorkspace } from "../../types/dl";
import type { Item } from "../../types";
import {
  awardTotal,
  contractOrigins,
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
}: {
  workspace: DLWorkspace;
  items: Item[];
  onOpenPlanning: (id: string) => void;
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
  const today = todayInBrazil();
  const selected = plans.find((plan) => plan.id === active);
  const consolidated = plans.reduce(
    (sum, plan) => sum + BigInt(contractTotal(plan.contract!).totalCents),
    0n,
  );
  const itemById = new Map(items.map((item) => [item.id, item]));
  const rows = plans.flatMap((plan) =>
    contractOrigins(plan).map((origin) => ({
      plan,
      origin,
      item: itemById.get(origin.itemId),
    })),
  );
  const providers = [
    ...new Set(rows.map(({ origin }) => origin.supplier)),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const matched = rows.filter(
    ({ plan, origin, item }) =>
      (!status || contractStatus(plan, today) === status) &&
      (!category || plan.category === category) &&
      (!supplier || origin.supplier === supplier) &&
      `${plan.code} ${plan.title} ${plan.request.officialDLNumber} ${origin.supplier} ${origin.mxmOrder} ${item?.code ?? ""} ${item?.description ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <section className="panel dl-control">
      <div className="dl-contract-summary dl-control-stats">
        <div>
          <span>Valor contratado inicial</span>
          <strong>
            {consolidated <= BigInt(Number.MAX_SAFE_INTEGER)
              ? formatMoney(Number(consolidated))
              : "Consulte por DL"}
          </strong>
        </div>
        <div>
          <span>DLs concluídas</span>
          <strong>{plans.length}</strong>
        </div>
        <div>
          <span>Ativas / vencendo</span>
          <strong>
            {
              plans.filter((plan) =>
                ["Ativa", "Vence em até 30 dias"].includes(
                  contractStatus(plan, today),
                ),
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Vencem em até 30 dias</span>
          <strong>
            {
              plans.filter(
                (plan) =>
                  contractStatus(plan, today) === "Vence em até 30 dias",
              ).length
            }
          </strong>
        </div>
      </div>
      <p className="catalog-feedback dl-control-note">
        Saldos iniciais das contratações registradas. Reservas, recebimentos e
        movimentações do ERP ainda não estão conectados. Estes valores não
        incluem consumos anteriores.
      </p>
      {selected ? (
        <>
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
            <DLBalanceTable plan={selected} items={items} />
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
            <p className="empty-state">
              A integração dos pedidos PDL será a próxima etapa. Nenhum pedido
              foi criado automaticamente ao concluir esta DL.
            </p>
          )}
          {tab === "history" && (
            <DLHistory planId={selected.id} events={workspace.events} />
          )}
        </>
      ) : (
        <>
          <div className="panel-heading dl-control-heading">
            <h2>Materiais no Controle</h2>
            <span className="muted">
              {matched.length} de {rows.length} itens
            </span>
          </div>
          <div className="dl-control-filters">
            <label className="dl-control-search">
              <span>Buscar</span>
              <span className="catalog-search">
                <input
                  aria-label="Buscar no Controle de DLs"
                  placeholder="Buscar DL, objeto, código, material, fornecedor ou MXM"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </span>
            </label>
            <div className="form-grid dl-control-selects">
              <label>
                Situação
                <select
                  aria-label="Situação"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Todas</option>
                  {[
                    "Ativa",
                    "Vence em até 30 dias",
                    "Vigência futura",
                    "Vigência encerrada",
                  ].map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                Fornecedor
                <select
                  aria-label="Fornecedor"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                >
                  <option value="">Todos</option>
                  {providers.map((supplier) => (
                    <option key={supplier}>{supplier}</option>
                  ))}
                </select>
              </label>
              <label>
                Categoria
                <select
                  aria-label="Categoria"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Todas</option>
                  {[
                    ...new Set(
                      plans.map((plan) => plan.category).filter(Boolean),
                    ),
                  ]
                    .sort()
                    .map((category) => (
                      <option key={category}>{category}</option>
                    ))}
                </select>
              </label>
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
                  <th scope="col">Objeto / descrição</th>
                  <th scope="col" title="Quantidade contratada inicial">
                    QTD
                  </th>
                  <th scope="col">
                    Valor<small>Unitário</small>
                  </th>
                  <th scope="col">Pedido MXM</th>
                  <th scope="col">Fornecedor</th>
                  <th
                    scope="col"
                    title="Saldo inicial contratado; movimentações ainda não vinculadas"
                  >
                    Saldo
                  </th>
                  <th scope="col">Último pedido</th>
                </tr>
              </thead>
              <tbody>
                {matched.map(({ plan, origin, item }) => (
                  <tr key={origin.id}>
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
                      <strong>
                        {item?.description || "Cadastro indisponível"}
                      </strong>
                      <small className="dl-control-material-reference">
                        {item?.code || origin.itemId}
                      </small>
                      <small>{plan.title}</small>
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
                      {decimalInput(origin.remainingMilli, 3)}
                      <span className="dl-control-unit">{origin.unit}</span>
                    </td>
                    <td title="Nenhum pedido PDL registrado">—</td>
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
        </>
      )}
    </section>
  );
}
function date(value: string) {
  return value ? value.split("-").reverse().join("/") : "—";
}
function DLBalanceTable({ plan, items }: { plan: DLPlan; items: Item[] }) {
  return (
    <>
      <p className="muted dl-control-note">
        Cada linha identifica uma origem única: DL, material, fornecedor e
        pedido de compra MXM. Valores em{" "}
        {plan.contract?.validUntil && plan.contract.validUntil < todayInBrazil()
          ? "vigência encerrada"
          : "controle inicial"}
        ; elegibilidade para pedidos será validada na integração.
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
              <th>Saldo inicial</th>
              <th>Preço final</th>
              <th>Valor inicial</th>
            </tr>
          </thead>
          <tbody>
            {contractOrigins(plan).map((origin) => {
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
                  <td>Não conectado</td>
                  <td>Não conectado</td>
                  <td>{decimalInput(origin.remainingMilli, 3)}</td>
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
