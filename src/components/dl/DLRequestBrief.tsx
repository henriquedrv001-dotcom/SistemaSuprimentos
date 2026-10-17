import type { DLPlan } from "../../types/dl";
import type { Item } from "../../types";
import { dlRequestBrief } from "../../services/dlRequest";
import { decimalInput } from "../../services/dlPlanning";
export default function DLRequestBrief({
  plan,
  items,
}: {
  plan: DLPlan;
  items: Item[];
}) {
  const brief = dlRequestBrief(plan, items);
  return (
    <details className="dl-request-brief">
      <summary>Informações para gerar a requisição no MXM</summary>
      <dl className="dl-overview">
        <dt>DL / objeto</dt>
        <dd>
          {brief.code} · {brief.title}
        </dd>
        <dt>Observação / Justificativa</dt>
        <dd style={{ whiteSpace: "pre-wrap" }}>
          {brief.observation || "Não informada"}
        </dd>
        <dt>Data de entrega</dt>
        <dd>
          {brief.deliveryDate
            ? brief.deliveryDate.split("-").reverse().join("/")
            : "A definir"}
        </dd>
        <dt>Responsável</dt>
        <dd>{brief.responsible || "Não informado"}</dd>
      </dl>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Código MXM</th>
              <th>Material</th>
              <th>Quantidade</th>
              <th>Unidade</th>
              <th>Especificação técnica</th>
            </tr>
          </thead>
          <tbody>
            {brief.items.map((item) => (
              <tr key={item.itemId}>
                <td>{item.code}</td>
                <td>{item.description}</td>
                <td>{decimalInput(item.quantityMilli, 3) || "A definir"}</td>
                <td>{item.unit}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>
                  {item.technicalSpecification || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">
        Resumo dos dados salvos. Salve alterações antes de usar estas
        informações. A requisição é executada no MXM; nenhuma tarefa foi enviada
        por esta tela.
      </p>
    </details>
  );
}
