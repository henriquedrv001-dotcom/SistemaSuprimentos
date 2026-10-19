import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type {
  DLControlAlert,
  DLControlAlertGroup,
} from "../../services/dlControl";
import { decimalInput } from "../../services/dlPlanning";
import { contractStatus } from "../../services/dlContract";
import "../ui/InterfaceModels.css";

export default function DLControlAlertDialog({
  kind,
  groups,
  limit,
  today,
  onClose,
  onOpen,
}: {
  kind: DLControlAlert;
  groups: DLControlAlertGroup[];
  limit: number;
  today: string;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const count = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const title =
    kind === "lowBalance"
      ? "DLs com saldo próximo ao fim"
      : kind === "zeroBalance"
        ? "Itens com saldo zerado"
        : "DLs vencendo em até 30 dias";
  const rule =
    kind === "lowBalance"
      ? `DLs com pelo menos um item com saldo positivo de até ${limit}% da quantidade contratada. Saldos zerados são contados separadamente.`
      : kind === "zeroBalance"
        ? "Itens contratados cujo saldo exibido é zero, agrupados por DL."
        : "DLs cuja vigência termina entre hoje e os próximos 30 dias.";
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog dl-control-alert-dialog ui-data-dialog"
      aria-labelledby="dl-control-alert-title"
      onClose={onClose}
    >
      <header className="dl-control-alert-heading ui-data-dialog-heading">
        <div>
          <h2 id="dl-control-alert-title">{title}</h2>
          <p>{rule}</p>
        </div>
        <button
          className="icon-button"
          aria-label="Fechar detalhes do indicador"
          onClick={() => ref.current?.close()}
        >
          <X size={18} />
        </button>
      </header>
      <div className="dl-control-alert-body ui-data-dialog-body">
        <p className="muted">
          {groups.length} DL(s) · {count} item(ns). Indicadores consideram todos
          os itens do Controle, independentemente dos filtros.
        </p>
        {!groups.length && (
          <p className="empty-state">
            {kind === "zeroBalance"
              ? "Nenhum item com saldo zerado."
              : "Nenhuma DL se enquadra neste indicador."}
          </p>
        )}
        {groups.map(({ plan, rows }) => (
          <section key={plan.id} className="dl-control-alert-group">
            <div className="dl-control-alert-group-heading">
              <div>
                <h3>
                  {plan.code} · {plan.title}
                </h3>
                <p>
                  {contractStatus(plan, today)} · {rows.length} item(ns)
                  {kind === "expiring" && plan.contract?.validUntil
                    ? ` · Vence em ${plan.contract.validUntil.split("-").reverse().join("/")}`
                    : ""}
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={() => onOpen(plan.id)}
              >
                Abrir {plan.code}
              </button>
            </div>
            <div
              className="table-wrap"
              role="region"
              aria-label={`Itens de ${plan.code}`}
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Item / fornecedor</th>
                    <th scope="col">Contratado</th>
                    <th scope="col">Saldo</th>
                    <th scope="col">Saldo (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ origin, item }) => (
                    <tr key={origin.id}>
                      <td>
                        <strong>
                          {item?.description || "Cadastro indisponível"}
                        </strong>
                        <small>
                          {item?.code || origin.itemId} · {origin.supplier} ·
                          MXM {origin.mxmOrder}
                        </small>
                      </td>
                      <td>
                        {decimalInput(origin.quantityMilli, 3)} {origin.unit}
                      </td>
                      <td>
                        {decimalInput(origin.availableMilli, 3)} {origin.unit}
                      </td>
                      <td>
                        {origin.quantityMilli > 0
                          ? `${((origin.availableMilli * 100) / origin.quantityMilli).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
      <footer className="dl-control-alert-footer ui-data-dialog-footer">
        <button
          className="secondary-button"
          onClick={() => ref.current?.close()}
        >
          Fechar
        </button>
      </footer>
    </dialog>
  );
}
