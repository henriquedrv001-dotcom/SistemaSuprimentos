import { useEffect, useId, useRef, useState } from "react";
import type { DLPlan } from "../types/dl";
import type { movementSources } from "../services/dlMovement";
import FilterSearch from "./ui/FilterSearch";
import FilterSelect from "./ui/FilterSelect";

type Props = {
  plans: DLPlan[];
  sources: ReturnType<typeof movementSources>;
  selectedIds: string[];
  supplier: string;
  onClose: () => void;
  onApply: (ids: string[], supplier: string) => boolean;
};
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
/** Uma seleção provisória: somente Aplicar altera a distribuição em edição. */
export default function DLMovementPlanPicker({
  plans,
  sources,
  selectedIds,
  supplier,
  onClose,
  onApply,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const descriptionId = useId();
  const [pending, setPending] = useState([...selectedIds]);
  const [chosenSupplier, setChosenSupplier] = useState(supplier);
  const [query, setQuery] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const suppliers = (ids: string[]) =>
    ids.length
      ? [
          ...new Set(
            sources
              .filter((row) => ids.includes(row.plan.id))
              .map((row) => row.origin.supplier),
          ),
        ].filter((name) =>
          ids.every((id) =>
            sources.some(
              (row) => row.plan.id === id && row.origin.supplier === name,
            ),
          ),
        )
      : [];
  const common = suppliers(pending);
  function update(ids: string[]) {
    const options = suppliers(ids);
    setPending(ids);
    setChosenSupplier(
      options.includes(chosenSupplier)
        ? chosenSupplier
        : options.length === 1
          ? options[0]
          : "",
    );
  }
  const visible = plans.filter((plan) =>
    fold(
      `${plan.code} ${plan.title} ${sources
        .filter((row) => row.plan.id === plan.id)
        .map((row) => row.origin.supplier)
        .join(" ")}`,
    ).includes(fold(query.trim())),
  );
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog movement-dl-dialog"
      aria-labelledby="movement-dl-title"
      onClose={onClose}
    >
      <header>
        <h2 id="movement-dl-title">Selecionar DLs</h2>
        <p>
          Marque uma ou mais DLs com saldo. Os materiais devem pertencer a um
          único fornecedor em comum.
        </p>
        <button
          className="secondary-button"
          onClick={() => ref.current?.close()}
        >
          Fechar
        </button>
      </header>
      <div className="movement-dl-dialog-filters">
        <FilterSearch
          label="Buscar DL"
          placeholder="Número, título ou fornecedor"
          value={query}
          onChange={setQuery}
        />
        <FilterSelect
          label="Fornecedor das DLs selecionadas"
          value={common.includes(chosenSupplier) ? chosenSupplier : ""}
          disabled={!pending.length}
          onChange={setChosenSupplier}
          options={[
            { value: "", label: "Selecionar fornecedor" },
            ...common.map((name) => ({ value: name, label: name })),
          ]}
        />
      </div>
      <div
        className="movement-dl-options"
        role="group"
        aria-label="DLs disponíveis"
      >
        {visible.map((plan, index) => {
          const checked = pending.includes(plan.id);
          const rows = sources.filter((row) => row.plan.id === plan.id);
          const options = suppliers([...pending, plan.id]);
          const reason = !rows.length
            ? "Sem materiais ativos com saldo disponível e vigência válida."
            : !checked && !options.length
              ? "Não possui fornecedor em comum com as DLs marcadas. Desmarque as outras para escolher esta DL."
              : "";
          return (
            <label
              key={plan.id}
              className={`movement-dl-option${checked ? " is-selected" : ""}`}
            >
              <input
                className="ui-checkbox"
                type="checkbox"
                aria-label={`Selecionar ${plan.code} · ${plan.title}`}
                aria-describedby={`${descriptionId}-${index}-supplier${reason ? ` ${descriptionId}-${index}-reason` : ""}`}
                checked={checked}
                disabled={!checked && !!reason}
                onChange={(event) =>
                  update(
                    event.target.checked
                      ? [...pending, plan.id]
                      : pending.filter((id) => id !== plan.id),
                  )
                }
              />
              <span>
                <strong>
                  {plan.code} · {plan.title}
                </strong>
                <small id={`${descriptionId}-${index}-supplier`}>
                  Fornecedores com saldo:{" "}
                  {[...new Set(rows.map((row) => row.origin.supplier))].join(
                    ", ",
                  ) || "Nenhum disponível"}
                </small>
                {reason && (
                  <small
                    id={`${descriptionId}-${index}-reason`}
                    className="movement-dl-reason"
                  >
                    {reason}
                  </small>
                )}
              </span>
            </label>
          );
        })}
        {!visible.length && (
          <p className="empty-state">Nenhuma DL corresponde à busca.</p>
        )}
      </div>
      <footer>
        <span role="status">
          {pending.length}{" "}
          {pending.length === 1 ? "DL selecionada" : "DLs selecionadas"}
        </span>
        <div>
          <button
            className="primary-button"
            disabled={pending.length > 0 && !common.includes(chosenSupplier)}
            onClick={() => {
              if (onApply(pending, pending.length ? chosenSupplier : ""))
                ref.current?.close();
            }}
          >
            Aplicar seleção
          </button>
        </div>
      </footer>
    </dialog>
  );
}
