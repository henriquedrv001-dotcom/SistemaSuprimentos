import { useEffect, useRef, useState } from "react";
import type {
  CyclePlanningLine,
  CycleRequestGroup,
  Item,
  SupplyCycle,
} from "../types";

export function CycleForm({
  cycle,
  onSave,
  onClose,
}: {
  cycle?: SupplyCycle;
  onSave: (draft: Omit<SupplyCycle, "id">, id?: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<Omit<SupplyCycle, "id">>(
    cycle ?? {
      name: "",
      solicitationStart: "",
      firstDelivery: "",
      lastDelivery: "",
      closingDate: "",
      status: "Planejamento",
    },
  );
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog"
      aria-labelledby="cycle-form-title"
      onClose={onClose}
    >
      <div className="panel-heading">
        <div>
          <h2 id="cycle-form-title">{cycle ? "Editar ciclo" : "Novo ciclo"}</h2>
          <p>Vários ciclos podem ficar abertos ao mesmo tempo.</p>
        </div>
        <button className="secondary-button" onClick={onClose}>
          Fechar
        </button>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onSave(draft, cycle?.id);
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Não foi possível salvar.",
            );
          }
        }}
      >
        <div className="form-grid">
          <label>
            Nome do ciclo
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ex.: Novembro 2026"
            />
          </label>
          <label>
            Situação do ciclo
            <select
              aria-label="Situação do ciclo"
              value={draft.status}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  status: e.target.value as SupplyCycle["status"],
                })
              }
            >
              <option>Planejamento</option>
              <option>Em execução</option>
              <option>Encerrado</option>
            </select>
          </label>
          {(
            [
              { key: "solicitationStart", label: "Início das solicitações" },
              { key: "firstDelivery", label: "Primeira entrega prevista" },
              { key: "lastDelivery", label: "Última entrega prevista" },
              { key: "closingDate", label: "Fechamento previsto" },
            ] as const
          ).map((field) => (
            <label key={field.key}>
              {field.label}
              <input
                required
                type="date"
                value={draft[field.key]}
                onChange={(e) =>
                  setDraft({ ...draft, [field.key]: e.target.value })
                }
              />
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="catalog-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary-button">
            {cycle ? "Salvar ciclo" : "Criar ciclo"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function CycleLineForm({
  line,
  item,
  groups,
  onSave,
  onClose,
}: {
  line: CyclePlanningLine;
  item: Item | undefined;
  groups: CycleRequestGroup[];
  onSave: (line: CyclePlanningLine) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [quantity, setQuantity] = useState(
    line.plannedQuantity === null ? "" : String(line.plannedQuantity),
  );
  const [group, setGroup] = useState(line.requestGroupId ?? "");
  const [basis, setBasis] = useState(line.forecastBasis);
  const [notes, setNotes] = useState(line.notes);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog"
      aria-labelledby="cycle-line-title"
      onClose={onClose}
    >
      <div className="panel-heading">
        <div>
          <h2 id="cycle-line-title">Planejar material</h2>
          <p>
            {item?.code ?? line.itemId} ·{" "}
            {item?.description ?? "Material ausente no cadastro"}
          </p>
        </div>
        <button className="secondary-button" onClick={onClose}>
          Fechar
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const value = quantity.trim();
            if (value && !/^\d+(?:[.,]\d+)?$/.test(value))
              throw new Error(
                "Informe uma quantidade válida, por exemplo 150 ou 2,5.",
              );
            onSave({
              ...line,
              plannedQuantity: value ? Number(value.replace(",", ".")) : null,
              requestGroupId: group || null,
              forecastBasis: basis,
              notes,
            });
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Não foi possível salvar.",
            );
          }
        }}
      >
        <div className="form-grid">
          <label>
            Necessidade prevista ({item?.unit ?? "unidade"})
            <input
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="A definir"
            />
          </label>
          <label>
            Grupo de solicitação
            <select
              aria-label="Grupo de solicitação"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="">Sem grupo</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Base da previsão
            <select
              aria-label="Base da previsão"
              value={basis}
              onChange={(e) =>
                setBasis(e.target.value as CyclePlanningLine["forecastBasis"])
              }
            >
              <option value="">Não informada</option>
              <option>Estimativa</option>
              <option>Consumo anterior</option>
              <option>Demanda do setor</option>
            </select>
          </label>
          <label className="item-specification-field">
            Observação da necessidade
            <textarea
              aria-label="Observação da necessidade"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: previsão maior por evento neste período"
            />
          </label>
        </div>
        <p className="form-note">
          Em branco significa “A definir”. Zero significa que não há necessidade
          prevista. Este planejamento não altera o estoque do ERP.
        </p>
        {error && (
          <p role="alert" className="catalog-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="primary-button">
            Salvar necessidade
          </button>
        </div>
      </form>
    </dialog>
  );
}
