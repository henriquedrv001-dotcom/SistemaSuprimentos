import { useEffect, useRef } from "react";
import { X, Info } from "lucide-react";
import type { DLControlRow } from "../../services/dlControl";
import { decimalInput, formatMoney } from "../../services/dlPlanning";
export default function DLControlItemDialog({
  row,
  onClose,
  onOpenDL,
}: {
  row: DLControlRow;
  onClose: () => void;
  onOpenDL: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const { plan, origin, item } = row;
  const date = (value?: string) =>
    value ? value.split("-").reverse().join("/") : "Não informada";
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog dl-control-item-dialog"
      aria-labelledby="dl-control-item-title"
      onClose={onClose}
    >
      <header className="dl-control-item-heading">
        <div>
          <h2 id="dl-control-item-title">
            {item?.description || "Cadastro indisponível"}
          </h2>
          <p>Código MXM: {item?.code || origin.itemId}</p>
          <p>
            {plan.code} · {plan.title}
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Fechar dados do item"
          onClick={() => ref.current?.close()}
        >
          <X size={18} />
        </button>
      </header>
      <div className="dl-control-item-body">
        <dl className="dl-control-item-facts">
          <div>
            <dt>Quantidade contratada</dt>
            <dd>
              {decimalInput(origin.quantityMilli, 3)} {origin.unit}
            </dd>
          </div>
          <div>
            <dt>Valor unitário</dt>
            <dd>{formatMoney(origin.unitPriceCents)}</dd>
          </div>
          <div>
            <dt>Fornecedor</dt>
            <dd>{origin.supplier}</dd>
          </div>
          <div>
            <dt>Pedido MXM</dt>
            <dd>{origin.mxmOrder}</dd>
          </div>
          <div>
            <dt>Contratação / emissão do pedido</dt>
            <dd>{date(plan.contract?.signedOn)}</dd>
          </div>
          <div>
            <dt>Vigência da contratação</dt>
            <dd>
              {plan.contract?.validFrom && plan.contract.validUntil
                ? `${date(plan.contract.validFrom)} a ${date(plan.contract.validUntil)}`
                : plan.contract?.validFrom
                  ? `A partir de ${date(plan.contract.validFrom)}`
                  : plan.contract?.validUntil
                    ? `Até ${date(plan.contract.validUntil)}`
                    : "Não informada"}
            </dd>
          </div>
          {item?.technicalSpecification && (
            <div className="dl-item-fact-full">
              <dt>Especificação técnica</dt>
              <dd>{item.technicalSpecification}</dd>
            </div>
          )}
          <div>
            <dt>Saldo</dt>
            <dd className="dl-control-item-balance-value">
              {decimalInput(origin.remainingMilli, 3)} {origin.unit}
            </dd>
          </div>
        </dl>
        <section className="dl-control-item-movements">
          <div className="dl-control-movements-heading">
            <h3>Movimentações</h3>
            <span>
              <Info size={13} aria-hidden="true" />
              Consulta da origem do saldo
            </span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Movimento</th>
                  <th>Quantidade</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="empty-state">
                    Nenhuma movimentação integrada.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            O saldo exibido é o saldo inicial contratado. Reservas, baixas e
            recebimentos ainda não estão conectados. Esta consulta não altera o
            saldo.
          </p>
        </section>
      </div>
      <footer className="dl-control-item-footer">
        <button
          className="secondary-button"
          onClick={() => ref.current?.close()}
        >
          Fechar
        </button>
        <button className="primary-button" onClick={() => onOpenDL(plan.id)}>
          Consultar DL
        </button>
      </footer>
    </dialog>
  );
}
