import { useEffect, useMemo, useRef, useState } from "react";
import type { CycleRequestGroup, Item } from "../types";
import { Search } from "lucide-react";
import FilterSelect from "./ui/FilterSelect";
import FilterSearch from "./ui/FilterSearch";
import "./DLMaterialPicker.css";
export default function CycleItemPicker({
  context = "cycle",
  items,
  existingIds,
  groups,
  defaultGroupId,
  onAdd,
  onClose,
}: {
  context?: "cycle" | "dl";
  items: Item[];
  existingIds: string[];
  groups: CycleRequestGroup[];
  defaultGroupId: string | null;
  onAdd: (ids: string[], groupId: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const selectAll = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [group, setGroup] = useState("");
  const [destination, setDestination] = useState(defaultGroupId ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
    if (context === "dl") {
      ref.current
        ?.querySelector<HTMLInputElement>('input[type="search"]')
        ?.focus();
    }
  }, []);
  const available = useMemo(() => {
    const existing = new Set(existingIds);
    return items.filter(
      (item) => item.active !== false && !existing.has(item.id),
    );
  }, [items, existingIds]);
  const types = useMemo(
    () =>
      [...new Set(available.map((item) => item.type || "SEM TIPO"))].sort(
        (a, b) => a.localeCompare(b, "pt-BR"),
      ),
    [available],
  );
  const groupsMXM = useMemo(
    () =>
      [
        ...new Set(
          available
            .filter((item) => !type || item.type === type)
            .map((item) => item.group),
        ),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [available, type],
  );
  const filtered = useMemo(
    () =>
      available
        .filter(
          (item) =>
            (!type || item.type === type) &&
            (!group || item.group === group) &&
            `${item.code} ${item.description} ${item.group}`
              .toLocaleLowerCase("pt-BR")
              .includes(query.trim().toLocaleLowerCase("pt-BR")),
        )
        .sort((a, b) => a.description.localeCompare(b.description, "pt-BR")),
    [available, type, group, query],
  );
  useEffect(() => {
    setPage(0);
    const ids = new Set(filtered.map((item) => item.id));
    setSelected((current) => {
      const next = current.filter((id) => ids.has(id));
      return next.length === current.length ? current : next;
    });
  }, [filtered]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  const allSelected =
    !!filtered.length && filtered.every((item) => selected.includes(item.id));
  useEffect(() => {
    if (selectAll.current && context === "dl") {
      selectAll.current.indeterminate = selected.length > 0 && !allSelected;
    }
  }, [context, selected, allSelected]);
  const addButton = (
    <button
      className="primary-button"
      disabled={!selected.length}
      onClick={() => {
        try {
          onAdd(selected, destination || null);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível adicionar.",
          );
        }
      }}
    >
      Adicionar selecionados ({selected.length})
    </button>
  );
  return (
    <dialog
      className="item-edit-dialog cycle-picker-dialog"
      data-context={context}
      ref={ref}
      aria-labelledby="cycle-picker-title"
      onClose={onClose}
    >
      <div className="panel-heading">
        <div>
          <h2 id="cycle-picker-title">
            Adicionar materiais {context === "dl" ? "à DL" : "ao ciclo"}
          </h2>
          <p>
            Materiais ativos do cadastro MXM. Itens já incluídos não aparecem
            novamente.
          </p>
          {context === "dl" && error && (
            <p role="alert" className="catalog-error">
              {error}
            </p>
          )}
        </div>
        <div className="cycle-picker-heading-actions">
          <button
            className="secondary-button"
            onClick={() => ref.current?.close()}
          >
            Fechar
          </button>
          {context === "dl" && addButton}
        </div>
      </div>
      {context === "dl" ? (
        <div className="ui-filterbar dl-picker-filters">
          <FilterSearch
            label="Buscar material"
            aria-label="Buscar materiais para a DL"
            placeholder="Código, descrição ou grupo MXM"
            value={query}
            onChange={setQuery}
          />
          <FilterSelect
            label="Tipo MXM"
            value={type}
            onChange={(value) => {
              setType(value);
              setGroup("");
            }}
            options={[
              { value: "", label: "Todos" },
              ...types.map((value) => ({ value, label: value })),
            ]}
          />
          <FilterSelect
            label="Grupo MXM"
            value={group}
            onChange={setGroup}
            options={[
              { value: "", label: "Todos" },
              ...groupsMXM.map((value) => ({ value, label: value })),
            ]}
          />
        </div>
      ) : (
        <>
          <label className="catalog-search cycle-picker-search">
            <Search size={16} />
            <input
              aria-label="Buscar materiais para o ciclo"
              placeholder="Buscar código, descrição ou grupo MXM"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="form-grid">
            <label>
              Tipo MXM
              <select
                aria-label="Tipo MXM"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setGroup("");
                }}
              >
                <option value="">Todos</option>
                {types.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Grupo MXM
              <select
                aria-label="Grupo MXM"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              >
                <option value="">Todos</option>
                {groupsMXM.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            {context === "cycle" && (
              <label>
                Adicionar no grupo de solicitação
                <select
                  aria-label="Adicionar no grupo de solicitação"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="">Sem grupo</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </>
      )}
      <div className="cycle-picker-summary">
        <label
          className="select-all-label"
          title="Seleciona todos os resultados da busca, incluindo outras páginas."
        >
          <input
            ref={selectAll}
            type="checkbox"
            className={context === "dl" ? "ui-checkbox" : undefined}
            checked={allSelected}
            onChange={(e) =>
              setSelected(
                e.target.checked ? filtered.map((item) => item.id) : [],
              )
            }
          />
          Selecionar resultados ({filtered.length})
        </label>
        <span aria-live="polite">{selected.length} selecionados</span>
      </div>
      <div className="table-wrap cycle-picker-table">
        <table>
          {context === "dl" && (
            <colgroup>
              <col className="dl-picker-check" />
              <col className="dl-picker-code" />
              <col className="dl-picker-description" />
              <col className="dl-picker-unit" />
              <col className="dl-picker-group" />
            </colgroup>
          )}
          <thead>
            <tr>
              <th>
                {context === "dl" ? (
                  <span className="sr-only">Selecionar</span>
                ) : (
                  "Selecionar"
                )}
              </th>
              <th>Código</th>
              <th>Descrição</th>
              <th>Unidade</th>
              <th>Grupo MXM</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(page * 50, (page + 1) * 50).map((item) => (
              <tr
                key={item.id}
                data-selected={
                  context === "dl" ? selected.includes(item.id) : undefined
                }
              >
                <td>
                  <input
                    type="checkbox"
                    className={context === "dl" ? "ui-checkbox" : undefined}
                    aria-label={`Adicionar ${item.code}`}
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      setSelected((current) =>
                        e.target.checked
                          ? [...current, item.id]
                          : current.filter((id) => id !== item.id),
                      )
                    }
                  />
                </td>
                <td>{item.code}</td>
                <td>{item.description}</td>
                <td>{item.unit}</td>
                <td>{item.group}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={5} className="empty-state">
                  Nenhum material disponível para esta busca.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="cycle-pagination">
        <button
          className="secondary-button"
          disabled={!page}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </button>
        <span role="status">
          Página {page + 1} de {pageCount}
        </span>
        <button
          className="secondary-button"
          disabled={page >= pageCount - 1}
          onClick={() => setPage(page + 1)}
        >
          Próxima
        </button>
      </div>
      {context === "cycle" && error && (
        <p role="alert" className="catalog-error">
          {error}
        </p>
      )}
      {context === "cycle" && (
        <div className="form-actions">
          <button className="secondary-button" onClick={onClose}>
            Cancelar
          </button>
          {addButton}
        </div>
      )}
    </dialog>
  );
}
