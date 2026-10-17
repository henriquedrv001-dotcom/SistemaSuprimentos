import { dlOrderDocuments } from "../../services/dlOrderDocuments";
import type { DLPlan } from "../../types/dl";
import type { Item } from "../../types";
import { contractTotal, awardTotal } from "../../services/dlContract";
import {
  decimalInput,
  formatMoney,
  planBudget,
} from "../../services/dlPlanning";
export default function DLContractSummary({
  plan,
  items,
}: {
  plan: DLPlan;
  items: Item[];
}) {
  const contract = plan.contract;
  const estimated = planBudget(plan.lines).totalCents;
  const total = contract ? contractTotal(contract) : null;
  const date = (value?: string) =>
    value ? value.split("-").reverse().join("/") : "A definir";
  return (
    <>
      <h3>Resumo da contratação</h3>
      <p className="muted">
        {contract?.release
          ? "Dados finais aprovados e disponibilizados no Controle de DLs."
          : "Resumo dos dados salvos. O preenchimento e a aprovação ficam em Requisição e processo; os valores ainda não constituem saldo liberado."}
      </p>
      <div className="dl-contract-summary">
        <div>
          <span>Orçamento previsto</span>
          <strong>{formatMoney(estimated)}</strong>
        </div>
        <div>
          <span>
            {contract?.release
              ? "Valor contratado"
              : "Valor informado · parcial até aprovação"}
          </span>
          <strong>{total ? formatMoney(total.totalCents) : "A definir"}</strong>
        </div>
        <div>
          <span>Diferença sobre o previsto</span>
          <strong>
            {total ? formatMoney(total.totalCents - estimated) : "—"}
          </strong>
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
                : "Não informada"}
          </dd>
        </div>
        <div>
          <dt>Período da vigência</dt>
          <dd>
            {date(contract?.validFrom)} a {date(contract?.validUntil)}
          </dd>
        </div>
        <div>
          <dt>Anexos do pedido</dt>
          <dd>
            {dlOrderDocuments(plan)
              .map((document) => document.name)
              .join(" · ") || "Não registrado nesta versão"}
          </dd>
        </div>
      </dl>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código / material</th>
              <th>Fornecedor</th>
              <th>Pedido MXM</th>
              <th>Quantidade</th>
              <th>Preço unitário</th>
              <th>Total</th>
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
                    <strong>{item?.code || line.itemId}</strong>
                    <small className="dl-material-name">
                      {item?.description || "Cadastro indisponível"}
                    </small>
                  </td>
                  <td>
                    {award?.supplier ||
                      (notAwarded
                        ? `Não contratado: ${notAwarded.reason}`
                        : "A definir")}
                  </td>
                  <td>{award?.mxmOrder || "—"}</td>
                  <td>
                    {award
                      ? `${decimalInput(award.quantityMilli, 3)} ${line.unit}`
                      : "—"}
                  </td>
                  <td>
                    {award?.unitPriceCents != null
                      ? formatMoney(award.unitPriceCents)
                      : "—"}
                  </td>
                  <td>
                    {award && awardTotal(award) != null
                      ? formatMoney(awardTotal(award)!)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {contract?.release && (
        <p className="muted">
          Aprovada em{" "}
          {new Date(contract.release.timestamp).toLocaleString("pt-BR")} ·{" "}
          {contract.release.actor}
        </p>
      )}
    </>
  );
}
