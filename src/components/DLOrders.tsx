import { useEffect, useMemo, useState } from "react";
import { Plus, ArrowLeft, Save, Trash2, FileText } from "lucide-react";
import type { Item, SupplyCycle } from "../types";
import type { DLPlan } from "../types/dl";
import { dlControlRows } from "../services/dlControl";
import {
  decimalInput,
  formatMoney,
  parseScaledInput,
  dlWorkspaceKey,
  readDLWorkspace,
} from "../services/dlPlanning";
import { DEFAULT_DL_REQUESTER } from "../config/uiDefaults";
import {
  dlOrderDraftsKey,
  readDLOrderDrafts,
  validateDLOrderDraft,
  draftTotalCents,
  persistDLOrderDrafts,
  originKey,
} from "../services/dlOrderDrafts";
import type { DLOrderDraft } from "../services/dlOrderDrafts";
import FilterSearch from "./ui/FilterSearch";
import FilterSelect from "./ui/FilterSelect";
import "./DLOrders.css";

const date = (value: string) =>
  value ? value.slice(0, 10).split("-").reverse().join("/") : "A definir";
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

export default function DLOrders({
  plans,
  items,
  cycles,
  storageError,
  onDirtyChange,
}: {
  plans: DLPlan[];
  items: Item[];
  cycles: SupplyCycle[];
  storageError: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [saved, setSaved] = useState(() => {
    try {
      const raw = localStorage.getItem(dlOrderDraftsKey);
      return { raw, workspace: readDLOrderDrafts(raw), error: "" };
    } catch {
      return {
        raw: null,
        workspace: { version: 1 as const, drafts: [] },
        error:
          "Não foi possível ler os rascunhos de pedidos. Os dados existentes foram preservados; recarregue a página para tentar novamente.",
      };
    }
  });
  const [editing, setEditing] = useState<DLOrderDraft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState("");
  const [supplier, setSupplier] = useState("");
  const [dl, setDL] = useState("");
  const [sort, setSort] = useState("recent");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const rows = useMemo(() => dlControlRows(plans, items), [plans, items]);
  const byOrigin = useMemo(
    () =>
      new Map(rows.map((row) => [originKey(row.plan.id, row.origin.id), row])),
    [rows],
  );
  const suppliers = [...new Set(rows.map((row) => row.origin.supplier))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
  const sourcePlans = [
    ...new Map(rows.map((row) => [row.plan.id, row.plan])).values(),
  ];
  const block = saved.error || storageError;
  const matches = (planId: string, originId: string) => {
    const row = byOrigin.get(originKey(planId, originId));
    return (
      (!dl || planId === dl) &&
      (!supplier || row?.origin.supplier === supplier) &&
      (!query ||
        fold(
          `${row?.plan.code || ""} ${row?.plan.title || ""} ${row?.item?.description || ""} ${row?.item?.code || ""} ${row?.origin.supplier || ""} ${row?.origin.mxmOrder || ""}`,
        ).includes(fold(query)))
    );
  };
  const drafts = saved.workspace.drafts
    .filter(
      (draft) =>
        draft.lines.some((line) => matches(line.planId, line.originId)) ||
        (!supplier &&
          !dl &&
          !!query &&
          fold(draft.requester).includes(fold(query))),
    )
    .sort((a, b) =>
      sort === "old"
        ? a.createdAt.localeCompare(b.createdAt)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  const candidates = rows.filter(
    (row) =>
      row.origin.availableMilli > 0 &&
      row.item &&
      matches(row.plan.id, row.origin.id),
  );
  const pageCount = Math.max(1, Math.ceil(candidates.length / 30));
  const currentPage = Math.min(page, pageCount);
  const selectedKeys = new Set(
    editing?.lines.map((line) => originKey(line.planId, line.originId)),
  );
  const dirty =
    editing &&
    (JSON.stringify(editing) !== baseline ||
      editing.lines.some(
        (line) =>
          quantities[originKey(line.planId, line.originId)] !==
          decimalInput(line.quantityMilli, 3),
      ));
  useEffect(() => {
    onDirtyChange(!!dirty);
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
  function resetFilters() {
    setQuery("");
    setSupplier("");
    setDL("");
    setPage(1);
  }
  function open(draft?: DLOrderDraft) {
    const now = new Date().toISOString();
    const next = draft
      ? structuredClone(draft)
      : {
          id: crypto.randomUUID(),
          requester: DEFAULT_DL_REQUESTER,
          cycleId: "",
          expectedDelivery: "",
          notes: "",
          lines: [],
          createdAt: now,
          updatedAt: now,
        };
    setEditing(next);
    setBaseline(JSON.stringify(next));
    setQuantities(
      Object.fromEntries(
        next.lines.map((line) => [
          originKey(line.planId, line.originId),
          decimalInput(line.quantityMilli, 3),
        ]),
      ),
    );
    setChoosing(!draft);
    resetFilters();
    setError("");
    setMessage("");
  }
  function close() {
    if (
      dirty &&
      !window.confirm("Descartar as alterações não salvas deste rascunho?")
    )
      return;
    setEditing(null);
    setChoosing(false);
    resetFilters();
    setError("");
  }
  function save() {
    if (!editing || block) return;
    try {
      const next: DLOrderDraft = {
        ...editing,
        updatedAt: new Date().toISOString(),
        lines: editing.lines.map((line) => ({
          ...line,
          quantityMilli:
            parseScaledInput(
              quantities[originKey(line.planId, line.originId)] || "",
              3,
              "Quantidade",
            ) || 0,
        })),
      };
      // Re-read released origins at the write boundary, rather than trusting an old view.
      const liveRows = dlControlRows(
        readDLWorkspace(localStorage.getItem(dlWorkspaceKey)).plans,
        items,
      );
      validateDLOrderDraft(next, liveRows);
      if (next.cycleId && !cycles.some((cycle) => cycle.id === next.cycleId))
        throw new Error("O ciclo selecionado não está mais disponível.");
      const workspace = {
        version: 1 as const,
        drafts: [
          next,
          ...saved.workspace.drafts.filter((draft) => draft.id !== next.id),
        ],
      };
      const raw = persistDLOrderDrafts(localStorage, saved.raw, workspace);
      setSaved({ raw, workspace, error: "" });
      setEditing(null);
      setChoosing(false);
      resetFilters();
      setError("");
      setMessage(
        "Rascunho salvo. Nenhuma reserva ou baixa de saldo foi realizada.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o rascunho.",
      );
    }
  }
  function remove(draft: DLOrderDraft) {
    if (
      block ||
      !window.confirm("Excluir este rascunho? Nenhum saldo será alterado.")
    )
      return;
    try {
      const workspace = {
        version: 1 as const,
        drafts: saved.workspace.drafts.filter(
          (candidate) => candidate.id !== draft.id,
        ),
      };
      const raw = persistDLOrderDrafts(localStorage, saved.raw, workspace);
      setSaved({ raw, workspace, error: "" });
      setMessage("Rascunho excluído.");
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível excluir.",
      );
    }
  }
  function toggle(planId: string, originId: string) {
    if (!editing) return;
    const key = originKey(planId, originId);
    setEditing({
      ...editing,
      lines: selectedKeys.has(key)
        ? editing.lines.filter(
            (line) => originKey(line.planId, line.originId) !== key,
          )
        : [...editing.lines, { planId, originId, quantityMilli: 0 }],
    });
    setQuantities((previous) => ({ ...previous, [key]: "" }));
  }
  const totalDraft = editing
    ? {
        ...editing,
        lines: editing.lines.map((line) => {
          try {
            return {
              ...line,
              quantityMilli:
                parseScaledInput(
                  quantities[originKey(line.planId, line.originId)] || "",
                  3,
                  "Quantidade",
                ) || 0,
            };
          } catch {
            return { ...line, quantityMilli: -1 };
          }
        }),
      }
    : null;
  const validQuantities = totalDraft?.lines.every(
    (line) => line.quantityMilli > 0,
  );
  const total =
    totalDraft && validQuantities ? draftTotalCents(totalDraft, rows) : null;
  const filters = (
    <div className="ui-filterbar dl-orders-filters">
      <FilterSearch
        label="Buscar"
        placeholder={
          editing
            ? "DL, item, código, fornecedor ou MXM"
            : "DL, item, fornecedor ou solicitante"
        }
        value={query}
        onChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
      />
      <FilterSelect
        label="DL"
        value={dl}
        onChange={(value) => {
          setDL(value);
          setPage(1);
        }}
        options={[
          { value: "", label: "Todas as DLs" },
          ...sourcePlans.map((plan) => ({
            value: plan.id,
            label: `${plan.code} · ${plan.title}`,
          })),
        ]}
      />
      <FilterSelect
        label="Fornecedor"
        value={supplier}
        onChange={(value) => {
          setSupplier(value);
          setPage(1);
        }}
        options={[
          { value: "", label: "Todos os fornecedores" },
          ...suppliers.map((value) => ({ value, label: value })),
        ]}
      />
      {!editing && (
        <FilterSelect
          label="Ordenar"
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "Atualizados recentemente" },
            { value: "old", label: "Mais antigos" },
          ]}
        />
      )}
      {(query || supplier || dl) && (
        <button className="text-button" onClick={resetFilters}>
          Limpar filtros
        </button>
      )}
    </div>
  );
  return (
    <section className="dl-orders" aria-labelledby="dl-orders-title">
      <header className="dl-orders-heading">
        <div>
          <h2 id="dl-orders-title">
            {editing ? "Preparar pedido DL" : "Pedidos DLs"}
          </h2>
          <p className="muted">
            {editing
              ? "Selecione as origens e informe as quantidades a solicitar."
              : "Rascunhos vinculados aos materiais das DLs concluídas."}
          </p>
        </div>
        <div className="dl-orders-actions">
          {editing ? (
            <>
              <button className="secondary-button" onClick={close}>
                <ArrowLeft size={16} /> Voltar
              </button>
              <button
                className="primary-button"
                disabled={!!block}
                onClick={save}
              >
                <Save size={16} /> Salvar rascunho
              </button>
            </>
          ) : (
            <button
              className="primary-button"
              disabled={!!block}
              onClick={() => open()}
            >
              <Plus size={16} /> Preparar pedido
            </button>
          )}
        </div>
      </header>
      {(block || error) && (
        <p className="notice" role="alert">
          {block || error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <p className="dl-orders-scope">
        Preparação de pedidos: rascunhos não reservam nem baixam saldo.
        Aprovação, envio e recebimento aguardam a definição do fluxo.
      </p>
      {!editing ? (
        <>
          <div className="dl-orders-metrics">
            <div>
              <span>Rascunhos salvos</span>
              <strong>{saved.workspace.drafts.length}</strong>
            </div>
            <div>
              <span>DLs com materiais liberados</span>
              <strong>{sourcePlans.length}</strong>
            </div>
            <div>
              <span>Fornecedores nas origens</span>
              <strong>{suppliers.length}</strong>
            </div>
          </div>
          {filters}
          <p className="muted">
            {drafts.length} de {saved.workspace.drafts.length} rascunhos
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>DLs / fornecedores</th>
                  <th>Ciclo</th>
                  <th>Itens</th>
                  <th>Total previsto</th>
                  <th>Entrega prevista</th>
                  <th>Atualização</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => {
                  const sources = draft.lines.map((line) =>
                    byOrigin.get(originKey(line.planId, line.originId)),
                  );
                  const amount = draftTotalCents(draft, rows);
                  return (
                    <tr key={draft.id}>
                      <td>
                        <strong>Rascunho · {draft.id.slice(0, 8)}</strong>
                        <small>{draft.requester}</small>
                      </td>
                      <td>
                        {[
                          ...new Set(
                            sources.map(
                              (row) => row?.plan.code || "Origem indisponível",
                            ),
                          ),
                        ].join(", ")}
                        <small>
                          {[
                            ...new Set(
                              sources.map(
                                (row) =>
                                  row?.origin.supplier ||
                                  "Fornecedor indisponível",
                              ),
                            ),
                          ].join(", ")}
                        </small>
                      </td>
                      <td>
                        {cycles.find((cycle) => cycle.id === draft.cycleId)
                          ?.name ||
                          (draft.cycleId
                            ? "Ciclo indisponível"
                            : "Sem vínculo")}
                      </td>
                      <td>{draft.lines.length}</td>
                      <td>
                        {amount === null
                          ? "Revisar origens"
                          : formatMoney(amount)}
                      </td>
                      <td>{date(draft.expectedDelivery)}</td>
                      <td>{date(draft.updatedAt)}</td>
                      <td>
                        <div className="dl-orders-actions">
                          <button
                            className="text-button"
                            onClick={() => open(draft)}
                          >
                            Abrir
                          </button>
                          <button
                            className="icon-button"
                            disabled={!!block}
                            aria-label={`Excluir rascunho ${draft.id.slice(0, 8)}`}
                            onClick={() => remove(draft)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!drafts.length && (
                  <tr>
                    <td className="empty-state" colSpan={8}>
                      <FileText size={24} />
                      <p>
                        {saved.workspace.drafts.length
                          ? "Nenhum rascunho corresponde aos filtros."
                          : "Nenhum pedido DL preparado. Comece selecionando materiais das DLs concluídas."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="dl-orders-fields">
            <label>
              Solicitante
              <input
                value={editing.requester}
                onChange={(event) =>
                  setEditing({ ...editing, requester: event.target.value })
                }
              />
            </label>
            <FilterSelect
              label="Ciclo (opcional)"
              value={editing.cycleId}
              onChange={(cycleId) => setEditing({ ...editing, cycleId })}
              options={[
                { value: "", label: "Sem vínculo com ciclo" },
                ...cycles.map((cycle) => ({
                  value: cycle.id,
                  label: cycle.name,
                })),
                ...(editing.cycleId &&
                !cycles.some((cycle) => cycle.id === editing.cycleId)
                  ? [{ value: editing.cycleId, label: "Ciclo indisponível" }]
                  : []),
              ]}
            />
            <label>
              Entrega prevista (opcional)
              <input
                type="date"
                value={editing.expectedDelivery}
                onChange={(event) =>
                  setEditing({
                    ...editing,
                    expectedDelivery: event.target.value,
                  })
                }
              />
            </label>
            <label className="dl-orders-notes">
              Observações
              <textarea
                aria-label="Observações"
                rows={2}
                value={editing.notes}
                onChange={(event) =>
                  setEditing({ ...editing, notes: event.target.value })
                }
              />
            </label>
          </div>
          <div className="dl-orders-heading">
            <div>
              <h3>Materiais do pedido</h3>
              <span className="muted">
                {editing.lines.length}{" "}
                {editing.lines.length === 1
                  ? "item selecionado"
                  : "itens selecionados"}
              </span>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                setChoosing((value) => !value);
                resetFilters();
              }}
            >
              {choosing ? "Concluir seleção" : "Adicionar materiais"}
            </button>
          </div>
          {choosing && (
            <section
              className="dl-orders-picker"
              aria-label="Selecionar materiais das DLs"
            >
              {filters}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Selecionar</th>
                      <th>DL / vigência</th>
                      <th>Material</th>
                      <th>Fornecedor / MXM</th>
                      <th>Saldo da origem</th>
                      <th>Unitário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates
                      .slice((currentPage - 1) * 30, currentPage * 30)
                      .map((row) => (
                        <tr key={originKey(row.plan.id, row.origin.id)}>
                          <td>
                            <input
                              className="ui-checkbox"
                              type="checkbox"
                              aria-label={`Selecionar ${row.item!.description} em ${row.plan.code}`}
                              checked={selectedKeys.has(
                                originKey(row.plan.id, row.origin.id),
                              )}
                              onChange={() =>
                                toggle(row.plan.id, row.origin.id)
                              }
                            />
                          </td>
                          <td>
                            {row.plan.code}
                            <small>
                              {date(row.plan.contract?.validFrom || "")} a{" "}
                              {date(row.plan.contract?.validUntil || "")}
                            </small>
                          </td>
                          <td>
                            {row.item!.description}
                            <small>{row.item!.code}</small>
                          </td>
                          <td>
                            {row.origin.supplier}
                            <small>{row.origin.mxmOrder}</small>
                          </td>
                          <td>
                            {decimalInput(row.origin.availableMilli, 3)}{" "}
                            {row.origin.unit}
                          </td>
                          <td>{formatMoney(row.origin.unitPriceCents)}</td>
                        </tr>
                      ))}
                    {!candidates.length && (
                      <tr>
                        <td colSpan={6} className="empty-state">
                          Nenhum material liberado corresponde aos filtros.
                          Conclua uma DL para disponibilizar suas origens.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <footer className="dl-orders-pagination">
                <span>{candidates.length} materiais</span>
                <button
                  className="secondary-button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Anterior
                </button>
                <span>
                  Página {currentPage} de {pageCount}
                </span>
                <button
                  className="secondary-button"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Próxima
                </button>
              </footer>
            </section>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Material / DL</th>
                  <th>Fornecedor / MXM</th>
                  <th>Saldo da origem</th>
                  <th>Quantidade a solicitar</th>
                  <th>Unitário</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {editing.lines.map((line) => {
                  const key = originKey(line.planId, line.originId);
                  const row = byOrigin.get(key);
                  return (
                    <tr key={key}>
                      <td>
                        {row?.item?.description || "Material indisponível"}
                        <small>
                          {row?.plan.code || "Origem indisponível"} ·{" "}
                          {row?.item?.code || line.originId}
                        </small>
                      </td>
                      <td>
                        {row?.origin.supplier || "A revisar"}
                        <small>{row?.origin.mxmOrder}</small>
                      </td>
                      <td>
                        {row
                          ? `${decimalInput(row.origin.availableMilli, 3)} ${row.origin.unit}`
                          : "A revisar"}
                      </td>
                      <td>
                        <input
                          className="dl-orders-quantity"
                          inputMode="decimal"
                          aria-label={`Quantidade de ${row?.item?.description || line.originId}`}
                          value={quantities[key] ?? ""}
                          onChange={(event) => {
                            setError("");
                            setQuantities((previous) => ({
                              ...previous,
                              [key]: event.target.value,
                            }));
                          }}
                        />
                      </td>
                      <td>
                        {row ? formatMoney(row.origin.unitPriceCents) : "—"}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => toggle(line.planId, line.originId)}
                        >
                          Retirar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!editing.lines.length && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      Selecione os materiais para preparar este pedido.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="dl-orders-total">
            <span>Total previsto do rascunho</span>
            <div>
              <strong>
                {total === null ? "A completar" : formatMoney(total)}
              </strong>
              <small>
                {total === null
                  ? "Informe quantidades válidas para todos os itens."
                  : "Valor calculado pelos preços das origens contratadas."}
              </small>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
