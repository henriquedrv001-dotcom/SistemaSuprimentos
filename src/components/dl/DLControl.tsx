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
  const providers = [
    ...new Set(
      plans.flatMap((plan) =>
        plan.contract!.awards.map((award) => award.supplier),
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const matched = plans.filter(
    (plan) =>
      (!status || contractStatus(plan, today) === status) &&
      (!category || plan.category === category) &&
      (!supplier ||
        plan.contract!.awards.some((award) => award.supplier === supplier)) &&
      `${plan.code} ${plan.title} ${plan.request.officialDLNumber} ${plan
        .contract!.awards.map((award) => {
          const line = plan.lines.find((line) => line.id === award.lineId);
          const item = items.find((item) => item.id === line?.itemId);
          return `${award.supplier} ${award.mxmOrder} ${item?.code} ${item?.description}`;
        })
        .join(" ")}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  return (
    <section className="panel dl-control">
      <div className="dl-contract-summary">
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
      <p className="catalog-feedback">
        Saldos iniciais das contratações registradas. Reservas, recebimentos e
        movimentações do ERP ainda não estão conectados. Estes valores não
        incluem consumos anteriores.
      </p>
      {selected ? (
        <>
          <button className="text-button" onClick={() => setActive(null)}>
            ← Todas as DLs do Controle
          </button>
          <div className="panel-heading">
            <div>
              <h2>
                {selected.code} · {selected.title}
              </h2>
              <p className="muted">
                {contractStatus(selected, today)} · Referência oficial:{" "}
                {selected.request.officialDLNumber}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => onOpenPlanning(selected.id)}
            >
              Consultar planejamento
            </button>
          </div>
          <div className="tabs">
            {[
              ["overview", "Visão geral"],
              ["balances", "Materiais e saldos"],
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
              <div className="dl-contract-summary">
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
              <dl className="dl-overview">
                <dt>Data da contratação</dt>
                <dd>{date(selected.contract!.signedOn)}</dd>
                <dt>Vigência</dt>
                <dd>
                  {selected.contract!.validFrom
                    ? `${date(selected.contract!.validFrom)} a ${date(selected.contract!.validUntil)}`
                    : "Não informada / não aplicável"}
                </dd>
                <dt>Fornecedores</dt>
                <dd>
                  {[
                    ...new Set(
                      selected.contract!.awards.map((award) => award.supplier),
                    ),
                  ].join(", ")}
                </dd>
                <dt>Conferência para liberação</dt>
                <dd>{selected.contract!.release!.reference}</dd>
                <dt>Concluída em</dt>
                <dd>
                  {new Date(
                    selected.contract!.release!.timestamp,
                  ).toLocaleString("pt-BR")}
                </dd>
                <dt>Observações</dt>
                <dd>{selected.contract!.notes || "—"}</dd>
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
          {tab === "orders" && (
            <p className="empty-state">
              A integração dos pedidos PDL será a próxima etapa. Nenhum pedido
              foi criado automaticamente ao concluir esta DL.
            </p>
          )}
          {tab === "history" && (
            <>
              {workspace.events
                .filter((event) => event.planId === selected.id)
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
        </>
      ) : (
        <>
          <div className="panel-heading">
            <h2>DLs e contratações</h2>
            <span className="muted">
              {matched.length} de {plans.length} DL(s)
            </span>
          </div>
          <label className="catalog-search">
            <input
              aria-label="Buscar no Controle de DLs"
              placeholder="Buscar DL, material, fornecedor ou pedido MXM"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label>
              Situação
              <select
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
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DL</th>
                  <th>Objeto</th>
                  <th>Fornecedores</th>
                  <th>Valor contratado inicial</th>
                  <th>Vigência</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {matched.map((plan) => (
                  <tr key={plan.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => {
                          setActive(plan.id);
                          setTab("overview");
                        }}
                      >
                        {plan.code}
                      </button>
                    </td>
                    <td>{plan.title}</td>
                    <td>
                      {[
                        ...new Set(
                          plan.contract!.awards.map((award) => award.supplier),
                        ),
                      ].join(", ")}
                    </td>
                    <td>
                      {formatMoney(contractTotal(plan.contract!).totalCents)}
                    </td>
                    <td>
                      {plan.contract!.validFrom
                        ? `${date(plan.contract!.validFrom)} a ${date(plan.contract!.validUntil)}`
                        : "Não informada / não aplicável"}
                    </td>
                    <td>{contractStatus(plan, today)}</td>
                  </tr>
                ))}
                {!matched.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      {plans.length
                        ? "Nenhuma DL corresponde aos filtros."
                        : "Conclua uma contratação no Planejamento para consultar os saldos iniciais aqui."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
      <p className="muted">
        Cada linha identifica uma origem única: DL, material, fornecedor e
        pedido de compra MXM. Valores em{" "}
        {plan.contract?.validUntil && plan.contract.validUntil < todayInBrazil()
          ? "vigência encerrada"
          : "controle inicial"}
        ; elegibilidade para pedidos será validada na integração.
      </p>
      <div className="table-wrap">
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
