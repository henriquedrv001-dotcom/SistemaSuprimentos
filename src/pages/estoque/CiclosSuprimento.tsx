import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  FolderPlus,
  Plus,
  Search,
} from "lucide-react";
import type {
  CycleItemEvent,
  CyclePlanningLine,
  CycleWorkspace,
  Item,
  SupplyCycle,
} from "../../types";
import {
  addPlanningItems,
  editPlanningLine,
  normalizeName,
  removePlanningItems,
  saveGroupTemplate,
} from "../../services/cyclePlanning";
import ConfirmGroupChangeDialog from "../../components/ConfirmGroupChangeDialog";
import CycleItemPicker from "../../components/CycleItemPicker";
import { CycleForm, CycleLineForm } from "../../components/CycleForms";
import CycleGroupsDialog from "../../components/CycleGroupsDialog";

type Props = {
  items: Item[];
  cycles: SupplyCycle[];
  workspace: CycleWorkspace;
  storageError: string;
  initialCycleId: string | null;
  onSaveCycle: (draft: Omit<SupplyCycle, "id">, id?: string) => string;
  onCommit: (next: CycleWorkspace, events: CycleItemEvent[]) => void;
};
const formatDate = (value: string) =>
  value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";
export default function CiclosSuprimento({
  items,
  cycles,
  workspace,
  storageError,
  initialCycleId,
  onSaveCycle,
  onCommit,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(initialCycleId);
  const [cycleForm, setCycleForm] = useState<SupplyCycle | "new" | null>(null);
  const [picker, setPicker] = useState(false);
  const [manageGroups, setManageGroups] = useState(false);
  const [lineForm, setLineForm] = useState<CyclePlanningLine | null>(null);
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [moveGroup, setMoveGroup] = useState("");
  const [pendingGroupChange, setPendingGroupChange] = useState<{ lines: CyclePlanningLine[]; groupId: string | null } | null>(null);
  const [statusFilter, setStatusFilter] = useState("open");
  useEffect(() => {
    if (initialCycleId) {
      setActiveId(initialCycleId);
      setQuery("");
      setGroupFilter("all");
      setSelected([]);
      setPage(0);
    }
  }, [initialCycleId]);
  const cycle = cycles.find((cycle) => cycle.id === activeId);
  const closed = cycle?.status === "Encerrado";
  const locked = closed || !!storageError;
  const byItemId = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const groups = useMemo(
    () => workspace.groups.filter((group) => group.cycleId === activeId),
    [workspace.groups, activeId],
  );
  const groupNames = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name])),
    [groups],
  );
  const lines = useMemo(
    () => workspace.lines.filter((line) => line.cycleId === activeId),
    [workspace.lines, activeId],
  );
  const filtered = useMemo(
    () =>
      lines
        .filter((line) => {
          const item = byItemId.get(line.itemId);
          const search =
            `${item?.code ?? line.itemId} ${item?.description ?? ""} ${groupNames.get(line.requestGroupId ?? "") ?? ""}`.toLocaleLowerCase(
              "pt-BR",
            );
          return (
            (groupFilter === "all" ||
              (groupFilter === "none"
                ? !line.requestGroupId
                : line.requestGroupId === groupFilter)) &&
            search.includes(query.trim().toLocaleLowerCase("pt-BR"))
          );
        })
        .sort((a, b) =>
          (byItemId.get(a.itemId)?.description ?? a.itemId).localeCompare(
            byItemId.get(b.itemId)?.description ?? b.itemId,
            "pt-BR",
          ),
        ),
    [lines, byItemId, groupFilter, groupNames, query],
  );
  useEffect(() => {
    setPage(0);
    const ids = new Set(filtered.map((line) => line.id));
    setSelected((current) => {
      const next = current.filter((id) => ids.has(id));
      return next.length === current.length ? current : next;
    });
  }, [filtered]);
  useEffect(() => {
    if (
      groupFilter !== "all" &&
      groupFilter !== "none" &&
      !groups.some((group) => group.id === groupFilter)
    )
      setGroupFilter("all");
  }, [groups, groupFilter]);
  function attempt(run: () => void) {
    try {
      run();
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    }
  }
  function openCycle(id: string | null) {
    setActiveId(id);
    setQuery("");
    setGroupFilter("all");
    setSelected([]);
    setError("");
    setMessage("");
  }
  function lineEvents(
    selectedLines: CyclePlanningLine[],
    action: string,
    details: string,
  ): CycleItemEvent[] {
    return selectedLines.map((line) => ({
      itemId: line.itemId,
      action,
      details,
    }));
  }
  function saveModel() {
    attempt(() => {
      const selectedLines = filtered.filter((line) =>
        selected.includes(line.id),
      );
      const name = window.prompt(
        "Nome do modelo de grupo:",
        groupNames.get(groupFilter) ?? "",
      );
      if (name === null) return;
      const replace = workspace.templates.some(
        (model) => normalizeName(model.name) === normalizeName(name),
      );
      if (
        replace &&
        !window.confirm(
          "Substituir esse modelo? Os ciclos já existentes serão mantidos.",
        )
      )
        return;
      onCommit(
        saveGroupTemplate(
          workspace,
          name,
          selectedLines.map((line) => line.itemId),
          replace,
        ),
        [],
      );
      setMessage("Modelo de grupo salvo com os materiais selecionados.");
    });
  }
  const visibleCycles = cycles.filter(
    (cycle) =>
      (statusFilter === "all" ||
        (statusFilter === "open"
          ? cycle.status !== "Encerrado"
          : cycle.status === "Encerrado")) &&
      cycle.name
        .toLocaleLowerCase("pt-BR")
        .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  return (
    <div className="cycles-page">
      {storageError && (
        <p role="alert" className="catalog-error">
          {storageError}
        </p>
      )}
      {error && (
        <p role="alert" className="catalog-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="catalog-feedback">
          {message}
        </p>
      )}
      {!cycle ? (
        <>
          <div className="page-heading">
            <div>
              <p className="eyebrow">ESTOQUE · PLANEJAMENTO</p>
              <h1>Ciclos de suprimentos</h1>
              <p className="muted">
                O que precisamos solicitar em cada período? Planeje vários
                ciclos ao mesmo tempo.
              </p>
            </div>
            <button
              className="primary-button"
              disabled={!!storageError}
              onClick={() => setCycleForm("new")}
            >
              <CalendarDays size={16} />
              Novo ciclo
            </button>
          </div>
          <section className="panel">
            <div className="toolbar">
              <label className="catalog-search">
                <Search size={16} />
                <input
                  aria-label="Buscar ciclos"
                  placeholder="Buscar ciclo"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <label className="cycle-list-filter">
                Exibir ciclos
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="open">Abertos</option>
                  <option value="all">Todos</option>
                  <option value="closed">Encerrados</option>
                </select>
              </label>
              {(query || statusFilter !== "open") && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("open");
                  }}
                >
                  Limpar filtros de ciclos
                </button>
              )}
            </div>
            <div className="table-wrap">
              <table className="cycle-overview-table">
                <thead>
                  <tr>
                    <th>Ciclo</th>
                    <th>Situação</th>
                    <th>Solicitações a partir de</th>
                    <th>Entregas previstas</th>
                    <th>Materiais</th>
                    <th>Grupos</th>
                    <th>Abrir</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCycles.map((cycle) => (
                    <tr key={cycle.id}>
                      <td>
                        <button
                          className="item-code-button"
                          onClick={() => openCycle(cycle.id)}
                        >
                          {cycle.name}
                        </button>
                      </td>
                      <td>
                        <span
                          className={`tag ${cycle.status === "Em execução" ? "tag-green" : "tag-neutral"}`}
                        >
                          {cycle.status}
                        </span>
                      </td>
                      <td>{formatDate(cycle.solicitationStart)}</td>
                      <td>
                        {formatDate(cycle.firstDelivery)} a{" "}
                        {formatDate(cycle.lastDelivery)}
                      </td>
                      <td>
                        {
                          workspace.lines.filter(
                            (line) => line.cycleId === cycle.id,
                          ).length
                        }
                      </td>
                      <td>
                        {
                          workspace.groups.filter(
                            (group) => group.cycleId === cycle.id,
                          ).length
                        }
                      </td>
                      <td>
                        <button
                          className="secondary-button"
                          aria-label={`Abrir ciclo ${cycle.name}`}
                          onClick={() => openCycle(cycle.id)}
                        >
                          Abrir ciclo
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!visibleCycles.length && (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        Nenhum ciclo encontrado. Crie um ciclo ou ajuste os
                        filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <button
            className="text-button cycle-back"
            onClick={() => openCycle(null)}
          >
            <ArrowLeft size={15} />
            Todos os ciclos
          </button>
          <div className="page-heading">
            <div>
              <p className="eyebrow">ESTOQUE · CICLO DE SUPRIMENTOS</p>
              <h1>{cycle.name}</h1>
              <p className="muted">
                Solicitações: {formatDate(cycle.solicitationStart)} · Entregas:{" "}
                {formatDate(cycle.firstDelivery)} a{" "}
                {formatDate(cycle.lastDelivery)} · Fechamento:{" "}
                {formatDate(cycle.closingDate)}
              </p>
            </div>
            <div className="cycle-inline-actions">
              <span
                className={`tag ${cycle.status === "Em execução" ? "tag-green" : "tag-neutral"}`}
              >
                {cycle.status}
              </span>
              <button
                className="secondary-button"
                disabled={!!storageError}
                onClick={() => setCycleForm(cycle)}
              >
                Editar ciclo
              </button>
              <button
                className="primary-button"
                disabled={locked}
                onClick={() => setPicker(true)}
              >
                <Plus size={16} />
                Adicionar materiais
              </button>
            </div>
          </div>
          {closed && (
            <p className="demo-notice">
              Este ciclo está encerrado. Para alterar materiais e grupos,
              reabra-o em Editar ciclo.
            </p>
          )}
          <section className="panel cycle-planning-panel">
            <div className="toolbar">
              <div>
                <h2>Materiais do ciclo</h2>
                <p className="muted">
                  {filtered.length} de {lines.length} materiais ·{" "}
                  {lines.filter((line) => line.plannedQuantity === null).length}{" "}
                  com quantidade a definir
                </p>
              </div>
              <div className="cycle-inline-actions">
                <label className="catalog-search">
                  <Search size={16} />
                  <input
                    aria-label="Buscar materiais do ciclo"
                    placeholder="Buscar código, material ou grupo"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <button
                  className="secondary-button"
                  disabled={!!storageError}
                  onClick={() => setManageGroups(true)}
                >
                  <FolderPlus size={16} />
                  Grupos e modelos
                </button>
              </div>
            </div>
            <div
              className="cycle-group-filter"
              role="group"
              aria-label="Filtrar grupo de solicitação"
            >
              <button
                className={groupFilter === "all" ? "active" : ""}
                onClick={() => setGroupFilter("all")}
              >
                Todos ({lines.length})
              </button>
              <button
                className={groupFilter === "none" ? "active" : ""}
                onClick={() => setGroupFilter("none")}
              >
                Sem grupo ({lines.filter((line) => !line.requestGroupId).length}
                )
              </button>
              {groups.map((group) => (
                <button
                  key={group.id}
                  className={groupFilter === group.id ? "active" : ""}
                  onClick={() => setGroupFilter(group.id)}
                >
                  {group.name} (
                  {
                    lines.filter((line) => line.requestGroupId === group.id)
                      .length
                  }
                  )
                </button>
              ))}
            </div>
            <div className="cycle-selection-bar">
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={
                    !!filtered.length &&
                    filtered.every((line) => selected.includes(line.id))
                  }
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? filtered.map((line) => line.id) : [],
                    )
                  }
                />
                Selecionar resultados ({filtered.length})
              </label>
              <div className="cycle-inline-actions">
                <label className="cycle-bulk-group">
                  <span className="sr-only">
                    Grupo para os materiais selecionados
                  </span>
                  <select
                    aria-label="Grupo para os materiais selecionados"
                    value={moveGroup}
                    disabled={locked || !selected.length}
                    onChange={(e) => setMoveGroup(e.target.value)}
                  >
                    <option value="">Escolha um grupo</option>
                    <option value="none">Sem grupo</option>
                    {groups.map((group) => (
                      <option value={group.id} key={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondary-button"
                  disabled={locked || !selected.length || !moveGroup}
                  onClick={() =>
                    attempt(() => {
                      const selectedLines = filtered.filter((line) =>
                        selected.includes(line.id),
                      );
                      const changed = selectedLines.filter(
                        (line) =>
                          line.requestGroupId !==
                          (moveGroup === "none" ? null : moveGroup),
                      );
                      if (!changed.length) {
                        setMessage("Os materiais selecionados já estão neste grupo. Nenhuma alteração foi feita.");
                        return;
                      }
                      setPendingGroupChange({ lines: changed, groupId: moveGroup === "none" ? null : moveGroup });
                    })
                  }
                >
                  Aplicar grupo
                </button>
                <button
                  className="secondary-button"
                  disabled={locked || !selected.length}
                  onClick={saveModel}
                >
                  Salvar seleção como modelo
                </button>
                <button
                  className="secondary-button"
                  disabled={locked || !selected.length}
                  onClick={() =>
                    attempt(() => {
                      if (
                        !window.confirm(
                          `Retirar ${selected.length} materiais deste ciclo? Eles continuam no cadastro MXM e nos demais ciclos.`,
                        )
                      )
                        return;
                      const result = removePlanningItems(
                        workspace,
                        cycles,
                        cycle.id,
                        selected,
                      );
                      onCommit(
                        result.workspace,
                        lineEvents(
                          result.removed,
                          "Remoção de ciclo",
                          `Material retirado do ciclo ${cycle.name}. Cadastro e histórico preservados.`,
                        ),
                      );
                      setMessage(
                        `${result.removed.length} materiais retirados do ciclo.`,
                      );
                      setSelected([]);
                    })
                  }
                >
                  Retirar do ciclo ({selected.length})
                </button>
              </div>
            </div>
            <p className="cycle-integration-note">
              Pedidos ainda não conectados. As colunas de solicitado, trânsito,
              recebido e falta solicitar serão calculadas após a integração. O traço (—) indica que esses dados ainda não estão disponíveis.
            </p>
            <div className="table-wrap">
              <table className="cycle-materials-table">
                <colgroup><col className="cycle-col-select" /><col className="cycle-col-code" /><col /><col className="cycle-col-unit" /><col className="cycle-col-planned" /><col className="cycle-col-group" /><col className="cycle-col-total" /><col className="cycle-col-total" /><col className="cycle-col-total" /><col className="cycle-col-pending" /></colgroup>
                <thead>
                  <tr>
                    <th>Selecionar</th>
                    <th>Código</th>
                    <th>Descrição</th>
                    <th>Unidade</th>
                    <th>Necessidade prevista</th>
                    <th>Grupo de solicitação</th>
                    <th>Solicitado</th>
                    <th>Em trânsito</th>
                    <th>Recebido</th>
                    <th>Falta solicitar</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(page * 50, (page + 1) * 50).map((line) => {
                    const item = byItemId.get(line.itemId);
                    return (
                      <tr key={line.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Selecionar no ciclo ${item?.code ?? line.itemId}`}
                            checked={selected.includes(line.id)}
                            onChange={(e) =>
                              setSelected((current) =>
                                e.target.checked
                                  ? [...current, line.id]
                                  : current.filter((id) => id !== line.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="item-code-button"
                            disabled={locked}
                            aria-label={`Planejar ${item?.code ?? line.itemId}`}
                            onClick={() => setLineForm(line)}
                          >
                            {item?.code ?? line.itemId}
                          </button>
                        </td>
                        <td className="cycle-material-description">
                          <strong>
                            {item?.description ??
                              "Material ausente no cadastro"}
                          </strong>
                          {item?.active === false && (
                            <small>Inativo no cadastro MXM</small>
                          )}
                          {line.notes && <small>{line.notes}</small>}
                        </td>
                        <td>{item?.unit ?? "—"}</td>
                        <td className="numeric-cell">
                          {line.plannedQuantity === null ? (
                            <span className="tag tag-amber">A definir</span>
                          ) : (
                            line.plannedQuantity.toLocaleString("pt-BR", {
                              maximumFractionDigits: 6,
                            })
                          )}
                          <small>
                            {line.forecastBasis || "Base não informada"}
                          </small>
                        </td>
                        <td>
                          {groupNames.get(line.requestGroupId ?? "") ??
                            "Sem grupo"}
                        </td>
                        {[0, 1, 2, 3].map((index) => (
                          <td className="cycle-unconnected" key={index} aria-label="Não conectado" title="Pedidos ainda não conectados">
                            —
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={10} className="empty-state">
                        {lines.length
                          ? "Nenhum material neste recorte. Ajuste a busca ou o grupo."
                          : "Este ciclo ainda não possui materiais. Use Adicionar materiais ou traga uma seleção do cadastro."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="cycle-pagination">
              <span>{selected.length} materiais selecionados</span>
              <button
                className="secondary-button"
                disabled={!page}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </button>
              <span>
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
          </section>
        </>
      )}
      {pendingGroupChange && cycle && <ConfirmGroupChangeDialog
        count={pendingGroupChange.lines.length}
        origins={[...new Set(pendingGroupChange.lines.map(line => groupNames.get(line.requestGroupId ?? "") ?? "Sem grupo"))]}
        destination={groupNames.get(pendingGroupChange.groupId ?? "") ?? "Sem grupo"}
        onClose={() => setPendingGroupChange(null)}
        onConfirm={() => {
          if (locked) throw new Error("Este ciclo não está disponível para edição.");
          let next = workspace;
          for (const previous of pendingGroupChange.lines) {
            const current = workspace.lines.find(line => line.id === previous.id && line.cycleId === cycle.id);
            if (!current || current.requestGroupId !== previous.requestGroupId) throw new Error("A seleção mudou. Cancele e revise os grupos antes de continuar.");
            next = editPlanningLine(next, cycles, { ...current, requestGroupId: pendingGroupChange.groupId });
          }
          onCommit(next, pendingGroupChange.lines.map(line => ({ itemId: line.itemId, action: "Alteração de grupo no ciclo", details: `Ciclo: ${cycle.name}. Grupo: ${groupNames.get(line.requestGroupId ?? "") ?? "Sem grupo"} → ${groupNames.get(pendingGroupChange.groupId ?? "") ?? "Sem grupo"}.` })));
          setMessage(`${pendingGroupChange.lines.length} materiais atualizados no grupo de solicitação.`);
          setMoveGroup("");
          setPendingGroupChange(null);
        }}
      />}
      {cycleForm && (
        <CycleForm
          cycle={cycleForm === "new" ? undefined : cycleForm}
          onClose={() => setCycleForm(null)}
          onSave={(draft, id) => {
            const savedId = onSaveCycle(draft, id);
            setCycleForm(null);
            openCycle(savedId);
            setMessage(
              id
                ? "Ciclo atualizado."
                : "Ciclo criado. Agora adicione materiais e grupos de solicitação.",
            );
          }}
        />
      )}
      {picker && cycle && (
        <CycleItemPicker
          items={items}
          existingIds={lines.map((line) => line.itemId)}
          groups={groups}
          defaultGroupId={
            groups.some((group) => group.id === groupFilter)
              ? groupFilter
              : null
          }
          onClose={() => setPicker(false)}
          onAdd={(ids, groupId) => {
            const result = addPlanningItems(
              workspace,
              cycles,
              items,
              cycle.id,
              ids,
              groupId,
            );
            onCommit(
              result.workspace,
              result.added.map((item) => ({
                itemId: item.id,
                action: "Inclusão em ciclo",
                details: `Ciclo: ${cycle.name}. Grupo: ${groupNames.get(groupId ?? "") ?? "Sem grupo"}. Quantidade a definir.`,
              })),
            );
            setPicker(false);
            setGroupFilter(groupId ?? "all");
            setMessage(
              `${result.added.length} materiais incluídos. ${result.duplicateCount} já estavam no ciclo; ${result.unavailableCount} indisponíveis ou inativos.`,
            );
          }}
        />
      )}
      {lineForm && cycle && (
        <CycleLineForm
          line={lineForm}
          item={byItemId.get(lineForm.itemId)}
          groups={groups}
          onClose={() => setLineForm(null)}
          onSave={(next) => {
            const previous = workspace.lines.find(
              (line) => line.id === next.id,
            );
            const updated = editPlanningLine(workspace, cycles, next);
            const saved = updated.lines.find((line) => line.id === next.id)!;
            const detail = `Ciclo: ${cycle.name}. Quantidade: ${previous?.plannedQuantity ?? "A definir"} → ${saved.plannedQuantity ?? "A definir"}. Grupo: ${groupNames.get(previous?.requestGroupId ?? "") ?? "Sem grupo"} → ${groupNames.get(saved.requestGroupId ?? "") ?? "Sem grupo"}. Base: ${previous?.forecastBasis || "Não informada"} → ${saved.forecastBasis || "Não informada"}. Observação: ${previous?.notes || "(vazio)"} → ${saved.notes || "(vazio)"}.`;
            onCommit(
              updated,
              previous && JSON.stringify(previous) !== JSON.stringify(saved)
                ? [
                    {
                      itemId: next.itemId,
                      action: "Planejamento do ciclo alterado",
                      details: detail,
                    },
                  ]
                : [],
            );
            setLineForm(null);
            setMessage("Necessidade salva para este ciclo.");
          }}
        />
      )}
      {manageGroups && cycle && (
        <CycleGroupsDialog
          workspace={workspace}
          cycles={cycles}
          items={items}
          cycleId={cycle.id}
          onCommit={onCommit}
          onClose={() => setManageGroups(false)}
          onApplied={(groupId, message) => {
            setGroupFilter(groupId);
            setMessage(message);
          }}
        />
      )}
    </div>
  );
}
