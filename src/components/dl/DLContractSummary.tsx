import DLOrderDocumentList from "./DLOrderDocumentList";
import { dlOrderDocuments } from "../../services/dlOrderDocuments";
import type { DLPlan } from "../../types/dl";
import type { Item } from "../../types";
import { contractTotal, awardTotal } from "../../services/dlContract";
import {
  decimalInput,
  formatMoney,
  planBudget,
} from "../../services/dlPlanning";
import "./DLContractSummary.css";
export default function DLContractSummary({
  plan,
  items,
  onOpenProcess,
}: {
  plan: DLPlan;
  items: Item[];
  onOpenProcess?: () => void;
}) {
  const contract = plan.contract;
  const budget = planBudget(plan.lines);
  const estimated = budget.totalCents;
  const total = contract ? contractTotal(contract) : null;
  const pendingResults = plan.lines.filter((line) => {
    const award = contract?.awards.find((result) => result.lineId === line.id);
    return award
      ? awardTotal(award) === null
      : !contract?.notAwarded.some((result) => result.lineId === line.id);
  }).length;
  const hasValue =
    !!contract &&
    (contract.awards.some((award) => awardTotal(award) !== null) ||
      (plan.lines.length > 0 && pendingResults === 0));
  const comparable =
    hasValue && pendingResults === 0 && budget.incomplete === 0;
  const documents = dlOrderDocuments(plan);
  const orderNumbers = [
    ...new Set(
      contract?.awards.map((award) => award.mxmOrder).filter(Boolean) ?? [],
    ),
  ];
  const difference = comparable && total ? total.totalCents - estimated : null;
  const date = (value?: string) =>
    value ? value.split("-").reverse().join("/") : "A definir";
  const validityPeriod = contract?.validFrom
    ? contract.validUntil
      ? `${date(contract.validFrom)} a ${date(contract.validUntil)}`
      : `A partir de ${date(contract.validFrom)}`
    : contract?.validUntil
      ? `Até ${date(contract.validUntil)}`
      : "A definir";
  return (
    <section
      className="dl-final-summary"
      aria-labelledby="dl-final-summary-heading"
    >
      <header className="dl-final-summary-heading">
        <div className="dl-consult-heading">
          <h3 id="dl-final-summary-heading">Resumo da contratação</h3>
          {onOpenProcess && (
            <button className="secondary-button" onClick={onOpenProcess}>
              Ver processo
            </button>
          )}
        </div>
        <p className="muted">
          {contract?.release
            ? "Dados finais aprovados e disponibilizados no Controle de DLs."
            : "Resumo dos dados salvos. O preenchimento e a aprovação ficam em Requisição e processo; os valores ainda não constituem saldo liberado."}
        </p>
      </header>
      <div className="dl-contract-summary dl-final-summary-totals">
        <div>
          <span>Orçamento previsto</span>
          <strong>{formatMoney(estimated)}</strong>
          {budget.incomplete > 0 && (
            <small>
              Parcial · {budget.incomplete} item(ns) sem valor previsto
            </small>
          )}
        </div>
        <div>
          <span>
            {contract?.release
              ? "Valor contratado"
              : "Valor informado · parcial até aprovação"}
          </span>
          <strong>
            {hasValue && total ? formatMoney(total.totalCents) : "A definir"}
          </strong>
          {hasValue && pendingResults > 0 && (
            <small>Parcial · {pendingResults} item(ns) pendente(s)</small>
          )}
        </div>
        <div>
          <span>Diferença sobre o previsto</span>
          <strong
            data-difference={
              difference === null
                ? "unknown"
                : difference < 0
                  ? "lower"
                  : difference > 0
                    ? "higher"
                    : "equal"
            }
          >
            {comparable && total
              ? formatMoney(total.totalCents - estimated)
              : "—"}
          </strong>
          {difference !== null && estimated > 0 && (
            <small>
              {((difference / estimated) * 100).toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
                minimumFractionDigits: 2,
              })}
              % sobre o previsto
            </small>
          )}
        </div>
      </div>
      <dl className="dl-final-facts">
        <div>
          <dt>Data da contratação / Emissão do pedido</dt>
          <dd>{date(contract?.signedOn)}</dd>
        </div>
        <div>
          <dt>Vigência</dt>
          <dd>
            {contract?.validityMonths
              ? `${contract.validityMonths} mês(es)`
              : contract?.validFrom || contract?.validUntil
                ? "Período cadastrado"
                : plan.plannedValidityMonths
                  ? `${plan.plannedValidityMonths} mês(es) previstos`
                  : "Não informada"}
          </dd>
        </div>
        <div>
          <dt>Período da vigência</dt>
          <dd>{validityPeriod}</dd>
        </div>
        <div>
          <dt>Pedido MXM</dt>
          <dd>
            {orderNumbers.length ? orderNumbers.join(", ") : "Não informado"}
          </dd>
        </div>
      </dl>
      <DLOrderDocumentList documents={documents} />
      <div className="table-wrap dl-final-summary-table-wrap">
        <table className="dl-final-summary-table">
          <thead>
            <tr>
              <th>Código / material</th>
              <th>Fornecedor</th>
              <th>Pedido MXM</th>
              <th className="dl-final-summary-number">Quantidade</th>
              <th className="dl-final-summary-number">Preço unitário</th>
              <th className="dl-final-summary-number">Total</th>
            </tr>
          </thead>
          <tbody>
            {plan.lines.map((line) => {
              const item = items.find((item) => item.id === line.itemId);
              const award = contract?.awards.find(
                (award) => award.lineId === line.id,
              );
              const notAwarded = contract?.notAwarded.find(
                (result) => result.lineId === line.id,
              );
              return (
                <tr key={line.id}>
                  <td>
                    <strong>
                      {item?.description || "Cadastro indisponível"}
                    </strong>
                    <small className="dl-material-name">
                      {item?.code || line.itemId}
                    </small>
                  </td>
                  <td>
                    {award?.supplier ||
                      (notAwarded
                        ? `Não contratado: ${notAwarded.reason}`
                        : "A definir")}
                  </td>
                  <td>{award?.mxmOrder || "—"}</td>
                  <td className="dl-final-summary-number">
                    {award
                      ? `${decimalInput(award.quantityMilli, 3)} ${line.unit}`
                      : "—"}
                  </td>
                  <td className="dl-final-summary-number">
                    {award?.unitPriceCents != null
                      ? formatMoney(award.unitPriceCents)
                      : "—"}
                  </td>
                  <td className="dl-final-summary-number">
                    {award && awardTotal(award) != null
                      ? formatMoney(awardTotal(award)!)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={5}>
                Total da contratação
              </th>
              <td className="dl-final-summary-number">
                {hasValue && total
                  ? formatMoney(total.totalCents)
                  : "A definir"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {contract?.release && (
        <p className="muted dl-final-summary-approval">
          Aprovada em{" "}
          {new Date(contract.release.timestamp).toLocaleString("pt-BR")} ·{" "}
          {contract.release.actor}
        </p>
      )}
    </section>
  );
}
