import type { ExpiryCommand } from "../../services/expiryCommands";
import {
  canRegisterExpiryItem,
  catalogExpiryType,
  expiryTypeOf,
  expiryLocationOf,
  expiryTypes,
  expiryLocations,
} from "../../services/expiryCategories";
import { expiryCsv } from "../../services/expiryReports";
import { useEffect, useId, useRef, useState } from "react";
import { CalendarClock, ChevronDown, Plus, Search, Trash2 } from "lucide-react";
import type { Item } from "../../types";
import type {
  ExpiryLot,
  ExpiryWorkspace,
  ExpiryType,
  ExpiryLocation,
} from "../../types/expiry";
import {
  expiryLotCount,
  transferExpiry,
  groupExpiryLots,
  expiryQuantity,
  addExpiryEntry,
  countExpiry,
  expiryFirstToUse,
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
    command?: ExpiryCommand,
  ) => void | Promise<void>;
  actor?: string;
  readOnly?: boolean;
  onBackup?: () => void | Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
};
type Mode =
  | { kind: "new"; itemId?: string }
  | { kind: "debit" | "detail" | "entry" | "transfer"; lotId: string }
  | { kind: "audit"; lotIds: string[] };
type DialogMode = Exclude<Mode, { kind: "audit" }>;
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
  actor = "Operador local",
  readOnly = false,
  onBackup,
}: Props) {
  const today = todayInBrazil();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState<ExpiryType | "" | "unclassified">("");
  const [location, setLocation] = useState<ExpiryLocation | "">("");
  const [mode, setMode] = useState<Mode | null>(null);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
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
  const scopeLots = workspace.lots.filter((lot) => {
    const item = byId.get(lot.itemId);
    const category = expiryTypeOf(lot, item);
    return (
      (!type || (type === "unclassified" ? !category : category === type)) &&
      (type !== "Bebidas" ||
        !location ||
        expiryLocationOf(lot, item) === location)
    );
  });
  const groups = groupExpiryLots(
    { ...workspace, lots: scopeLots },
    items,
  ).filter((group) =>
    group.lots.some((lot) => {
      const item = byId.get(lot.itemId);
      const matchesStatus = !status
        ? lot.remainingMilli > 0
        : expiryStatus(lot, today) === status;
      return (
        matchesStatus &&
        fold(`${item?.description} ${item?.code} ${lot.batch}`).includes(
          fold(query.trim()),
        )
      );
    }),
  );
  const visible = groups.flatMap((group) => group.lots);
  const sections = (type ? [type] : [...expiryTypes, "unclassified"])
    .map((category) => ({
      category,
      title: category === "unclassified" ? "Sem classificação" : category,
      groups: groups.filter(
        (group) => (group.category || "unclassified") === category,
      ),
    }))
    .filter((section) => section.groups.length);
  function exportCsv(report: "lots" | "history") {
    const url = URL.createObjectURL(
      new Blob([expiryCsv(workspace, items, report, today)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `validades-${report === "lots" ? "lotes" : "historico"}-${today}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function backup() {
    if (onBackup) {
      void onBackup();
      return;
    }
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
        </div>
        <div className="expiry-actions">
          <button
            className="secondary-button"
            disabled={!!error || readOnly || !visible.length}
            onClick={() =>
              setMode({ kind: "audit", lotIds: visible.map((lot) => lot.id) })
            }
          >
            Conferir estoque
          </button>
          <FilterSelect
            aria-label="Exportar validades"
            value=""
            disabled={!!error}
            options={[
              { value: "", label: "Exportar", disabled: true },
              { value: "lots", label: "Todos os lotes (CSV)" },
              { value: "history", label: "Histórico (CSV)" },
              { value: "backup", label: "Backup (JSON)" },
            ]}
            onChange={(value) => {
              if (value === "backup") backup();
              else if (value === "lots" || value === "history")
                exportCsv(value);
            }}
          />
          <button
            className="primary-button"
            onClick={() => {
              setMessage("");
              setMode({ kind: "new" });
            }}
            disabled={!!error || readOnly}
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
                {expiryLotCount(
                  scopeLots.filter((lot) => expiryStatus(lot, today) === label),
                )}
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
              {groups.length} {groups.length === 1 ? "material" : "materiais"} ·
              Mais próximos primeiro
            </p>
          </div>
        </div>
        <div
          className={`ui-filterbar expiry-filters expiry-category-filters${type === "Bebidas" ? " has-location" : ""}`}
        >
          <FilterSearch
            label="Buscar lote ou material"
            value={query}
            onChange={setQuery}
            placeholder="Código, descrição ou lote"
          />
          <FilterSelect
            label="Tipo"
            value={type}
            onChange={(value) => {
              setType(value as typeof type);
              setLocation("");
              setExpanded(new Set());
            }}
            options={[
              { value: "", label: "Todos" },
              ...expiryTypes.map((value) => ({ value, label: value })),
              ...(workspace.lots.some(
                (lot) => !expiryTypeOf(lot, byId.get(lot.itemId)),
              )
                ? [{ value: "unclassified", label: "Sem classificação" }]
                : []),
            ]}
          />
          {type === "Bebidas" && (
            <FilterSelect
              label="Local"
              value={location}
              onChange={(value) => {
                setLocation(value as typeof location);
                setExpanded(new Set());
              }}
              options={[
                { value: "", label: "Todos" },
                ...expiryLocations.map((value) => ({ value, label: value })),
              ]}
            />
          )}
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
              setType("");
              setLocation("");
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
              disabled={!!error || readOnly}
            >
              Registrar primeiro lote
            </button>
          </div>
        ) : (
          <div className="expiry-groups">
            {sections.map((section) => (
              <section
                className="expiry-type-section"
                key={section.category}
                aria-label={section.title}
              >
                {!type && <h3>{section.title}</h3>}
                {section.groups.map((group) => {
                  const item = byId.get(group.itemId);
                  const isOpen = expanded.has(group.key);
                  const nearest = group.nearest;
                  return (
                    <article className="expiry-material-group" key={group.key}>
                      <button
                        className="expiry-group-heading"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setExpanded((current) => {
                            const next = new Set(current);
                            if (next.has(group.key)) next.delete(group.key);
                            else next.add(group.key);
                            return next;
                          })
                        }
                      >
                        <span className="expiry-group-name">
                          <strong>
                            {item?.description ||
                              "Material indisponível no Cadastro"}
                          </strong>
                          <small>
                            {item?.code || group.itemId} ·{" "}
                            {expiryLotCount(group.lots)}{" "}
                            {expiryLotCount(group.lots) === 1
                              ? "lote"
                              : "lotes"}
                            {group.category === "Bebidas" &&
                            new Set(
                              group.lots.map((lot) =>
                                expiryLocationOf(lot, item),
                              ),
                            ).size > 1
                              ? " · 2 locais"
                              : ""}
                          </small>
                        </span>
                        <span className="expiry-group-total">
                          <small>Total</small>
                          <strong>
                            {expiryQuantity(group.totalMilli)} {group.unit}
                          </strong>
                        </span>
                        <span
                          className="expiry-group-nearest"
                          data-status={
                            nearest ? expiryStatus(nearest, today) : "Encerrado"
                          }
                        >
                          <small>
                            {nearest && expiryDays(nearest.expiresOn, today) < 0
                              ? "Vencido"
                              : "Próxima validade"}
                          </small>
                          <strong>
                            {nearest
                              ? `${expiryQuantity(group.nearestMilli)} ${group.unit} · ${date(nearest.expiresOn)}`
                              : "Sem saldo"}
                          </strong>
                        </span>
                        <ChevronDown
                          size={17}
                          className={isOpen ? "is-open" : ""}
                        />
                      </button>
                      {isOpen && (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Lote</th>
                                {group.category === "Bebidas" && <th>Local</th>}
                                <th>Validade</th>
                                <th>Saldo</th>
                                <th>Situação</th>
                                <th>Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.lots.map((lot) => (
                                <tr key={lot.id}>
                                  <td>{lot.batch}</td>
                                  {group.category === "Bebidas" && (
                                    <td>{expiryLocationOf(lot, item)}</td>
                                  )}
                                  <td>{date(lot.expiresOn)}</td>
                                  <td>
                                    {decimalInput(lot.remainingMilli, 3)}{" "}
                                    {lot.unit}
                                  </td>
                                  <td>
                                    <span
                                      className="expiry-status"
                                      data-status={expiryStatus(lot, today)}
                                    >
                                      {expiryStatus(lot, today)}
                                    </span>
                                  </td>
                                  <td>
                                    <FilterSelect
                                      aria-label={`Ações do lote ${lot.batch}${group.category === "Bebidas" ? ` ${expiryLocationOf(lot, item)}` : ""}`}
                                      value=""
                                      options={[
                                        {
                                          value: "",
                                          label: "Ações",
                                          disabled: true,
                                        },
                                        ...(item && item.active !== false
                                          ? [
                                              {
                                                value: "entry",
                                                label: "Nova entrada",
                                              },
                                            ]
                                          : []),
                                        ...(lot.remainingMilli > 0
                                          ? [
                                              {
                                                value: "debit",
                                                label: "Dar baixa",
                                              },
                                            ]
                                          : []),
                                        ...(group.category === "Bebidas" &&
                                        item?.active !== false &&
                                        lot.remainingMilli > 0 &&
                                        expiryLocationOf(lot, item) ===
                                          "Almoxarifado"
                                          ? [
                                              {
                                                value: "transfer",
                                                label:
                                                  "Transferir para Lanchonete",
                                              },
                                            ]
                                          : []),
                                        {
                                          value: "audit",
                                          label: "Conferir estoque",
                                        },
                                        { value: "detail", label: "Histórico" },
                                      ].filter(
                                        (option) =>
                                          !readOnly ||
                                          !option.value ||
                                          option.value === "detail",
                                      )}
                                      onChange={(action) => {
                                        if (action === "audit")
                                          setMode({
                                            kind: "audit",
                                            lotIds: [lot.id],
                                          });
                                        else if (
                                          action === "entry" ||
                                          action === "debit" ||
                                          action === "detail" ||
                                          action === "transfer"
                                        )
                                          setMode({
                                            kind: action,
                                            lotId: lot.id,
                                          });
                                      }}
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </article>
                  );
                })}
              </section>
            ))}
            {!groups.length && (
              <p className="empty-state">
                Nenhum material corresponde aos filtros.
              </p>
            )}
          </div>
        )}
      </section>
      {mode?.kind === "audit" && (
        <ExpiryCountDialog
          actor={actor}
          lotIds={mode.lotIds}
          workspace={workspace}
          items={items}
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
      {mode && mode.kind !== "audit" && (
        <ExpiryDialog
          key={
            mode.kind === "new"
              ? `new:${mode.itemId || ""}`
              : `${mode.kind}:${mode.lotId}`
          }
          actor={actor}
          mode={mode}
          viewType={type === "unclassified" ? "" : type}
          viewLocation={location}
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
  actor,
  mode,
  viewType,
  viewLocation,
  items,
  workspace,
  onClose,
  onDirty,
  onCommit,
  onSaved,
}: {
  actor: string;
  mode: DialogMode;
  viewType: ExpiryType | "";
  viewLocation: ExpiryLocation | "";
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
  const [entryLocation, setEntryLocation] = useState<ExpiryLocation>(
    viewLocation || "Almoxarifado",
  );
  const [requestId] = useState(() => crypto.randomUUID());
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const today = todayInBrazil();
  const selectedLot =
    mode.kind === "new"
      ? undefined
      : workspace.lots.find((lot) => lot.id === mode.lotId);
  const [kind, setKind] = useState<"Consumo" | "Descarte">(
    selectedLot && expiryDays(selectedLot.expiresOn, today) < 0
      ? "Descarte"
      : "Consumo",
  );
  const [discardReason, setDiscardReason] = useState(
    selectedLot && expiryDays(selectedLot.expiresOn, today) < 0
      ? "Vencimento"
      : "Avaria",
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    ref.current?.showModal();
    ref.current?.querySelector<HTMLElement>("h2")?.focus();
  }, []);
  const lot: ExpiryLot | undefined =
    mode.kind !== "new"
      ? workspace.lots.find((lot) => lot.id === mode.lotId)
      : undefined;
  const item = items.find((item) => item.id === (lot?.itemId || itemId));
  const category = catalogExpiryType(item);
  const firstToUse = lot
    ? expiryFirstToUse(
        workspace,
        lot.itemId,
        today,
        expiryLocationOf(lot, item),
      )
    : undefined;
  const edit = (change: () => void) => {
    change();
    onDirty(true);
    setError("");
  };
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    try {
      if (mode.kind === "new") {
        if (!item || !canRegisterExpiryItem(item, viewType))
          throw new Error(
            "Este material não pertence ao tipo selecionado. Confira o Tipo e o Grupo no Cadastro.",
          );
        if (!category)
          throw new Error("Confira o Tipo e o Grupo do material no Cadastro.");
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
          category,
          location: category === "Bebidas" ? entryLocation : undefined,
        }));
        await onCommit(
          (ws, currentItems) => registerExpiryBatch(ws, currentItems, entries),
          { kind: "register", entries },
        );
      } else if (lot) {
        const quantityMilli = parseScaledInput(quantity, 3, "Quantidade") || 0;
        if (mode.kind === "transfer") {
          const input = { id: requestId, lotId: lot.id, quantityMilli };
          await onCommit(
            (ws, currentItems) =>
              transferExpiry(ws, currentItems, { ...input, actor }),
            { kind: "transfer", input },
          );
        } else if (mode.kind === "entry") {
          const input = {
            id: requestId,
            lotId: lot.id,
            quantityMilli,
            expectedUnit: lot.unit,
          };
          await onCommit(
            (ws, currentItems) =>
              addExpiryEntry(ws, currentItems, { ...input, actor }),
            { kind: "entry", input },
          );
        } else {
          const input = {
            lotId: lot.id,
            quantityMilli,
            reason:
              kind === "Consumo"
                ? "Consumo"
                : discardReason === "Outro"
                  ? reason
                  : discardReason,
            kind,
          };
          await onCommit((ws) => debitExpiry(ws, { ...input, actor, today }), {
            kind: "debit",
            input,
          });
        }
      } else throw new Error("Lote não encontrado.");
      onSaved(
        mode.kind === "new"
          ? `${drafts.length === 1 ? "Lote registrado" : `${drafts.length} lotes registrados`}.`
          : mode.kind === "entry"
            ? "Entrada somada ao lote e registrada no histórico."
            : mode.kind === "transfer"
              ? "Transferência para Lanchonete registrada."
              : "Baixa registrada no histórico do lote.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      saving.current = false;
      setPending(false);
    }
  }
  const title =
    mode.kind === "new"
      ? "Registrar validade"
      : mode.kind === "debit"
        ? "Dar baixa no lote"
        : mode.kind === "entry"
          ? "Nova entrada no lote"
          : mode.kind === "transfer"
            ? "Transferir para Lanchonete"
            : "Histórico do lote";
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog expiry-dialog"
      aria-labelledby="expiry-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <header>
        <h2 id="expiry-dialog-title" tabIndex={-1}>
          {title}
        </h2>
        {mode.kind !== "new" && (
          <p>
            {item?.description || lot?.itemId} · Lote {lot?.batch}
            {lot && expiryLocationOf(lot, item)
              ? ` · ${expiryLocationOf(lot, item)}`
              : ""}
          </p>
        )}
      </header>
      <fieldset className="expiry-dialog-body" disabled={pending}>
        {mode.kind === "new" && (
          <>
            <div
              className={`expiry-material-context${category === "Bebidas" ? " has-location" : ""}`}
            >
              <MaterialPicker
                items={items.filter((item) =>
                  canRegisterExpiryItem(item, viewType),
                )}
                value={itemId}
                onChange={(value) => {
                  if (value !== itemId) edit(() => setItemId(value));
                }}
              />
              {category === "Bebidas" && (
                <FilterSelect
                  label="Local"
                  value={entryLocation}
                  onChange={(value) =>
                    edit(() => setEntryLocation(value as ExpiryLocation))
                  }
                  options={expiryLocations.map((value) => ({
                    value,
                    label: value,
                  }))}
                />
              )}
            </div>
            {item && !canRegisterExpiryItem(item, viewType) && (
              <p className="notice">
                Material fora deste tipo. Confira o Tipo e o Grupo no Cadastro.
              </p>
            )}
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
                  {(() => {
                    const existing = workspace.lots.find(
                      (l) =>
                        l.itemId === itemId &&
                        l.batch.trim().toUpperCase() ===
                          draft.batch.trim().toUpperCase() &&
                        l.expiresOn === draft.expiresOn &&
                        expiryLocationOf(l, item) ===
                          (category === "Bebidas" ? entryLocation : undefined),
                    );
                    return existing ? (
                      <small className="expiry-existing-lot">
                        Será somado ao lote existente · Saldo:{" "}
                        {decimalInput(existing.remainingMilli, 3)}{" "}
                        {existing.unit}
                      </small>
                    ) : null;
                  })()}
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
        {mode.kind === "transfer" && lot && (
          <>
            <p className="expiry-note">
              Almoxarifado → Lanchonete · Disponível:{" "}
              {decimalInput(lot.remainingMilli, 3)} {lot.unit} · Validade{" "}
              {date(lot.expiresOn)}
            </p>
            <label>
              Quantidade a transferir ({lot.unit})
              <input
                aria-label="Quantidade a transferir"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => edit(() => setQuantity(e.target.value))}
              />
            </label>
          </>
        )}
        {mode.kind === "entry" && lot && (
          <>
            <p className="expiry-note">
              Validade {date(lot.expiresOn)} · Saldo atual:{" "}
              {decimalInput(lot.remainingMilli, 3)} {lot.unit}
            </p>
            <label>
              Quantidade recebida ({lot.unit})
              <input
                aria-label="Quantidade recebida"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => edit(() => setQuantity(e.target.value))}
              />
            </label>
          </>
        )}
        {mode.kind === "debit" && (
          <>
            {kind === "Consumo" && firstToUse && firstToUse.id !== lot?.id && (
              <p className="notice">
                Use primeiro o lote {firstToUse.batch}, que vence em{" "}
                {date(firstToUse.expiresOn)}.
              </p>
            )}
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
                options={[
                  ...(lot && expiryDays(lot.expiresOn, today) < 0
                    ? []
                    : ["Consumo"]),
                  "Descarte",
                ].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </div>
            {kind === "Descarte" && (
              <FilterSelect
                label="Motivo"
                value={discardReason}
                onChange={(value) => edit(() => setDiscardReason(value))}
                options={["Vencimento", "Avaria", "Outro"].map((value) => ({
                  value,
                  label: value,
                }))}
              />
            )}
            {kind === "Descarte" && discardReason === "Outro" && (
              <label>
                Motivo do descarte
                <input
                  value={reason}
                  onChange={(e) => edit(() => setReason(e.target.value))}
                />
              </label>
            )}
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
                    {event.kind}
                    {event.kind === "Transferência"
                      ? ` (${event.afterMilli! > event.beforeMilli! ? "entrada" : "saída"})`
                      : ""}{" "}
                    ·{" "}
                    {event.beforeMilli !== undefined &&
                    event.afterMilli !== undefined
                      ? `${decimalInput(event.beforeMilli, 3)} → ${decimalInput(event.afterMilli, 3)}`
                      : decimalInput(event.quantityMilli, 3)}{" "}
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
      </fieldset>
      <footer>
        <button
          className="secondary-button"
          disabled={pending}
          onClick={onClose}
        >
          Fechar
        </button>
        {mode.kind !== "detail" && (
          <button
            className="primary-button"
            disabled={pending}
            onClick={() => void save()}
          >
            {mode.kind === "new"
              ? "Salvar"
              : mode.kind === "entry"
                ? "Confirmar entrada"
                : mode.kind === "transfer"
                  ? "Confirmar transferência"
                  : "Confirmar baixa"}
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

function ExpiryCountDialog({
  actor,
  lotIds,
  workspace,
  items,
  onClose,
  onDirty,
  onCommit,
  onSaved,
}: {
  actor: string;
  lotIds: string[];
  workspace: ExpiryWorkspace;
  items: Item[];
  onClose: () => boolean;
  onDirty: (value: boolean) => void;
  onCommit: Props["onCommit"];
  onSaved: (message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState(() =>
    workspace.lots
      .filter((lot) => lotIds.includes(lot.id))
      .map((lot) => ({ ...lot, counted: "" })),
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    ref.current?.showModal();
    ref.current?.querySelector<HTMLElement>("h2")?.focus();
  }, []);
  function parsed(value: string) {
    try {
      return parseScaledInput(value, 3, "Quantidade contada");
    } catch {
      return null;
    }
  }
  const changed = rows.some(
    (row) =>
      row.counted.trim() &&
      parsed(row.counted) !== null &&
      parsed(row.counted) !== row.remainingMilli,
  );
  async function save() {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    try {
      const counts = rows
        .filter((row) => row.counted.trim())
        .map((row) => ({
          lotId: row.id,
          expectedMilli: row.remainingMilli,
          countedMilli: parseScaledInput(
            row.counted,
            3,
            `Contagem do lote ${row.batch}`,
          )!,
        }));
      await onCommit((ws) => countExpiry(ws, counts, actor, reason), {
        kind: "count",
        counts,
        reason,
      });
      onSaved(
        `${counts.length === 1 ? "Lote conferido" : `${counts.length} lotes conferidos`}. Histórico atualizado.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a conferência.",
      );
    } finally {
      saving.current = false;
      setPending(false);
    }
  }
  function update(id: string, value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, counted: value } : row)),
    );
    onDirty(true);
    setError("");
  }
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog expiry-dialog expiry-count-dialog"
      aria-labelledby="expiry-count-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <header>
        <h2 id="expiry-count-title" tabIndex={-1}>
          Conferir estoque
        </h2>
        <p>Informe o que encontrou. Deixe em branco o que não foi contado.</p>
      </header>
      <fieldset className="expiry-dialog-body" disabled={pending}>
        <div className="table-wrap">
          <table className="expiry-count-table">
            <thead>
              <tr>
                <th>Material / lote</th>
                <th>No sistema</th>
                <th>Contado</th>
                <th>Diferença</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const item = items.find((item) => item.id === row.itemId);
                const counted = parsed(row.counted);
                const difference =
                  counted === null ? null : counted - row.remainingMilli;
                return (
                  <tr key={row.id}>
                    <td>
                      <strong>{item?.description || row.itemId}</strong>
                      <small>
                        {item?.code} · Lote {row.batch} · {date(row.expiresOn)}
                        {expiryLocationOf(row, item)
                          ? ` · ${expiryLocationOf(row, item)}`
                          : ""}
                      </small>
                    </td>
                    <td>
                      {decimalInput(row.remainingMilli, 3)} {row.unit}
                    </td>
                    <td>
                      <div className="expiry-count-input">
                        <input
                          aria-label={`Contagem do lote ${row.batch} ${item?.code || row.itemId}${expiryLocationOf(row, item) ? ` ${expiryLocationOf(row, item)}` : ""}`}
                          inputMode="decimal"
                          value={row.counted}
                          onChange={(event) =>
                            update(row.id, event.target.value)
                          }
                        />
                        <button
                          className="text-button"
                          onClick={() =>
                            update(row.id, decimalInput(row.remainingMilli, 3))
                          }
                        >
                          Confere
                        </button>
                      </div>
                    </td>
                    <td className={difference ? "expiry-difference" : ""}>
                      {difference === null
                        ? "—"
                        : `${difference > 0 ? "+" : difference < 0 ? "-" : ""}${decimalInput(Math.abs(difference), 3)} ${row.unit}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {changed && (
          <label>
            Motivo da diferença
            <input
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                onDirty(true);
                setError("");
              }}
            />
          </label>
        )}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
      </fieldset>
      <footer>
        <button
          className="secondary-button"
          disabled={pending}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          className="primary-button"
          disabled={pending || !rows.some((row) => row.counted.trim())}
          onClick={() => void save()}
        >
          Salvar conferência
        </button>
      </footer>
    </dialog>
  );
}
