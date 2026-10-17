import { useEffect, useRef, useState } from "react";
import type { DLPlan } from "../../types/dl";
import type { Item } from "../../types";
import {
  contractTotal,
  contractedQuantity,
  validateDLContract,
} from "../../services/dlContract";
import {
  decimalInput,
  formatMoney,
  planBudget,
} from "../../services/dlPlanning";
export default function DLReleaseDialog({
  plan,
  items,
  onConfirm,
  onClose,
}: {
  plan: DLPlan;
  items: Item[];
  onConfirm: (checked: boolean, confirmed: boolean) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const contract = plan.contract!;
  const budget = planBudget(plan.lines).totalCents;
  const total = contractTotal(contract).totalCents;
  let validation = "";
  try {
    validateDLContract(plan, true);
  } catch (cause) {
    validation =
      cause instanceof Error ? cause.message : "Revise os dados finais.";
  }
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog dl-release-dialog"
      aria-labelledby="dl-release-title"
      onClose={onClose}
    >
      <header className="dl-release-heading">
        <h2 id="dl-release-title">
          Concluir {plan.code} e disponibilizar no Controle
        </h2>
        <p>
          Confira os dados oficiais antes de criar os saldos iniciais. Depois da
          conclusão, os valores ficam protegidos.
        </p>
      </header>
      <div className="dl-release-body">
        <div className="dl-contract-summary">
          <div>
            <span>Previsto</span>
            <strong>{formatMoney(budget)}</strong>
          </div>
          <div>
            <span>Contratado</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div>
            <span>Diferença</span>
            <strong>{formatMoney(total - budget)}</strong>
          </div>
        </div>
        <div className="table-wrap">
          <table className="dl-release-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Previsto</th>
                <th>Contratado</th>
                <th>Fornecedor / pedido MXM</th>
              </tr>
            </thead>
            <tbody>
              {plan.lines.map((line) => {
                const item = items.find((item) => item.id === line.itemId);
                const award = contract.awards.find(
                  (award) => award.lineId === line.id,
                );
                return (
                  <tr key={line.id}>
                    <td>
                      <strong>{item?.code || line.itemId}</strong>
                      <small className="dl-release-material">
                        {item?.description || "Cadastro indisponível"}
                      </small>
                    </td>
                    <td>
                      {decimalInput(line.quantityMilli, 3)} {line.unit}
                    </td>
                    <td>
                      {award
                        ? `${decimalInput(contractedQuantity(contract, line.id), 3)} ${line.unit}`
                        : "Não contratado"}
                    </td>
                    <td className="dl-release-supplier">
                      {award
                        ? `${award.supplier} · ${award.mxmOrder}`
                        : contract.notAwarded.find(
                            (result) => result.lineId === line.id,
                          )?.reason || "A definir"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Diferenças de quantidade e valor são permitidas e ficam registradas.
          Reservas, recebimentos e pedidos serão conectados na etapa seguinte.
        </p>
        <div className="dl-release-confirmation">
          <label className="select-all-label">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            Conferi os dados finais e confirmo que os pedidos de compra MXM
            foram emitidos.
          </label>
          {!checked && (
            <p className="muted" role="status">
              Marque a conferência dos dados finais para continuar.
            </p>
          )}
        </div>
        {(validation || error) && (
          <p className="catalog-error" role="alert">
            {validation || error}
          </p>
        )}
      </div>
      <footer className="form-actions dl-release-actions">
        <button className="secondary-button" autoFocus onClick={onClose}>
          Cancelar
        </button>
        <button
          className="primary-button"
          disabled={!checked || !!validation}
          onClick={() => {
            try {
              if (
                window.confirm(
                  `Concluir ${plan.code} e disponibilizar no Controle? Os saldos iniciais serão registrados e os dados finais ficarão protegidos.`,
                )
              )
                onConfirm(checked, true);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Não foi possível concluir.",
              );
            }
          }}
        >
          Concluir DL
        </button>
      </footer>
    </dialog>
  );
}
