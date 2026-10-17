import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Boxes, CalendarDays, CheckCircle2,
  ChevronDown, ClipboardList, FileText, LayoutDashboard, PackageSearch,
  Search, Truck, WalletCards, FileUp, Trash2, Download
} from "lucide-react";
import { demoCycleItems, demoCycles, demoItems, demoOrders } from "./data";
import type { Item, ItemHistoryEntry, SupplyCycle } from "./types";

type Section = "Painel" | "Cadastro de itens" | "Ciclos de suprimento" | "Pedidos diretos" | "Planejamento DLs" | "Controle DLs" | "Acompanhamento de pedidos";

const nav: { label: string; section: Section; icon: typeof LayoutDashboard }[] = [
  { label: "Painel", section: "Painel", icon: LayoutDashboard },
  { label: "Cadastro de itens", section: "Cadastro de itens", icon: Boxes },
  { label: "Ciclos de suprimentos", section: "Ciclos de suprimento", icon: CalendarDays },
  { label: "Pedidos diretos", section: "Pedidos diretos", icon: Truck },
  { label: "Planejamento DLs", section: "Planejamento DLs", icon: WalletCards },
  { label: "Controle DLs", section: "Controle DLs", icon: WalletCards },
  { label: "Acompanhamento de pedidos", section: "Acompanhamento de pedidos", icon: ClipboardList },
];

function readLocalCollection<T>(key: string, fallback: T[]): T[] {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalCollection<T>(key: string, value: T[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Não foi possível salvar os dados locais de ${key}.`, error);
  }
}

function App() {
  const [section, setSection] = useState<Section>("Painel");
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState("Todos");
  const [filterGroup, setFilterGroup] = useState("Todos");
  const [filterCriterion, setFilterCriterion] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [visibilityFilter, setVisibilityFilter] = useState("visiveis");
  const [editorMode, setEditorMode] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [bulkDestination, setBulkDestination] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const catalogWrapRef = useRef<HTMLDivElement>(null);
  const fixedScrollRef = useRef<HTMLDivElement>(null);
  const fixedScrollInnerRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);
  const [catalogWidth, setCatalogWidth] = useState(0);
  const [history, setHistory] = useState<ItemHistoryEntry[]>(() => readLocalCollection("suprimentos:item-history:v1", []));
  const [sortMode, setSortMode] = useState("description");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [importMessage, setImportMessage] = useState("");
  const [importPreview, setImportPreview] = useState<{ newCount: number; updateCount: number; unchangedCount: number; rows: Item[] } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>(() => readLocalCollection("suprimentos:items:v1", demoItems));
  const [cycles, setCycles] = useState<SupplyCycle[]>(() => readLocalCollection("suprimentos:cycles:v1", demoCycles));
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCycle, setShowAddCycle] = useState(false);
  const [newItem, setNewItem] = useState({ code: "", description: "", unit: "KG", type: "GÊNEROS ALIMENTÍCIOS", group: "CEREAIS", criterion: "Mensal" as Item["criterion"] });
  const [newCycle, setNewCycle] = useState<Omit<SupplyCycle, "id">>({ name: "", solicitationStart: "", firstDelivery: "", lastDelivery: "", closingDate: "", status: "Planejamento" });

  useEffect(() => writeLocalCollection("suprimentos:items:v1", items), [items]);
  useEffect(() => writeLocalCollection("suprimentos:cycles:v1", cycles), [cycles]);
  useEffect(() => writeLocalCollection("suprimentos:item-history:v1", history), [history]);
  function recordHistory(item: Item, action: string, details: string) {
    setHistory((current) => [{ id: `hist-${crypto.randomUUID()}`, itemId: item.id, code: item.code, action, details, timestamp: new Date().toISOString() }, ...current]);
  }

  const types = useMemo(() => [...new Set(items.map((item) => item.type || "SEM TIPO").filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [items]);
  const groups = useMemo(() => [...new Set(items.filter((item) => filterType === "Todos" || (item.type || "SEM TIPO") === filterType).map((item) => item.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [items, filterType]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return items.filter((item) => {
      const matchesQuery = !q || `${item.code} ${item.description} ${item.group} ${item.criterion} ${item.unit}`.toLocaleLowerCase("pt-BR").includes(q);
      const matchesType = filterType === "Todos" || (item.type || "SEM TIPO") === filterType;
      const matchesGroup = filterGroup === "Todos" || item.group === filterGroup;
      const matchesCriterion = filterCriterion === "Todos" || item.criterion === filterCriterion;
      const matchesStatus = filterStatus === "Todos" || (filterStatus === "Ativo" ? item.active !== false : item.active === false);
      const matchesVisibility = visibilityFilter === "todos" || (visibilityFilter === "visiveis" ? item.visible !== false : item.visible === false);
      return matchesQuery && matchesType && matchesGroup && matchesCriterion && matchesStatus && matchesVisibility;
    }).sort((a, b) => {
      if (sortMode === "code") return a.code.localeCompare(b.code, "pt-BR", { numeric: true, sensitivity: "base" });
      if (sortMode === "group") return a.group.localeCompare(b.group, "pt-BR") || a.description.localeCompare(b.description, "pt-BR");
      return a.description.localeCompare(b.description, "pt-BR", { numeric: true, sensitivity: "base" });
    });
  }, [items, query, filterType, filterGroup, filterCriterion, filterStatus, visibilityFilter, sortMode]);

  useEffect(() => {
    const el = catalogWrapRef.current;
    if (!el) return;
    const update = () => setCatalogWidth(el.scrollWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [filteredItems?.length, section, filterType, filterGroup]);

  function parseDelimitedText(text: string): Record<string, string>[] {
    const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new Error("O arquivo precisa conter cabeçalho e pelo menos uma linha de item.");
    const delimiter = [";", ",", "\t"].sort((a, b) => (lines[0].split(b).length - 1) - (lines[0].split(a).length - 1))[0];
    const splitLine = (line: string) => {
      const cells: string[] = []; let current = ""; let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i + 1] === '"' && quoted) { current += '"'; i++; }
        else if (ch === '"') quoted = !quoted;
        else if (ch === delimiter && !quoted) { cells.push(current.trim()); current = ""; }
        else current += ch;
      }
      cells.push(current.trim()); return cells;
    };
    const normalizeHeader = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const headers = splitLine(lines[0]).map(normalizeHeader);
    const aliases: Record<string, string[]> = {
      code: ["codigo", "codigomxm", "codigounicomxm", "codigounico", "item", "material"],
      description: ["descricao", "descricaoitem", "descricaodoproduto", "produto", "materialdescricao"],
      unit: ["unidade", "und", "un"],
      group: ["grupo", "grupodemateriais", "grupodematerial"],
      type: ["tipo", "tipodematerial", "categoria"],
      criterion: ["criterio", "criteriodesolicitacao", "solicitacao", "tiposolicitacao"]
    };
    const indexes: Record<string, number> = {};
    for (const key of Object.keys(aliases)) indexes[key] = headers.findIndex((h) => aliases[key].includes(h));
    if (indexes.code < 0 || indexes.description < 0) throw new Error("Não encontrei as colunas obrigatórias Código e Descrição. Use esses cabeçalhos no Excel.");
    return lines.slice(1).map((line) => {
      const cells = splitLine(line); const row: Record<string, string> = {};
      for (const key of Object.keys(indexes)) row[key] = indexes[key] < 0 ? "" : (cells[indexes[key]] ?? "").trim();
      return row;
    }).filter((r) => r.code && r.description);
  }

  async function handleImportFile(file?: File) {
    if (!file) return;
    setImportMessage(""); setImportPreview(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "txt") {
      setImportMessage("Por enquanto, importe CSV. No Excel, use Arquivo → Salvar como → CSV UTF-8 (delimitado por vírgulas). O arquivo .xlsx ainda não está habilitado nesta versão.");
      return;
    }
    try {
      const parsed = parseDelimitedText(await file.text());
      const existing = new Map(items.map((item) => [item.code.trim().toUpperCase(), item]));
      const rows: Item[] = parsed.map((r, index) => {
        const code = r.code.trim().toUpperCase(); const old = existing.get(code);
        const criterionRaw = r.criterion.trim().toLowerCase();
        const criterion: Item["criterion"] = criterionRaw === "entrada e saída" || criterionRaw === "entrada e saida" ? "Entrada e saída" : criterionRaw === "sob solicitação" || criterionRaw === "sob solicitacao" ? "Sob solicitação" : "Mensal";
        return { id: old?.id ?? `import-${code}-${index}`, code, description: r.description.trim().toUpperCase(), unit: (r.unit || old?.unit || "UN").trim().toUpperCase(), type: (r.type || old?.type || "SEM TIPO").trim().toUpperCase(), group: (r.group || old?.group || "SEM GRUPO").trim().toUpperCase(), visible: old?.visible ?? true, criterion: r.criterion ? criterion : (old?.criterion ?? "Mensal"), active: old?.active ?? true } as Item;
      });
      const newCount = rows.filter((r) => !existing.has(r.code)).length;
      const updateCount = rows.filter((r) => { const old = existing.get(r.code); return old && (old.description !== r.description || old.unit !== r.unit || old.group !== r.group || old.criterion !== r.criterion); }).length;
      const unchangedCount = rows.length - newCount - updateCount;
      setImportPreview({ newCount, updateCount, unchangedCount, rows });
    } catch (error) { setImportMessage(error instanceof Error ? error.message : "Não foi possível ler o arquivo."); }
  }

  function confirmImport() {
    if (!importPreview) return;
    const known = new Set(items.map((item) => item.code.toUpperCase()));
    const added = importPreview.rows.filter((row) => !known.has(row.code.toUpperCase()));
    setItems((current) => [...current, ...added]);
    added.forEach((item) => recordHistory(item, "Cadastro por importação", "Item novo incluído por arquivo CSV/TXT."));
    setImportMessage(`Importação concluída: ${added.length} novos itens adicionados. ${importPreview.updateCount} códigos já existentes foram preservados sem sobrescrita.`);
    setImportPreview(null); if (importInputRef.current) importInputRef.current.value = "";
  }

  function deleteSelectedItems() {
    if (!selectedItemIds.length) return;
    const confirmation = window.prompt(`Você selecionou ${selectedItemIds.length} item(ns). Para confirmar a exclusão, digite EXCLUIR em maiúsculas.`);
    if (confirmation !== "EXCLUIR") { window.alert("Exclusão cancelada. O texto precisa ser exatamente EXCLUIR."); return; }
    const selected = new Set(selectedItemIds);
    items.filter((item) => selected.has(item.id)).forEach((item) => recordHistory(item, "Exclusão do catálogo", "Item removido do catálogo local mediante confirmação."));
    setItems((current) => current.filter((item) => !selected.has(item.id)));
    setSelectedItemIds([]);
    window.alert("Itens removidos deste catálogo de demonstração. Isso não exclui registros de banco de dados nem verifica vínculos com pedidos nesta versão.");
  }

  function downloadTemplate() {
    const csv = "Código;Descrição;Unidade;Tipo;Grupo;Critério de solicitação\r\nES1300000000001;ARROZ PARBOILIZADO;KG;GÊNEROS ALIMENTÍCIOS;CEREAIS;Mensal\r\n";
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = "modelo_importacao_itens.csv"; link.click(); URL.revokeObjectURL(url);
  }

  const activeCycle = cycles[0] ?? demoCycles[0];
  const cycleRows = demoCycleItems.filter((line) => line.cycleId === activeCycle.id);
  const pendingOrders = demoOrders.filter((order) => order.status !== "Concluído").length;
  const directOrders = demoOrders.filter((order) => order.type === "PCD");

  function addItem() {
    if (!newItem.code.trim() || !newItem.description.trim()) return;
    if (items.some((item) => item.code.toLowerCase() === newItem.code.trim().toLowerCase())) {
      window.alert("Já existe um item com esse código.");
      return;
    }
    const createdItem: Item = {
      id: `local-${crypto.randomUUID()}`,
      code: newItem.code.trim().toUpperCase(),
      description: newItem.description.trim().toUpperCase(),
      unit: newItem.unit.trim().toUpperCase() || "UN",
      type: newItem.type.trim().toUpperCase() || "SEM TIPO",
      group: newItem.group.trim().toUpperCase() || "SEM GRUPO",
      visible: true,
      criterion: newItem.criterion,
      active: true,
    };
    setItems((prev) => [...prev, createdItem]);
    recordHistory(createdItem, "Cadastro manual", "Item incluído manualmente no catálogo.");
    setNewItem({ code: "", description: "", unit: "KG", type: "GÊNEROS ALIMENTÍCIOS", group: "CEREAIS", criterion: "Mensal" });
    setShowAddItem(false);
    window.alert("Item incluído nesta sessão de demonstração. Ainda não foi gravado em banco de dados.");
  }

  function saveEditedItem() {
    if (!editingItem) return;
    if (!editorMode) { window.alert("Ative o perfil Editor para alterar o cadastro."); return; }
    const code = editingItem.code.trim().toUpperCase();
    if (!code || !editingItem.description.trim()) { window.alert("Código e descrição são obrigatórios."); return; }
    if (items.some((item) => item.id !== editingItem.id && item.code.toUpperCase() === code)) { window.alert("Já existe outro item com esse código."); return; }
    const updated = { ...editingItem, code, description: editingItem.description.trim().toUpperCase(), unit: editingItem.unit.trim().toUpperCase(), type: (editingItem.type || "SEM TIPO").trim().toUpperCase(), group: editingItem.group.trim().toUpperCase() };
    const old = items.find((item) => item.id === updated.id);
    setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
    recordHistory(updated, "Edição de cadastro", `Cadastro editado. Descrição anterior: ${old?.description ?? "—"}; descrição atual: ${updated.description}.`);
    setEditingItem(null);
  }

  function toggleVisibility(item: Item) {
    const updated = { ...item, visible: item.visible === false };
    setItems((current) => current.map((row) => row.id === item.id ? updated : row));
    recordHistory(updated, updated.visible ? "Item exibido" : "Item ocultado", updated.visible ? "Item voltou aos filtros operacionais." : "Item ocultado dos filtros operacionais; cadastro e histórico mantidos.");
  }

  function prepareBulkAction() {
    if (!selectedItemIds.length || !bulkDestination) return;
    const selected = items.filter((item) => selectedItemIds.includes(item.id));
    const label = bulkDestination === "cycle" ? "Ciclos de suprimento" : bulkDestination === "dl" ? "Planejamento DLs" : "Pedidos diretos";
    setBulkMessage(`${selected.length} item(ns) selecionado(s) encaminhado(s) para preparação em “${label}”. Nenhum ciclo, pedido ou saldo foi criado automaticamente.`);
    selected.forEach((item) => recordHistory(item, "Encaminhado para preparação", `Destino escolhido: ${label}.`));
    setSection(bulkDestination === "cycle" ? "Ciclos de suprimento" : bulkDestination === "dl" ? "Planejamento DLs" : "Pedidos diretos");
    setBulkDestination("");
  }

  function addCycle() {
    const dates = [newCycle.solicitationStart, newCycle.firstDelivery, newCycle.lastDelivery, newCycle.closingDate];
    if (!newCycle.name.trim() || dates.some((date) => !date)) {
      window.alert("Preencha o nome e todas as datas do ciclo.");
      return;
    }
    if (dates.some((date, index) => index > 0 && date < dates[index - 1])) {
      window.alert("Confira a ordem das datas: solicitações, primeira entrega, última entrega e fechamento.");
      return;
    }
    if (cycles.some((cycle) => cycle.name.toLocaleLowerCase("pt-BR") === newCycle.name.trim().toLocaleLowerCase("pt-BR"))) {
      window.alert("Já existe um ciclo com esse nome.");
      return;
    }

    setCycles((current) => [...current, { ...newCycle, name: newCycle.name.trim(), id: `cycle-local-${crypto.randomUUID()}` }]);
    setNewCycle({ name: "", solicitationStart: "", firstDelivery: "", lastDelivery: "", closingDate: "", status: "Planejamento" });
    setShowAddCycle(false);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark brand-logo">sesc</div>
          <div><strong>Suprimentos</strong><span>Planejamento e controle</span></div>
        </div>
        <div className="nav-label">GESTÃO</div>
        <nav>
          {nav.map(({ label, section: targetSection, icon: Icon }) => (
            <button key={targetSection} className={`nav-item ${section === targetSection ? "active" : ""}`} onClick={() => setSection(targetSection)}>
              <Icon size={18} /><span>{label}</span>{targetSection === "Acompanhamento de pedidos" && <small>{pendingOrders}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mode-pill"><span className="status-dot" /> Protótipo local</div>
          <p>Dados fictícios para validação do fluxo. Não usar para operações reais.</p>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">Suprimentos <span>/</span> {section}</div>
          <div className="user-chip"><div className="avatar">US</div><span>Usuário de teste</span><ChevronDown size={15} /></div>
        </header>

        <div className="page-content">
          {bulkMessage && section !== "Cadastro de itens" && <div className="notice"><CheckCircle2 size={17} /><span>{bulkMessage}</span></div>}
          {section === "Painel" && (
            <>
              <div className="page-heading">
                <div><p className="eyebrow">VISÃO GERAL</p><h1>Painel de suprimentos</h1><p className="muted">Acompanhe o planejamento, os pedidos e as pendências em um só lugar.</p></div>
                <button className="primary-button" onClick={() => setSection("Ciclos de suprimento")}><CalendarDays size={17} /> Consultar ciclos</button>
              </div>
              <div className="metric-grid">
                <Metric icon={<ClipboardList size={19} />} label="Ciclos cadastrados" value={String(cycles.length)} detail="Períodos de planejamento" />
                <Metric icon={<PackageSearch size={19} />} label="Itens no catálogo" value={String(items.length)} detail="Cadastro mestre" />
                <Metric icon={<Truck size={19} />} label="Pedidos em aberto" value={String(pendingOrders)} detail="Inclui pedidos parciais" />
                <Metric icon={<AlertTriangle size={19} />} label="Exceções registradas" value="0" detail="No protótipo demonstrativo" />
              </div>
              <div className="content-grid">
                <section className="panel">
                  <div className="panel-heading"><div><h2>Ciclo em destaque</h2><p>Planejamento e execução</p></div><span className="tag tag-green">{activeCycle.status}</span></div>
                  <h3 className="cycle-title">{activeCycle.name}</h3>
                  <div className="date-grid">
                    <DateInfo label="Início das solicitações" value={activeCycle.solicitationStart} />
                    <DateInfo label="Primeira entrega" value={activeCycle.firstDelivery} />
                    <DateInfo label="Última entrega" value={activeCycle.lastDelivery} />
                    <DateInfo label="Fechamento" value={activeCycle.closingDate} />
                  </div>
                  <div className="table-wrap">
                    <table><thead><tr><th>Item</th><th>Planejado</th><th>Comprometido</th><th>Recebido</th></tr></thead>
                      <tbody>{cycleRows.map((line) => {
                        const item = items.find((candidate) => candidate.id === line.itemId);
                        return <tr key={line.id}><td><strong>{item?.description ?? "Item removido"}</strong><small>{item?.code}</small></td><td>{line.plannedQuantity} {item?.unit}</td><td>{line.committedQuantity} {item?.unit}</td><td>{line.receivedQuantity} {item?.unit}</td></tr>;
                      })}</tbody>
                    </table>
                  </div>
                  <div className="panel-footer"><span>{cycleRows.length} itens distintos no ciclo</span><button className="text-button" onClick={() => setSection("Ciclos de suprimento")}>Ver ciclo <span>→</span></button></div>
                </section>
                <section className="panel">
                  <div className="panel-heading"><div><h2>Atenção operacional</h2><p>Regras que o sistema deverá validar</p></div><AlertTriangle size={20} className="warning-icon" /></div>
                  <div className="attention-item"><div className="attention-icon"><CheckCircle2 size={18} /></div><div><strong>Origem do PDF identificada</strong><p>Selecionar o pedido ERP específico que identifica o PDL de origem.</p></div></div>
                  <div className="attention-item"><div className="attention-icon"><WalletCards size={18} /></div><div><strong>Saldo livre separado do recebido</strong><p>Pedidos emitidos comprometem saldo; recebimento é acompanhado separadamente.</p></div></div>
                  <div className="attention-item"><div className="attention-icon"><FileText size={18} /></div><div><strong>ERP permanece oficial</strong><p>O aplicativo acompanha pedidos, mas não substitui o estoque físico nem gera pedidos corporativos.</p></div></div>
                  <div className="note-box"><strong>Próxima etapa sugerida</strong><p>Validar cadastro e ciclos antes de implementar pedidos e saldos das DLs.</p></div>
                </section>
              </div>
            </>
          )}

          {section === "Cadastro de itens" && (
            <>
              <div className="page-heading">
                <div><p className="eyebrow">DADOS SISTEMA MXM</p><h1>Cadastro de itens</h1><p className="muted">Catálogo mestre de materiais. Importe, filtre, ordene e selecione vários itens.</p></div>
                <div className="form-actions">
                  <input ref={importInputRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={(e) => void handleImportFile(e.target.files?.[0])} />
                  <button className="secondary-button" onClick={downloadTemplate}><Download size={17} /> Modelo CSV</button>
                  <button className="secondary-button" onClick={() => importInputRef.current?.click()}><FileUp size={17} /> Importar planilha</button>
                  <button className="primary-button" onClick={() => setShowAddItem((v) => !v)}><Boxes size={17} /> {showAddItem ? "Cancelar" : "Novo item"}</button>
                </div>
              </div>
              {importMessage && <div className="notice"><AlertTriangle size={17} /><span>{importMessage}</span></div>}
              {importPreview && <section className="panel form-panel"><h2>Conferir importação antes de aplicar</h2><p>Novos: <strong>{importPreview.newCount}</strong> · Serão atualizados: <strong>{importPreview.updateCount}</strong> · Sem alteração: <strong>{importPreview.unchangedCount}</strong></p><p className="form-note">A correspondência é feita pelo Código. Itens novos serão adicionados; códigos existentes serão preservados sem sobrescrita. Para alterar um item existente, use Editar no cadastro.</p><div className="form-actions"><button className="secondary-button" onClick={() => { setImportPreview(null); if (importInputRef.current) importInputRef.current.value = ""; }}>Cancelar importação</button><button className="primary-button" onClick={confirmImport}>Confirmar importação</button></div></section>}
              {showAddItem && <section className="panel form-panel">
                <h2>Novo item</h2>
                <div className="form-grid">
                  <label>Código único MXM<input value={newItem.code} onChange={(e) => setNewItem({ ...newItem, code: e.target.value.toUpperCase() })} placeholder="Ex.: ES1300000000001" /></label>
                  <label>Descrição<input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value.toUpperCase() })} placeholder="Descrição do produto" /></label>
                  <label>Unidade<input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value.toUpperCase() })} /></label>
                  <label>Tipo<input value={newItem.type} onChange={(e) => setNewItem({ ...newItem, type: e.target.value.toUpperCase() })} /></label>
                  <label>Grupo<input value={newItem.group} onChange={(e) => setNewItem({ ...newItem, group: e.target.value.toUpperCase() })} /></label>
                  <label>Critério de solicitação<select value={newItem.criterion} onChange={(e) => setNewItem({ ...newItem, criterion: e.target.value as Item["criterion"] })}><option>Mensal</option><option>Entrada e saída</option><option>Sob solicitação</option></select></label>
                </div>
                <div className="form-actions"><button className="secondary-button" onClick={() => setShowAddItem(false)}>Cancelar</button><button className="primary-button" onClick={addItem}>Adicionar à demonstração</button></div>
                <p className="form-note">Dados salvos apenas neste navegador. A conexão ao banco será feita em etapa posterior.</p>
              </section>}
              <section className="panel">
                <div className="toolbar"><div><h2>Catálogo de itens</h2><p>{filteredItems.length} de {items.length} itens exibidos</p></div><div className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código, descrição, grupo ou unidade" /></div></div>
                <div className="catalog-filters">
                  <label>Tipo<select value={filterType} onChange={(e) => { setFilterType(e.target.value); setFilterGroup("Todos"); }}><option>Todos</option>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
                  <label>Grupo<select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}><option>Todos</option>{groups.map((group) => <option key={group}>{group}</option>)}</select></label>
                  <label>Critério<select value={filterCriterion} onChange={(e) => setFilterCriterion(e.target.value)}><option>Todos</option><option>Mensal</option><option>Entrada e saída</option><option>Sob solicitação</option></select></label>
                  <label>Status<select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option>Todos</option><option>Ativo</option><option>Inativo</option></select></label>
                  <label>Mostrar<select value={visibilityFilter} onChange={(e) => setVisibilityFilter(e.target.value)}><option value="visiveis">Visíveis</option><option value="ocultos">Ocultos</option><option value="todos">Todos</option></select></label>
                  <label>Ordenar por<select value={sortMode} onChange={(e) => setSortMode(e.target.value)}><option value="description">Descrição (A–Z)</option><option value="code">Código (A–Z)</option><option value="group">Grupo e descrição</option></select></label>
                </div>
                <div className="form-actions catalog-bulk-actions" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                  <label className="select-all-label"><input type="checkbox" checked={filteredItems.length > 0 && filteredItems.every((item) => selectedItemIds.includes(item.id))} onChange={(e) => setSelectedItemIds(e.target.checked ? [...new Set([...selectedItemIds, ...filteredItems.map((item) => item.id)])] : selectedItemIds.filter((id) => !filteredItems.some((item) => item.id === id)))} /> Selecionar todos os itens filtrados</label>
                  <div className="bulk-actions-right">
                    <select aria-label="Adicionar itens selecionados a" value={bulkDestination} onChange={(e) => setBulkDestination(e.target.value)}><option value="">Adicionar a…</option><option value="cycle">Ciclo de suprimento</option><option value="dl">Planejamento DLs</option><option value="order">Preparação de pedido direto</option></select>
                    <button className="secondary-button" disabled={!selectedItemIds.length || !bulkDestination} onClick={prepareBulkAction}>Preparar seleção ({selectedItemIds.length})</button>
                    <button className="secondary-button" disabled={!selectedItemIds.length} onClick={deleteSelectedItems}><Trash2 size={16} /> Excluir selecionados</button>
                  </div>
                </div>
                {bulkMessage && <div className="notice"><CheckCircle2 size={17} /><span>{bulkMessage}</span></div>}
                <div className="role-toolbar"><span>Permissão de edição: <strong>{editorMode ? "Editor (demonstração)" : "Consulta"}</strong></span><button className="secondary-button" onClick={() => setEditorMode((current) => !current)}>{editorMode ? "Usar perfil Consulta" : "Ativar perfil Editor"}</button><span className="form-note">Controle ilustrativo; não substitui autenticação real.</span></div>
                <div className="table-wrap catalog-table-wrap" ref={catalogWrapRef} onScroll={(e) => { if (syncingScroll.current || !fixedScrollRef.current) return; syncingScroll.current = true; fixedScrollRef.current.scrollLeft = e.currentTarget.scrollLeft; syncingScroll.current = false; }}><table className="catalog-table"><thead><tr><th>Selecionar</th><th>Código</th><th>Descrição</th><th>Unidade</th><th>Critério</th><th>Status</th><th>Grupo</th><th>Tipo</th><th>Ações</th></tr></thead><tbody>
                  {filteredItems.map((item) => <tr key={item.id}><td><input aria-label={`Selecionar ${item.code}`} type="checkbox" checked={selectedItemIds.includes(item.id)} onChange={(e) => setSelectedItemIds((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /></td><td className="code-cell">{item.code}</td><td><strong>{item.description}</strong></td><td>{item.unit}</td><td><span className="tag tag-neutral">{item.criterion}</span></td><td><span className={`tag ${item.active === false ? "tag-amber" : "tag-green"}`}>{item.active === false ? "Inativo" : "Ativo"}</span></td><td>{item.group}</td><td>{item.type || "SEM TIPO"}</td><td><div className="row-actions"><button className="text-button" disabled={!editorMode} onClick={() => setEditingItem({ ...item, type: item.type || "SEM TIPO", visible: item.visible !== false })}>Editar</button><button className="text-button" onClick={() => toggleVisibility(item)}>{item.visible === false ? "Mostrar" : "Ocultar"}</button></div></td></tr>)}
                  {filteredItems.length === 0 && <tr><td colSpan={9} className="empty-state">Nenhum item corresponde aos filtros.</td></tr>}
                </tbody></table></div>
                <div className="catalog-fixed-scroll" ref={fixedScrollRef} onScroll={(e) => { if (syncingScroll.current || !catalogWrapRef.current) return; syncingScroll.current = true; catalogWrapRef.current.scrollLeft = e.currentTarget.scrollLeft; syncingScroll.current = false; }}><div ref={fixedScrollInnerRef} style={{ width: `${catalogWidth}px`, height: 1 }} /></div>
                {editingItem && <section className="edit-item-panel"><div className="panel-heading"><div><h2>Editar item {editingItem.code}</h2><p>Alterações serão registradas no histórico local.</p></div><button className="secondary-button" onClick={() => setEditingItem(null)}>Fechar</button></div><div className="form-grid"><label>Código<input value={editingItem.code} onChange={(e) => setEditingItem({ ...editingItem, code: e.target.value.toUpperCase() })} /></label><label>Descrição<input value={editingItem.description} onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value.toUpperCase() })} /></label><label>Unidade<input value={editingItem.unit} onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value.toUpperCase() })} /></label><label>Tipo<input value={editingItem.type || "SEM TIPO"} onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value.toUpperCase() })} /></label><label>Grupo<input value={editingItem.group} onChange={(e) => setEditingItem({ ...editingItem, group: e.target.value.toUpperCase() })} /></label><label>Critério<select value={editingItem.criterion} onChange={(e) => setEditingItem({ ...editingItem, criterion: e.target.value as Item["criterion"] })}><option>Mensal</option><option>Entrada e saída</option><option>Sob solicitação</option></select></label><label>Status<select value={editingItem.active === false ? "Inativo" : "Ativo"} onChange={(e) => setEditingItem({ ...editingItem, active: e.target.value === "Ativo" })}><option>Ativo</option><option>Inativo</option></select></label></div><div className="form-actions"><button className="secondary-button" onClick={() => setEditingItem(null)}>Cancelar</button><button className="primary-button" disabled={!editorMode} onClick={saveEditedItem}>Salvar alterações</button></div></section>}
                <section className="history-panel"><div className="panel-heading"><div><h2>Histórico de alterações</h2><p>Eventos locais mais recentes do catálogo.</p></div></div>{history.length ? <div className="history-list">{history.slice(0, 20).map((entry) => <div className="history-row" key={entry.id}><strong>{entry.code} · {entry.action}</strong><span>{entry.details}</span><small>{new Date(entry.timestamp).toLocaleString("pt-BR")}</small></div>)}</div> : <p className="muted">Ainda não há eventos registrados.</p>}</section>
                <p className="form-note">Importação nesta versão aceita CSV/TXT exportado do Excel. A importação .xlsx nativa ainda precisa de uma biblioteca específica. Exclusões afetam somente a demonstração local e não verificam vínculos com ciclos ou pedidos.</p>
              </section>
            </>
          )}

          {section === "Ciclos de suprimento" && (
            <>
              <div className="page-heading"><div><p className="eyebrow">PLANEJAMENTO</p><h1>Ciclos de suprimento</h1><p className="muted">Períodos de planejamento conectados ao cadastro mestre de itens.</p></div><button className="secondary-button" onClick={() => setShowAddCycle((current) => !current)}>{showAddCycle ? "Cancelar" : "Novo ciclo"} <CalendarDays size={17} /></button></div>
              {showAddCycle && <section className="panel form-panel">
                <h2>Novo ciclo</h2>
                <div className="form-grid">
                  <label>Nome do ciclo<input value={newCycle.name} onChange={(event) => setNewCycle({ ...newCycle, name: event.target.value })} placeholder="Ex.: Janeiro 2027" /></label>
                  <label>Início das solicitações<input type="date" value={newCycle.solicitationStart} onChange={(event) => setNewCycle({ ...newCycle, solicitationStart: event.target.value })} /></label>
                  <label>Primeira entrega<input type="date" value={newCycle.firstDelivery} onChange={(event) => setNewCycle({ ...newCycle, firstDelivery: event.target.value })} /></label>
                  <label>Última entrega<input type="date" value={newCycle.lastDelivery} onChange={(event) => setNewCycle({ ...newCycle, lastDelivery: event.target.value })} /></label>
                  <label>Fechamento<input type="date" value={newCycle.closingDate} onChange={(event) => setNewCycle({ ...newCycle, closingDate: event.target.value })} /></label>
                  <label>Status<select value={newCycle.status} onChange={(event) => setNewCycle({ ...newCycle, status: event.target.value as SupplyCycle["status"] })}><option>Planejamento</option><option>Em execução</option><option>Encerrado</option></select></label>
                </div>
                <div className="form-actions"><button className="secondary-button" onClick={() => setShowAddCycle(false)}>Cancelar</button><button className="primary-button" onClick={addCycle}>Criar ciclo</button></div>
                <p className="form-note">O ciclo fica salvo neste navegador. Ainda não será salvo no banco de dados.</p>
              </section>}
              <div className="cycle-list">{cycles.map((cycle) => {
                const lines = demoCycleItems.filter((line) => line.cycleId === cycle.id);
                return <section className="panel cycle-card" key={cycle.id}><div className="panel-heading"><div><p className="eyebrow">{cycle.id}</p><h2>{cycle.name}</h2></div><span className={`tag ${cycle.status === "Em execução" ? "tag-green" : "tag-neutral"}`}>{cycle.status}</span></div><div className="date-grid"><DateInfo label="Solicitações" value={cycle.solicitationStart} /><DateInfo label="1ª entrega" value={cycle.firstDelivery} /><DateInfo label="Última entrega" value={cycle.lastDelivery} /><DateInfo label="Fechamento" value={cycle.closingDate} /></div><div className="panel-footer"><span>{lines.length} itens vinculados no protótipo</span><span className="muted">Edição será conectada ao banco</span></div></section>;
              })}</div>
            </>
          )}

          {section === "Pedidos diretos" && (
            <>
              <div className="page-heading"><div><p className="eyebrow">EXECUÇÃO</p><h1>Pedidos diretos</h1><p className="muted">Pedidos do tipo PCD registrados no protótipo.</p></div><button className="secondary-button" onClick={() => window.alert("O fluxo de criação de pedidos diretos será implementado após a validação das regras de compromisso e saldo.")}>Preparar pedido <FileText size={17} /></button></div>
              <section className="panel">
                <div className="toolbar"><div><h2>Fila de pedidos diretos</h2><p>{directOrders.length} pedidos demonstrativos</p></div></div>
                <div className="table-wrap"><table><thead><tr><th>Item</th><th>Ciclo</th><th>Solicitado</th><th>Recebido</th><th>Entrega prevista</th><th>Status</th></tr></thead><tbody>
                  {directOrders.map((order) => <tr key={order.id}><td><strong>{order.itemDescription}</strong></td><td>{order.cycleName}</td><td>{order.requestedQuantity}</td><td>{order.receivedQuantity}</td><td>{order.expectedDelivery}</td><td><span className={`tag ${order.status === "Recebimento parcial" ? "tag-amber" : "tag-neutral"}`}>{order.status}</span></td></tr>)}
                  {directOrders.length === 0 && <tr><td colSpan={6} className="empty-state">Nenhum pedido direto cadastrado na demonstração.</td></tr>}
                </tbody></table></div>
              </section>
            </>
          )}

          {section === "Planejamento DLs" && (
            <>
              <div className="page-heading"><div><p className="eyebrow">PLANEJAMENTO</p><h1>Planejamento DLs</h1><p className="muted">Distribuição do planejamento de suprimentos por DL.</p></div></div>
              <section className="panel"><div className="empty-panel"><div className="empty-icon"><WalletCards size={27} /></div><h2>Planejamento por DL ainda não cadastrado</h2><p>O protótipo possui quantidades planejadas por ciclo, mas ainda não define a distribuição dessas quantidades entre as DLs.</p><div className="rule-callout"><strong>Informações necessárias</strong><span>Cadastro das DLs e definição de como cada item e ciclo será distribuído antes de gerar pedidos.</span></div></div></section>
            </>
          )}

          {section === "Acompanhamento de pedidos" && (
            <>
              <div className="page-heading"><div><p className="eyebrow">EXECUÇÃO</p><h1>Acompanhamento de pedidos</h1><p className="muted">Visão consolidada dos pedidos registrados e de seus recebimentos.</p></div><button className="secondary-button" onClick={() => window.alert("O fluxo de criação de pedidos será implementado depois da validação das regras de compromisso e saldo.")}>Preparar pedido <FileText size={17} /></button></div>
              <section className="panel"><div className="toolbar"><div><h2>Fila de acompanhamento</h2><p>Dados demonstrativos; referências ERP são ilustrativas.</p></div></div><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Item</th><th>Ciclo</th><th>Pedido ERP</th><th>Solicitado</th><th>Recebido</th><th>Entrega prevista</th><th>Status</th></tr></thead><tbody>{demoOrders.map((order) => <tr key={order.id}><td><span className="tag tag-neutral">{order.type}</span></td><td><strong>{order.itemDescription}</strong></td><td>{order.cycleName}</td><td>{order.erpOrderNumber ?? "Pendente"}</td><td>{order.requestedQuantity}</td><td>{order.receivedQuantity}</td><td>{order.expectedDelivery}</td><td><span className={`tag ${order.status === "Recebimento parcial" ? "tag-amber" : "tag-neutral"}`}>{order.status}</span></td></tr>)}</tbody></table></div><div className="notice"><AlertTriangle size={17} /><span>Um pedido atrasado não deve liberar automaticamente a quantidade comprometida. É necessária confirmação de cancelamento ou não entrega.</span></div></section>
            </>
          )}

          {section === "Controle DLs" && (
            <>
              <div className="page-heading"><div><p className="eyebrow">LICITAÇÕES</p><h1>Controle DLs</h1><p className="muted">Acompanhe os saldos por item licitado e o pedido ERP de origem.</p></div><button className="secondary-button" onClick={() => window.alert("A tela de saldos será ativada após implementar PDLs, itens licitados e compromissos no banco.")}>Ver regras <WalletCards size={17} /></button></div>
              <section className="panel"><div className="empty-panel"><div className="empty-icon"><WalletCards size={27} /></div><h2>Estrutura preparada para o próximo módulo</h2><p>O saldo não será digitado isoladamente. Será calculado a partir da quantidade licitada, dos compromissos válidos, dos recebimentos e dos cancelamentos registrados.</p><div className="rule-callout"><strong>Regra obrigatória para PDF</strong><span>Selecionar o pedido ERP que identifica o PDL de origem; validar saldo disponível e planejamento antes da emissão.</span></div></div></section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <div className="metric-card"><div className="metric-top"><span className="metric-icon">{icon}</span><span className="muted">{label}</span></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}
function DateInfo({ label, value }: { label: string; value: string }) {
  const formatted = value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—";
  return <div className="date-info"><span>{label}</span><strong>{formatted}</strong></div>;
}

export default App;
