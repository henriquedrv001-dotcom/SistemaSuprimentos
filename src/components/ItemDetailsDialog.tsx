import { contractOrigins } from "../services/dlContract";
import type { DLPlan } from "../types/dl";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type {
  CyclePlanningLine,
  Item,
  ItemHistoryEntry,
  SupplyCycle,
} from "../types";

type Tab = "edit" | "links" | "history";
const tabs: { id: Tab; label: string }[] = [
  { id: "edit", label: "Edição" },
  { id: "links", label: "Pedidos e DLs" },
  { id: "history", label: "Histórico" },
];

type Props = {
  busy?: boolean;
  dlPlans?: DLPlan[];
  item: Item;
  history: ItemHistoryEntry[];
  cycleItems: CyclePlanningLine[];
  cycles: SupplyCycle[];
  onChange: (item: Item) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function ItemDetailsDialog({
  item,
  history,
  cycleItems,
  cycles,
  dlPlans = [],
  busy = false,
  onChange,
  onSave,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>("edit");
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  const events = history
    .filter((entry) => entry.itemId === item.id)
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const associations = item.associations ?? [];
  const linkedCycles = cycleItems.filter((line) => line.itemId === item.id);
  const dlOrigins = dlPlans.flatMap((plan) =>
    contractOrigins(plan)
      .filter((origin) => origin.itemId === item.id)
      .map((origin) => ({ ...origin, code: plan.code })),
  );

  function changeTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    setTab(tabs[next].id);
    dialogRef.current
      ?.querySelector<HTMLButtonElement>(`#item-tab-${tabs[next].id}`)
      ?.focus();
  }

  return (
    <dialog
      ref={dialogRef}
      className="edit-item-panel item-edit-dialog"
      aria-labelledby="edit-item-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <div className="item-detail-heading">
        <div>
          <h2 id="edit-item-title">Item {item.code}</h2>
          <p className="muted">{item.description}</p>
        </div>
        <div className="item-detail-controls">
          <div
            className={`item-status-control ${item.active !== false ? "is-active" : ""}`}
          >
            <span>{item.active !== false ? "Ativo" : "Inativo"}</span>
            <button
              type="button"
              role="switch"
              aria-label="Item ativo"
              aria-checked={item.active !== false}
              className={`item-status-switch ${item.active !== false ? "is-active" : ""}`}
              onClick={() =>
                onChange({ ...item, active: item.active === false })
              }
            >
              <span className="switch-track" aria-hidden="true">
                <span />
              </span>
            </button>
          </div>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
      <div
        className="tabs item-detail-tabs"
        role="tablist"
        aria-label="Informações do item"
      >
        {tabs.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            id={`item-tab-${entry.id}`}
            aria-controls={`item-panel-${entry.id}`}
            aria-selected={tab === entry.id}
            tabIndex={tab === entry.id ? 0 : -1}
            className={`tab ${tab === entry.id ? "active" : ""}`}
            onClick={() => setTab(entry.id)}
            onKeyDown={(event) => changeTab(event, index)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onSave();
        }}
      >
        <fieldset className="catalog-edit-fields" disabled={busy}>
          <section
            role="tabpanel"
            id="item-panel-edit"
            aria-labelledby="item-tab-edit"
            hidden={tab !== "edit"}
          >
            <div className="form-grid">
              <label>
                Código MXM
                <input
                  value={item.code}
                  onChange={(e) =>
                    onChange({ ...item, code: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label>
                Descrição
                <input
                  value={item.description}
                  onChange={(e) =>
                    onChange({
                      ...item,
                      description: e.target.value.toUpperCase(),
                    })
                  }
                />
              </label>
              <label>
                Unidade
                <input
                  value={item.unit}
                  onChange={(e) =>
                    onChange({ ...item, unit: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label>
                Tipo
                <input
                  value={item.type || "SEM TIPO"}
                  onChange={(e) =>
                    onChange({ ...item, type: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label>
                Grupo
                <input
                  value={item.group}
                  onChange={(e) =>
                    onChange({ ...item, group: e.target.value.toUpperCase() })
                  }
                />
              </label>
              <label>
                Critério
                <select
                  value={item.criterion}
                  onChange={(e) =>
                    onChange({
                      ...item,
                      criterion: e.target.value as Item["criterion"],
                    })
                  }
                >
                  <option>Mensal</option>
                  <option>Entrada e saída</option>
                  <option>Sob solicitação</option>
                </select>
              </label>
              <label className="item-specification-field">
                <span id="item-specification-label">
                  Especificação técnica (opcional)
                </span>
                <textarea
                  aria-labelledby="item-specification-label"
                  rows={5}
                  value={item.technicalSpecification ?? ""}
                  placeholder="Descreva as características e os requisitos técnicos usados nos processos."
                  onChange={(e) =>
                    onChange({
                      ...item,
                      technicalSpecification: e.target.value,
                    })
                  }
                />
              </label>
            </div>
          </section>
          <section
            role="tabpanel"
            id="item-panel-links"
            aria-labelledby="item-tab-links"
            hidden={tab !== "links"}
            tabIndex={0}
          >
            <h3>Pedidos e DLs associados</h3>
            <p className="muted">
              Cada origem aparece separadamente, com sua referência MXM e seu
              saldo.
            </p>
            <div className="table-wrap item-links-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">PDL / processo</th>
                    <th scope="col">Pedido</th>
                    <th scope="col">Item</th>
                    <th scope="col">Pedido MXM</th>
                    <th scope="col">Fornecedor</th>
                    <th scope="col" className="numeric-cell">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {associations.map((link) => (
                    <tr key={link.id}>
                      <td>{link.processNumber || "—"}</td>
                      <td>{link.orderNumber || "—"}</td>
                      <td>{item.description}</td>
                      <td>{link.erpOrderNumber || "—"}</td>
                      <td>{link.supplierName || "—"}</td>
                      <td className="numeric-cell">
                        {link.availableBalance == null
                          ? "Não informado"
                          : `${link.availableBalance.toLocaleString("pt-BR")} ${link.unit || item.unit}`}
                      </td>
                    </tr>
                  ))}
                  {dlOrigins.map((origin) => (
                    <tr key={origin.id}>
                      <td>{origin.code}</td>
                      <td>Contratação concluída</td>
                      <td>{item.description}</td>
                      <td>{origin.mxmOrder}</td>
                      <td>{origin.supplier}</td>
                      <td className="numeric-cell">
                        {(origin.quantityMilli / 1000).toLocaleString("pt-BR")}{" "}
                        {origin.unit} (inicial)
                      </td>
                    </tr>
                  ))}
                  {associations.length === 0 && dlOrigins.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        Nenhum pedido ou DL associado a este item.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="form-note">
              Contratações concluídas exibem o saldo inicial. Reservas e
              recebimentos dos pedidos ainda serão conectados. Nenhum saldo é
              alterado nesta janela.
            </p>
            <h3 className="item-related-heading">
              Planejamentos de DL associados
            </h3>
            {dlPlans.filter((plan) =>
              plan.lines.some((line) => line.itemId === item.id),
            ).length ? (
              <ul className="item-cycle-links">
                {dlPlans
                  .filter((plan) =>
                    plan.lines.some((line) => line.itemId === item.id),
                  )
                  .map((plan) => {
                    const line = plan.lines.find(
                      (line) => line.itemId === item.id,
                    )!;
                    return (
                      <li key={plan.id}>
                        <strong>
                          {plan.code} · {plan.title}
                        </strong>
                        <span>
                          {plan.stage} · Planejado:{" "}
                          {line.quantityMilli === null
                            ? "A definir"
                            : `${(line.quantityMilli / 1000).toLocaleString("pt-BR")} ${line.unit}`}{" "}
                          ·{" "}
                          {plan.contract?.release
                            ? plan.contract.awards.some(
                                (award) => award.lineId === line.id,
                              )
                              ? "Contratação concluída; consulte a origem acima"
                              : "Material não contratado nesta DL"
                            : "Ainda sem saldo contratado"}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="muted">
                Nenhum planejamento de DL associado a este item.
              </p>
            )}
            <h3 className="item-related-heading">Ciclos associados</h3>
            {linkedCycles.length ? (
              <ul className="item-cycle-links">
                {linkedCycles.map((line) => (
                  <li key={line.id}>
                    <strong>
                      {cycles.find((cycle) => cycle.id === line.cycleId)
                        ?.name ?? line.cycleId}
                    </strong>
                    <span>
                      Planejado:{" "}
                      {line.plannedQuantity === null
                        ? "A definir"
                        : `${line.plannedQuantity.toLocaleString("pt-BR")} ${item.unit}`}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nenhum ciclo associado a este item.</p>
            )}
          </section>
          <section
            role="tabpanel"
            id="item-panel-history"
            aria-labelledby="item-tab-history"
            hidden={tab !== "history"}
            tabIndex={0}
          >
            <h3>Histórico deste item</h3>
            <p className="muted">
              Eventos registrados neste navegador, do mais recente para o mais
              antigo.
            </p>
            {events.length ? (
              <ol className="item-event-list">
                {events.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.action}</strong>
                    <time dateTime={entry.timestamp}>
                      {new Date(entry.timestamp).toLocaleString("pt-BR")}
                    </time>
                    <p>{entry.details}</p>
                    <small>
                      {entry.actor ? `${entry.actor} · ` : ""}Código no evento:{" "}
                      {entry.code}
                    </small>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-state">
                Ainda não há alterações registradas para este item.
              </p>
            )}
            <p className="form-note">
              Ações de inclusão ou remoção em ciclos, pedidos e DLs serão
              registradas quando essas operações forem implementadas. Alterações
              nesta janela entram no histórico ao salvar.
            </p>
          </section>
          <div className="form-actions item-detail-footer">
            <span className="muted">
              As alterações só serão aplicadas ao salvar.
            </span>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Salvar alterações
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
