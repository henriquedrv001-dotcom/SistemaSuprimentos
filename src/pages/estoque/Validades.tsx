import { useEffect, useRef, useState } from "react";
import { CalendarClock, Download, Plus } from "lucide-react";
import type { Item } from "../../types";
import type { ExpiryLot, ExpiryWorkspace } from "../../types/expiry";
import {
  debitExpiry,
  expiryDays,
  expiryStatus,
  registerExpiry,
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
          onSaved={(text, keepOpen) => {
            setDirty(false);
            setMessage(text);
            if (!keepOpen) setMode(null);
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
  onSaved: (text: string, keepOpen: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [id, setId] = useState(crypto.randomUUID());
  const [itemId, setItemId] = useState(
    mode.kind === "new" ? mode.itemId || "" : "",
  );
  const [search, setSearch] = useState("");
  const [batch, setBatch] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [quantity, setQuantity] = useState("");
  const [actor, setActor] = useState("");
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState<"Consumo" | "Descarte" | "Ajuste">(
    "Consumo",
  );
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const lot: ExpiryLot | undefined =
    mode.kind !== "new"
      ? workspace.lots.find((lot) => lot.id === mode.lotId)
      : undefined;
  const item = items.find((item) => item.id === (lot?.itemId || itemId));
  const matched = items
    .filter(
      (i) =>
        i.active !== false &&
        fold(`${i.code} ${i.description}`).includes(fold(search.trim())),
    )
    .slice(0, 50);
  const choices =
    item && mode.kind === "new" && !matched.some((i) => i.id === item.id)
      ? [item, ...matched]
      : matched;
  const edit = (change: () => void) => {
    change();
    onDirty(true);
    setError("");
    setFeedback("");
  };
  function save(another = false) {
    try {
      const quantityMilli = parseScaledInput(quantity, 3, "Quantidade") || 0;
      if (mode.kind === "new")
        onCommit((ws, currentItems) =>
          registerExpiry(ws, currentItems, {
            id,
            itemId,
            batch,
            expiresOn,
            quantityMilli,
            actor,
            expectedUnit: normalizeCatalogUnit(item?.unit || ""),
          }),
        );
      else if (lot)
        onCommit((ws) =>
          debitExpiry(ws, {
            lotId: lot.id,
            quantityMilli,
            actor,
            reason,
            kind,
          }),
        );
      else throw new Error("Lote não encontrado.");
      onSaved(
        mode.kind === "new"
          ? "Validade registrada."
          : "Baixa registrada no histórico do lote.",
        another,
      );
      if (another) {
        setId(crypto.randomUUID());
        setBatch("");
        setQuantity("");
        setExpiresOn("");
        setFeedback("Lote salvo. Informe os dados do próximo lote.");
      }
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
        <p>
          {mode.kind === "new"
            ? "Use os materiais do Cadastro. Cada lote mantém seu próprio saldo."
            : `${item?.description || lot?.itemId} · Lote ${lot?.batch}`}
        </p>
      </header>
      <div className="expiry-dialog-body">
        {mode.kind === "new" && (
          <>
            <FilterSearch
              label="Buscar material do Cadastro"
              value={search}
              onChange={setSearch}
              placeholder="Digite o código ou descrição"
            />
            <FilterSelect
              label="Material do Cadastro"
              value={itemId}
              onChange={(value) => edit(() => setItemId(value))}
              options={[
                { value: "", label: "Selecionar material" },
                ...choices.map((i) => ({
                  value: i.id,
                  label: `${i.code} · ${i.description}`,
                })),
              ]}
            />
            <small className="expiry-note">
              Mostrando até 50 resultados. Refine a busca para encontrar outros
              materiais.
            </small>
            <div className="expiry-fields">
              <label>
                Lote
                <input
                  aria-label="Lote"
                  value={batch}
                  onChange={(e) => edit(() => setBatch(e.target.value))}
                />
              </label>
              <label>
                Data de validade
                <input
                  aria-label="Data de validade"
                  type="date"
                  value={expiresOn}
                  onChange={(e) => edit(() => setExpiresOn(e.target.value))}
                />
              </label>
            </div>
          </>
        )}
        {mode.kind !== "detail" && (
          <>
            <div className="expiry-balance">
              <span>
                {mode.kind === "new"
                  ? "Unidade do Cadastro"
                  : "Saldo disponível do lote"}
              </span>
              <strong>
                {mode.kind === "new"
                  ? item
                    ? normalizeCatalogUnit(item.unit)
                    : "Selecione um material"
                  : `${decimalInput(lot?.remainingMilli || 0, 3)} ${lot?.unit || ""}`}
              </strong>
            </div>
            <div className="expiry-fields">
              <label>
                {mode.kind === "new"
                  ? "Quantidade do lote"
                  : "Quantidade da baixa"}
                <input
                  aria-label={
                    mode.kind === "new"
                      ? "Quantidade do lote"
                      : "Quantidade da baixa"
                  }
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => edit(() => setQuantity(e.target.value))}
                />
              </label>
              <label>
                Responsável
                <input
                  aria-label="Responsável pelo registro"
                  value={actor}
                  onChange={(e) => edit(() => setActor(e.target.value))}
                />
              </label>
            </div>
            {mode.kind === "debit" && (
              <>
                <FilterSelect
                  label="Tipo de baixa"
                  value={kind}
                  onChange={(value) =>
                    edit(() => setKind(value as typeof kind))
                  }
                  options={["Consumo", "Descarte", "Ajuste"].map((value) => ({
                    value,
                    label: value,
                  }))}
                />
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
        {feedback && (
          <p className="notice" role="status">
            {feedback}
          </p>
        )}
      </div>
      <footer>
        <button className="secondary-button" onClick={onClose}>
          Fechar
        </button>
        {mode.kind === "new" && (
          <button className="secondary-button" onClick={() => save(true)}>
            Salvar e adicionar outro
          </button>
        )}
        {mode.kind !== "detail" && (
          <button className="primary-button" onClick={() => save(false)}>
            {mode.kind === "new" ? "Salvar validade" : "Confirmar baixa"}
          </button>
        )}
      </footer>
    </dialog>
  );
}
