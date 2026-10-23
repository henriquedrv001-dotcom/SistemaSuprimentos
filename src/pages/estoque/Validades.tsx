import { useEffect, useId, useRef, useState } from "react";
import { CalendarClock, Download, Plus, Search, Trash2 } from "lucide-react";
import type { Item } from "../../types";
import type { ExpiryLot, ExpiryWorkspace } from "../../types/expiry";
import {
  debitExpiry,
  expiryDays,
  expiryStatus,
  registerExpiryBatch,
} from "../../services/expiry";
import {
  decimalInput,
  parseScaledInput,
  todayInBrazil,
} from "../../services/dlPlanning";
import { normalizeCatalogUnit } from "../../services/catalogUnits";
import FilterSelect from "../../components/ui/FilterSelect";
import FilterSearch from "../../components/ui/FilterSearch";
import "./Validades.css";

type Props = {
  items: Item[];
  workspace: ExpiryWorkspace;
  error: string;
  initialItemId: string | null;
  onInitialConsumed: () => void;
  onCommit: (
    change: (ws: ExpiryWorkspace, items: Item[]) => ExpiryWorkspace,
  ) => void;
  onDirtyChange: (dirty: boolean) => void;
};
type Mode =
  | { kind: "new"; itemId?: string }
  | { kind: "debit" | "detail"; lotId: string };
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
const date = (s: string) => s.split("-").reverse().join("/");
export default function Validades({
  items,
  workspace,
  error,
  initialItemId,
  onInitialConsumed,
  onCommit,
  onDirtyChange,
}: Props) {
  const today = todayInBrazil();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    onDirtyChange(dirty);
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    if (dirty) window.addEventListener("beforeunload", prevent);
    return () => {
      onDirtyChange(false);
      window.removeEventListener("beforeunload", prevent);
    };
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (initialItemId) {
      setMode({ kind: "new", itemId: initialItemId });
      onInitialConsumed();
    }
  }, [initialItemId, onInitialConsumed]);
  const byId = new Map(items.map((item) => [item.id, item]));
  const visible = workspace.lots
    .filter((lot) => {
      const item = byId.get(lot.itemId);
      return (
        (!status
          ? lot.remainingMilli > 0
          : expiryStatus(lot, today) === status) &&
        fold(`${item?.description} ${item?.code} ${lot.batch}`).includes(
          fold(query.trim()),
        )
      );
    })
    .sort(
      (a, b) =>
        a.expiresOn.localeCompare(b.expiresOn) ||
        a.batch.localeCompare(b.batch),
    );
  function backup() {
    const raw = JSON.stringify(
      {
        format: "suprimentos-validades-backup-v1",
        createdAt: new Date().toISOString(),
        items,
        expiryWorkspace: workspace,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `validades-${today}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function close() {
    if (
      dirty &&
      !window.confirm("Descartar as alterações não salvas deste registro?")
    )
      return false;
    setDirty(false);
    setMode(null);
    return true;
  }
  return (
    <section className="expiry-page" aria-labelledby="expiry-title">
      <div className="page-heading">
        <div>
          <h1 id="expiry-title">Validades</h1>
          <p className="muted">
            Acompanhe os lotes dos materiais do Cadastro, do registro à baixa.
          </p>
        </div>
        <div className="expiry-actions">
          <button
            className="secondary-button"
            onClick={backup}
            disabled={!!error}
          >
            <Download size={16} /> Exportar backup
          </button>
          <button
            className="primary-button"
            onClick={() => {
              setMessage("");
              setMode({ kind: "new" });
            }}
            disabled={!!error}
          >
            <Plus size={16} /> Registrar validade
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="expiry-indicators">
        {["Vencido", "Até 7 dias", "8 a 30 dias", "Acima de 30 dias"].map(
          (label) => (
            <button
              key={label}
              className={`expiry-indicator${status === label ? " is-selected" : ""}`}
              aria-pressed={status === label}
              data-status={label}
              onClick={() =>
                setStatus((current) => (current === label ? "" : label))
              }
            >
              <span>{label === "Vencido" ? "Lotes vencidos" : label}</span>
              <strong>
                {
                  workspace.lots.filter(
                    (lot) => expiryStatus(lot, today) === label,
                  ).length
                }
              </strong>
              <small>lotes com saldo</small>
            </button>
          ),
        )}
      </div>
      <section className="expiry-list">
        <div className="expiry-list-heading">
          <div>
            <h2>Próximos vencimentos</h2>
            <p className="muted">
              {visible.length}{" "}
              {visible.length === 1 ? "lote exibido" : "lotes exibidos"} · Mais
              próximos primeiro
            </p>
          </div>
          <span className="expiry-note">
            <CalendarClock size={15} /> Vencimento de hoje ainda está no prazo
          </span>
        </div>
        <div className="ui-filterbar expiry-filters">
          <FilterSearch
            label="Buscar lote ou material"
            value={query}
            onChange={setQuery}
            placeholder="Código, descrição ou lote"
          />
          <FilterSelect
            label="Situação da validade"
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: "Todos com saldo" },
              ...[
                "Vencido",
                "Até 7 dias",
                "8 a 30 dias",
                "Acima de 30 dias",
                "Encerrado",
              ].map((value) => ({ value, label: value })),
            ]}
          />
          <button
            className="text-button"
            onClick={() => {
              setQuery("");
              setStatus("");
            }}
          >
            Limpar filtros
          </button>
        </div>
        {!workspace.lots.length ? (
          <div className="expiry-empty">
            <CalendarClock size={32} />
            <h3>Nenhuma validade registrada</h3>
            <p>
              Selecione um material já cadastrado e informe lote, quantidade e
              vencimento.
            </p>
            <button
              className="primary-button"
              onClick={() => setMode({ kind: "new" })}
              disabled={!!error}
            >
              Registrar primeiro lote
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Lote</th>
                  <th>Validade</th>
                  <th>Saldo do lote</th>
                  <th>Situação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lot) => {
                  const item = byId.get(lot.itemId);
                  const situation = expiryStatus(lot, today);
                  const days = expiryDays(lot.expiresOn, today);
                  return (
                    <tr key={lot.id}>
                      <td>
                        <strong>
                          {item?.description ||
                            "Material indisponível no Cadastro"}
                        </strong>
                        <small>{item?.code || lot.itemId}</small>
                      </td>
                      <td>{lot.batch}</td>
                      <td>
                        {date(lot.expiresOn)}
                        <small>
                          {days < 0
                            ? `Vencido há ${Math.abs(days)} dia(s)`
                            : days === 0
                              ? "Vence hoje"
                              : `Em ${days} dia(s)`}
                        </small>
                      </td>
                      <td>
                        {decimalInput(lot.remainingMilli, 3)}{" "}
                        <span className="expiry-unit">{lot.unit}</span>
                        <small>
                          Inicial: {decimalInput(lot.initialMilli, 3)}{" "}
                          {lot.unit}
                        </small>
                      </td>
                      <td>
                        <span className="expiry-status" data-status={situation}>
                          {situation}
                        </span>
                      </td>
                      <td>
                        <div className="expiry-actions">
                          <button
                            className="text-button"
                            onClick={() =>
                              setMode({ kind: "detail", lotId: lot.id })
                            }
                          >
                            Histórico
                          </button>
                          <button
                            className="secondary-button"
                            disabled={!!error || lot.remainingMilli === 0}
                            onClick={() =>
                              setMode({ kind: "debit", lotId: lot.id })
                            }
                          >
                            Dar baixa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!visible.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Nenhum lote corresponde aos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="expiry-note">
        Registros salvos neste navegador. Esta etapa ainda não está conectada ao
        Firebase nem ao estoque do MXM.
      </p>
      {mode && (
        <ExpiryDialog
          key={
            mode.kind === "new"
              ? `new:${mode.itemId || ""}`
              : `${mode.kind}:${mode.lotId}`
          }
          mode={mode}
          items={items}
          workspace={workspace}
          onClose={close}
          onDirty={setDirty}
          onCommit={onCommit}
          onSaved={(text) => {
            setDirty(false);
            setMessage(text);
            setMode(null);
          }}
        />
      )}
    </section>
  );
}
function ExpiryDialog({
  mode,
  items,
  workspace,
  onClose,
  onDirty,
  onCommit,
  onSaved,
}: {
  mode: Mode;
  items: Item[];
  workspace: ExpiryWorkspace;
  onClose: () => boolean;
  onDirty: (dirty: boolean) => void;
  onCommit: Props["onCommit"];
  onSaved: (text: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [drafts, setDrafts] = useState(() => [newLotDraft()]);
  const [itemId, setItemId] = useState(
    mode.kind === "new" ? mode.itemId || "" : "",
  );
  const [quantity, setQuantity] = useState("");
  const actor = "Operador local";
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<"Consumo" | "Descarte" | "Ajuste">(
    "Consumo",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const lot: ExpiryLot | undefined =
    mode.kind !== "new"
      ? workspace.lots.find((lot) => lot.id === mode.lotId)
      : undefined;
  const item = items.find((item) => item.id === (lot?.itemId || itemId));
  const edit = (change: () => void) => {
    change();
    onDirty(true);
    setError("");
  };
  function save() {
    try {
      if (mode.kind === "new") {
        const entries = drafts.map((draft, index) => ({
          id: draft.id,
          itemId,
          batch: draft.batch,
          expiresOn: draft.expiresOn,
          quantityMilli:
            parseScaledInput(
              draft.quantity,
              3,
              `Quantidade do lote ${index + 1}`,
            ) || 0,
          actor,
          expectedUnit: normalizeCatalogUnit(item?.unit || ""),
        }));
        onCommit((ws, currentItems) =>
          registerExpiryBatch(ws, currentItems, entries),
        );
      } else if (lot) {
        const quantityMilli = parseScaledInput(quantity, 3, "Quantidade") || 0;
        onCommit((ws) =>
          debitExpiry(ws, {
            lotId: lot.id,
            quantityMilli,
            actor,
            reason,
            kind,
          }),
        );
      } else throw new Error("Lote não encontrado.");
      onSaved(
        mode.kind === "new"
          ? `${drafts.length === 1 ? "Lote registrado" : `${drafts.length} lotes registrados`}.`
          : "Baixa registrada no histórico do lote.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    }
  }
  const title =
    mode.kind === "new"
      ? "Registrar validade"
      : mode.kind === "debit"
        ? "Dar baixa no lote"
        : "Histórico do lote";
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog expiry-dialog"
      aria-labelledby="expiry-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2 id="expiry-dialog-title">{title}</h2>
        {mode.kind !== "new" && (
          <p>
            {item?.description || lot?.itemId} · Lote {lot?.batch}
          </p>
        )}
      </header>
      <div className="expiry-dialog-body">
        {mode.kind === "new" && (
          <>
            <MaterialPicker
              items={items}
              value={itemId}
              onChange={(value) => edit(() => setItemId(value))}
            />
            <div className="expiry-lot-rows">
              {drafts.map((draft, index) => (
                <div className="expiry-lot-row" key={draft.id}>
                  <label>
                    Quantidade
                    {item?.unit ? ` (${normalizeCatalogUnit(item.unit)})` : ""}
                    <input
                      aria-label={`Quantidade do lote ${index + 1}`}
                      inputMode="decimal"
                      value={draft.quantity}
                      onChange={(e) =>
                        edit(() =>
                          setDrafts((current) =>
                            current.map((row) =>
                              row.id === draft.id
                                ? { ...row, quantity: e.target.value }
                                : row,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Lote
                    <input
                      aria-label={`Lote ${index + 1}`}
                      value={draft.batch}
                      onChange={(e) =>
                        edit(() =>
                          setDrafts((current) =>
                            current.map((row) =>
                              row.id === draft.id
                                ? { ...row, batch: e.target.value }
                                : row,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Validade
                    <input
                      aria-label={`Validade do lote ${index + 1}`}
                      type="date"
                      value={draft.expiresOn}
                      onChange={(e) =>
                        edit(() =>
                          setDrafts((current) =>
                            current.map((row) =>
                              row.id === draft.id
                                ? { ...row, expiresOn: e.target.value }
                                : row,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  {drafts.length > 1 && (
                    <button
                      className="text-button expiry-remove-lot"
                      aria-label={`Remover lote ${index + 1}`}
                      onClick={() =>
                        edit(() =>
                          setDrafts((current) =>
                            current.filter((row) => row.id !== draft.id),
                          ),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              className="text-button expiry-add-lot"
              onClick={() =>
                edit(() => setDrafts((current) => [...current, newLotDraft()]))
              }
            >
              <Plus size={15} /> Adicionar lote
            </button>
          </>
        )}
        {mode.kind === "debit" && (
          <>
            <div className="expiry-balance">
              <span>Saldo disponível do lote</span>
              <strong>
                {decimalInput(lot?.remainingMilli || 0, 3)} {lot?.unit || ""}
              </strong>
            </div>
            <div className="expiry-fields">
              <label>
                Quantidade da baixa
                <input
                  aria-label="Quantidade da baixa"
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => edit(() => setQuantity(e.target.value))}
                />
              </label>
              <FilterSelect
                label="Tipo de baixa"
                value={kind}
                onChange={(value) => edit(() => setKind(value as typeof kind))}
                options={["Consumo", "Descarte", "Ajuste"].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </div>
            <label>
              Motivo da baixa
              <textarea
                aria-label="Motivo da baixa"
                rows={2}
                value={reason}
                onChange={(e) => edit(() => setReason(e.target.value))}
              />
            </label>
          </>
        )}
        {mode.kind === "detail" && lot && (
          <>
            <div className="expiry-balance">
              <span>Saldo atual · validade {date(lot.expiresOn)}</span>
              <strong>
                {decimalInput(lot.remainingMilli, 3)} {lot.unit}
              </strong>
            </div>
            {workspace.movements
              .filter((event) => event.lotId === lot.id)
              .slice()
              .reverse()
              .map((event) => (
                <article key={event.id} className="expiry-history">
                  <strong>
                    {event.kind} · {decimalInput(event.quantityMilli, 3)}{" "}
                    {lot.unit}
                  </strong>
                  <small>
                    {event.actor} ·{" "}
                    {new Date(event.timestamp).toLocaleString("pt-BR")}
                  </small>
                  <p>{event.reason}</p>
                </article>
              ))}
          </>
        )}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer>
        <button className="secondary-button" onClick={onClose}>
          Fechar
        </button>
        {mode.kind !== "detail" && (
          <button className="primary-button" onClick={save}>
            {mode.kind === "new" ? "Salvar" : "Confirmar baixa"}
          </button>
        )}
      </footer>
    </dialog>
  );
}

function MaterialPicker({
  items,
  value,
  onChange,
}: {
  items: Item[];
  value: string;
  onChange: (id: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = items.find((item) => item.id === value);
  const label = (item: Item) => `${item.code} · ${item.description}`;
  const results = items
    .filter(
      (item) =>
        item.active !== false &&
        fold(label(item)).includes(fold(query?.trim() || "")),
    )
    .slice(0, 50);
  function choose(item: Item) {
    onChange(item.id);
    setQuery(null);
    setOpen(false);
  }
  useEffect(() => {
    if (open)
      root.current
        ?.querySelector(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);
  return (
    <div ref={root} className="expiry-material-picker">
      <label htmlFor={id}>Material</label>
      <div className="expiry-material-input">
        <Search size={17} aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? `${id}-list` : undefined}
          aria-activedescendant={
            open && results[active] ? `${id}-${active}` : undefined
          }
          autoComplete="off"
          placeholder="Buscar código ou descrição"
          value={query ?? (selected ? label(selected) : "")}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange("");
            setOpen(true);
            setActive(0);
          }}
          onClick={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((current) =>
                Math.max(
                  0,
                  Math.min(
                    results.length - 1,
                    open ? current + (event.key === "ArrowDown" ? 1 : -1) : 0,
                  ),
                ),
              );
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              if (results[active]) choose(results[active]);
            }
          }}
        />
      </div>
      {open && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-label="Materiais"
          className="expiry-material-options"
          onMouseDown={(event) => event.preventDefault()}
        >
          {results.map((item, index) => (
            <div
              key={item.id}
              id={`${id}-${index}`}
              role="option"
              aria-selected={value === item.id}
              data-index={index}
              data-active={active === index}
              onPointerMove={() => setActive(index)}
              onClick={() => choose(item)}
            >
              {label(item)}
            </div>
          ))}
          {!results.length && <p>Nenhum material encontrado.</p>}
        </div>
      )}
    </div>
  );
}

function newLotDraft() {
  return { id: crypto.randomUUID(), batch: "", expiresOn: "", quantity: "" };
}
