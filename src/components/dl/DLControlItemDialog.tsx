import { useEffect, useRef, useState } from "react";
import { X, Info } from "lucide-react";
import type { DLControlRow } from "../../services/dlControl";
import { decimalInput, formatMoney } from "../../services/dlPlanning";
import type { OrderWorkspace, DLManualDebitInput } from "../../types/orders";
import DLManualDebitDialog from "./DLManualDebitDialog";
export default function DLControlItemDialog({
  row,
  onClose,
  onOpenDL,
  orders,
  onManualDebit,
}: {
  row: DLControlRow;
  onClose: () => void;
  onOpenDL: (id: string) => void;
  orders?: OrderWorkspace;
  onManualDebit?: (input: DLManualDebitInput) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [manualDebit, setManualDebit] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const { plan, origin, item } = row;
  const movements = (orders?.orders || [])
    .filter(
      (order) =>
        order.kind === "PDL" &&
        order.lines.some(
          (line) => line.planId === plan.id && line.originId === origin.id,
        ),
    )
    .flatMap((order) => {
      const line = order.lines.find(
        (line) => line.planId === plan.id && line.originId === origin.id,
      )!;
      return order.events
        .filter((event) =>
          [
            "Rascunho salvo",
            "Pedido aprovado",
            "Envio registrado",
            "Recebimento registrado",
            "Pedido cancelado",
            "Devolvido para correção",
          ].includes(event.action),
        )
        .map((event) => ({
          id: event.id,
          timestamp: event.timestamp,
          label: `${order.code || `Rascunho ${order.id.slice(0, 8)}`} · ${event.action === "Rascunho salvo" ? "Reserva atualizada" : event.action}`,
          quantity: event.quantities
            ? event.quantities.find((quantity) => quantity.lineId === line.id)
                ?.quantityMilli || 0
            : null,
        }));
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const date = (value?: string) =>
    value ? value.split("-").reverse().join("/") : "Não informada";
  const manualMovements = (orders?.adjustments || []).filter(
    (adjustment) =>
      adjustment.planId === plan.id && adjustment.originId === origin.id,
  );
  return (
    <>
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
              <dt>Requisição MXM</dt>
              <dd>{plan.request.mxmNumber || "Não informada"}</dd>
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
              <dt>Recebido em pedidos locais</dt>
              <dd>
                {decimalInput(origin.receivedMilli, 3)} {origin.unit}
              </dd>
            </div>
            <div>
              <dt>Reservado em pedidos locais</dt>
              <dd>
                {decimalInput(origin.reservedMilli, 3)} {origin.unit}
              </dd>
            </div>
            <div>
              <dt>Baixas manuais</dt>
              <dd>
                {decimalInput(origin.manualDebitedMilli || 0, 3)} {origin.unit}
              </dd>
            </div>
            <div>
              <dt>Saldo disponível</dt>
              <dd className="dl-control-item-balance-value">
                {decimalInput(origin.availableMilli, 3)} {origin.unit}
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
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{date(movement.timestamp.slice(0, 10))}</td>
                      <td>{movement.label}</td>
                      <td>
                        {movement.quantity === null
                          ? "—"
                          : `${decimalInput(movement.quantity, 3)} ${origin.unit}`}
                      </td>
                    </tr>
                  ))}
                  {manualMovements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{date(movement.timestamp.slice(0, 10))}</td>
                      <td>
                        Baixa manual · {movement.actor}
                        <small>{movement.reason}</small>
                      </td>
                      <td>
                        {decimalInput(movement.quantityMilli, 3)} {origin.unit}
                      </td>
                    </tr>
                  ))}
                  {!movements.length && !manualMovements.length && (
                    <tr>
                      <td colSpan={3} className="empty-state">
                        Nenhuma movimentação local registrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p>
              O disponível desconta os recebimentos, as reservas dos pedidos DLs
              e as baixas manuais locais. Movimentações externas ao protótipo
              não estão integradas ao MXM. Esta consulta não altera o saldo.
            </p>
          </section>
        </div>
        <footer className="dl-control-item-footer">
          {onManualDebit && (
            <button
              className="secondary-button"
              disabled={origin.availableMilli <= 0}
              onClick={() => setManualDebit(true)}
            >
              Baixa manual
            </button>
          )}
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
      {manualDebit && onManualDebit && (
        <DLManualDebitDialog
          row={row}
          onSave={onManualDebit}
          onClose={() => setManualDebit(false)}
        />
      )}
    </>
  );
}
