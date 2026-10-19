import { useEffect, useRef } from "react";
import { X } from "lucide-react";
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
          <p>Dados do item · {plan.code}</p>
          <h2 id="dl-control-item-title">
            {item?.description || "Cadastro indisponível"}
          </h2>
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
        <div className="dl-control-item-balance">
          <span>Saldo desta contratação</span>
          <strong>
            {decimalInput(origin.remainingMilli, 3)} {origin.unit}
          </strong>
          <small>O saldo exibido ainda é o saldo inicial contratado.</small>
        </div>
        <dl className="dl-control-item-facts">
          <div>
            <dt>Código MXM</dt>
            <dd>{item?.code || origin.itemId}</dd>
          </div>
          <div>
            <dt>DL</dt>
            <dd>{plan.code}</dd>
          </div>
          <div className="dl-item-fact-full">
            <dt>Objeto da aquisição</dt>
            <dd>{plan.title}</dd>
          </div>
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
                : "Não informada"}
            </dd>
          </div>
          {item?.technicalSpecification && (
            <div className="dl-item-fact-full">
              <dt>Especificação técnica</dt>
              <dd>{item.technicalSpecification}</dd>
            </div>
          )}
        </dl>
        <section className="dl-control-item-movements">
          <h3>Saldo e movimentações</h3>
          <p>
            Esta visão identifica a origem do saldo por DL, material, fornecedor
            e pedido MXM. As baixas diretas serão registradas nesta área na
            próxima etapa.
          </p>
        </section>
      </div>
      <footer className="dl-control-item-footer">
        <button className="secondary-button" onClick={() => onOpenDL(plan.id)}>
          Consultar DL
        </button>
        <button className="primary-button" onClick={() => ref.current?.close()}>
          Fechar
        </button>
      </footer>
    </dialog>
  );
}
