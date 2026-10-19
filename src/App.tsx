import Tarefas from "./pages/administracao/Tarefas";
import {resolveDLRequestStage} from "./services/dlRequest";
import type { DLPlan, DLSaveOptions } from "./types/dl";
import { dlWorkspaceKey, emptyDLWorkspace, readDLWorkspace, storeDLPlan } from "./services/dlPlanning";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Boxes, CalendarDays, CheckCircle2,
  ChevronDown, ClipboardList, FileText, PackageSearch,
  Search, Truck, WalletCards, FileUp, Trash2, Download, ArrowDownAZ
} from "lucide-react";
import { demoCycles, demoItems, demoOrders } from "./data";
import type { CycleItemEvent, CycleWorkspace, Item, ItemHistoryEntry, SupplyCycle } from "./types";
import OrdersNavigation from "./components/OrdersNavigation";
import AppSidebar, { navigationLocation, orderSections } from "./components/AppSidebar";
import type { AppSection } from "./components/AppSidebar";
import PlanejamentoControleDLs from "./pages/estoque/PlanejamentoControleDLs";
import AcompanhamentoATAContratos from "./pages/compras/AcompanhamentoATAContratos";
import CiclosSuprimento from "./pages/estoque/CiclosSuprimento";
import CycleDestinationDialog from "./components/CycleDestinationDialog";
import { addPlanningItems, cycleWorkspaceKey, emptyCycleWorkspace, readCycleWorkspace, validateCycle, writeLocalTransaction } from "./services/cyclePlanning";
import ShareItemsDialog from "./components/ShareItemsDialog";
import ItemDetailsDialog from "./components/ItemDetailsDialog";
import CatalogImportPreview from "./components/CatalogImportPreview";
import { buildImportPreview, planImportUpdates } from "./services/catalogImport";
import type { ImportPreview, ImportSelection } from "./services/catalogImport";
import CatalogActionMenu from "./components/CatalogActionMenu";
import CatalogTypeFilter, { readCatalogTypeView } from "./components/CatalogTypeFilter";

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
  const [section, setSection] = useState<AppSection>("Painel");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[] | null>(readCatalogTypeView);
  const [filterType, setFilterType] = useState("Todos");
  const [filterGroup, setFilterGroup] = useState("Todos");
  const [filterCriterion, setFilterCriterion] = useState("Todos");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [editorMode, setEditorMode] = useState(false);
  const [shareItems, setShareItems] = useState<Item[] | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
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
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const importReadId = useRef(0);
  const [items, setItems] = useState<Item[]>(() => readLocalCollection("suprimentos:items:v1", demoItems));
  const importCatalogRef = useRef(items);
  importCatalogRef.current = items;
  const [cycles, setCycles] = useState<SupplyCycle[]>(() => readLocalCollection("suprimentos:cycles:v1", demoCycles));
  const [showAddItem, setShowAddItem] = useState(false);
  const [cycleState, setCycleState] = useState(() => {
    try { return { workspace: readCycleWorkspace(localStorage.getItem(cycleWorkspaceKey)), error: "" }; }
    catch (cause) { return { workspace: emptyCycleWorkspace(), error: cause instanceof Error ? cause.message : "Não foi possível ler o planejamento salvo. Os dados originais foram preservados." }; }
  });
  const [dlState, setDLState] = useState(() => {
    try { return { workspace: readDLWorkspace(localStorage.getItem(dlWorkspaceKey)), error: "" }; }
    catch (cause) { return { workspace: emptyDLWorkspace(), error: cause instanceof Error ? cause.message : "Não foi possível ler as DLs salvas." }; }
  });
  const [dlPendingItems, setDLPendingItems] = useState<Item[] | null>(null);
  const [dlDirty, setDLDirty] = useState(false);
  const dlWorkspace = dlState.workspace;
  const cycleWorkspace = cycleState.workspace;
  const [cycleDestinationItems, setCycleDestinationItems] = useState<Item[] | null>(null);
  const [openCycleId, setOpenCycleId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ code: "", description: "", unit: "KG", type: "GÊNEROS ALIMENTÍCIOS", group: "CEREAIS", criterion: "Mensal" as Item["criterion"] });

  useEffect(() => writeLocalCollection("suprimentos:items:v1", items), [items]);
  useEffect(() => writeLocalCollection("suprimentos:cycles:v1", cycles), [cycles]);
  useEffect(() => writeLocalCollection("suprimentos:item-history:v1", history), [history]);
  function recordHistory(item: Item, action: string, details: string) {
    setHistory((current) => [{ id: `hist-${crypto.randomUUID()}`, itemId: item.id, code: item.code, action, details, timestamp: new Date().toISOString() }, ...current]);
  }

  const allTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) { const name = item.type || "SEM TIPO"; counts.set(name, (counts.get(name) ?? 0) + 1); }
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [items]);
  const permittedItems = useMemo(() => items.filter(item => selectedTypes === null || selectedTypes.includes(item.type || "SEM TIPO")), [items, selectedTypes]);
  const types = useMemo(() => [...new Set(permittedItems.map(item => item.type || "SEM TIPO"))].sort((a, b) => a.localeCompare(b, "pt-BR")), [permittedItems]);
  const typeItems = useMemo(() => permittedItems.filter(item => filterType === "Todos" || (item.type || "SEM TIPO") === filterType), [permittedItems, filterType]);
  const groups = useMemo(() => [...new Set(typeItems.map(item => item.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")), [typeItems]);
  const criteria = useMemo(() => [...new Set(typeItems.filter(item => filterGroup === "Todos" || item.group === filterGroup).map(item => item.criterion))].sort((a, b) => a.localeCompare(b, "pt-BR")), [typeItems, filterGroup]);

  function changeTypeView(next: string[] | null) {
    setSelectedTypes(next); setFilterType("Todos"); setFilterGroup("Todos");
    setFilterCriterion("Todos"); setFilterStatus("Todos");
    setSelectedItemIds([]); setBulkMessage("");
  }

  useEffect(() => {
    if (filterType !== "Todos" && !types.includes(filterType)) setFilterType("Todos");
    if (filterGroup !== "Todos" && !groups.includes(filterGroup)) setFilterGroup("Todos");
    if (filterCriterion !== "Todos" && !criteria.some(value => value === filterCriterion)) setFilterCriterion("Todos");
  }, [types, groups, criteria, filterType, filterGroup, filterCriterion]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return permittedItems.filter((item) => {
      const matchesQuery = !q || `${item.code} ${item.description} ${item.group} ${item.criterion} ${item.unit}`.toLocaleLowerCase("pt-BR").includes(q);
      const matchesType = filterType === "Todos" || (item.type || "SEM TIPO") === filterType;
      const matchesGroup = filterGroup === "Todos" || item.group === filterGroup;
      const matchesCriterion = filterCriterion === "Todos" || item.criterion === filterCriterion;
      const matchesStatus = filterStatus === "Todos" || (filterStatus === "Ativo" ? item.active !== false : item.active === false);
      return matchesQuery && matchesType && matchesGroup && matchesCriterion && matchesStatus;
    }).sort((a, b) => {
      if (sortMode === "code") return a.code.localeCompare(b.code, "pt-BR", { numeric: true, sensitivity: "base" });
      if (sortMode === "group") return a.group.localeCompare(b.group, "pt-BR") || a.description.localeCompare(b.description, "pt-BR");
      return a.description.localeCompare(b.description, "pt-BR", { numeric: true, sensitivity: "base" });
    });
  }, [permittedItems, query, filterType, filterGroup, filterCriterion, filterStatus, sortMode]);

  useEffect(() => {
    const visibleIds = new Set(filteredItems.map(item => item.id));
    setSelectedItemIds(current => {
      const next = current.filter(id => visibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [filteredItems]);

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

  const importBackupVersion = useMemo(() => JSON.stringify({ items, cycles, history, cycleWorkspace, dlWorkspace }), [items, cycles, history, cycleWorkspace, dlWorkspace]);

  function cancelImport() {
    importReadId.current++;
    setImportPreview(null);
    if (importInputRef.current) importInputRef.current.value = "";
  }

  async function handleImportFile(file?: File) {
    if (!file) return;
    const readId = ++importReadId.current;
    setImportMessage(""); setImportPreview(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "csv" && ext !== "txt") {
      setImportMessage("Importe CSV ou TXT exportado do MXM/Excel. A leitura de XLSX ainda não está habilitada."); return;
    }
    try {
      const text = await file.text();
      if (readId !== importReadId.current) return;
      if (items !== importCatalogRef.current) throw new Error("O cadastro mudou durante a leitura. Selecione o arquivo novamente.");
      setImportPreview(buildImportPreview(text, items, file.name));
    } catch (error) {
      if (readId === importReadId.current) setImportMessage(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
    } finally { if (readId === importReadId.current && importInputRef.current) importInputRef.current.value = ""; }
  }

  function persistImport(nextItems: Item[], events: ItemHistoryEntry[]) {
    // Persist the catalog before committing React state; a quota/access failure must not report success.
    const nextHistory = [...events, ...history];
    const previousItems = localStorage.getItem("suprimentos:items:v1");
    const previousHistory = localStorage.getItem("suprimentos:item-history:v1");
    if ((previousItems !== null && previousItems !== JSON.stringify(items)) || (previousHistory !== null && previousHistory !== JSON.stringify(history))) {
      throw new Error("Os dados foram alterados em outra aba. Recarregue a página e importe novamente antes de continuar.");
    }
    try {
      localStorage.setItem("suprimentos:items:v1", JSON.stringify(nextItems));
      localStorage.setItem("suprimentos:item-history:v1", JSON.stringify(nextHistory));
    } catch {
      if (previousItems === null) localStorage.removeItem("suprimentos:items:v1");
      else localStorage.setItem("suprimentos:items:v1", previousItems);
      throw new Error("Não foi possível salvar a importação no navegador. Nenhuma alteração foi aplicada. Verifique o espaço disponível.");
    }
    setItems(nextItems); setHistory(nextHistory);
  }

  function importEvent(item: Item, action: string, details: string): ItemHistoryEntry {
    return { id: `hist-${crypto.randomUUID()}`, itemId: item.id, code: item.code, action, details, timestamp: new Date().toISOString() };
  }

  function addImportedItems() {
    if (!importPreview) return;
    try {
      const known = new Set(items.map(item => item.code.trim().toUpperCase()));
      const added = importPreview.newItems.filter(item => !known.has(item.code.trim().toUpperCase()));
      if (!added.length) throw new Error("Esses códigos já foram incluídos. Importe a lista novamente para conferir.");
      persistImport([...items, ...added], added.map(item => importEvent(item, "Cadastro por importação", `Item novo incluído pelo arquivo ${importPreview.filename}. Itens existentes preservados.`)));
      setImportMessage(`${added.length} novos itens adicionados. Nenhum item existente foi alterado.`);
      if (importPreview.updates.length) setImportPreview({ ...importPreview, newItems: [] }); else cancelImport();
    } catch (error) { setImportMessage(error instanceof Error ? error.message : "Não foi possível adicionar os itens."); }
  }

  function downloadImportBackup() {
    const data = JSON.stringify({ format: "suprimentos-catalog-backup-v1", createdAt: new Date().toISOString(), ...JSON.parse(importBackupVersion) }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url;
    link.download = `suprimentos-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function updateImportedItems(selection: ImportSelection, confirmation: string, backupVersion: string) {
    if (!importPreview || !editorMode) throw new Error("Ative o perfil Editor para atualizar existentes.");
    if (confirmation !== "ATUALIZAR") throw new Error("Digite exatamente ATUALIZAR para confirmar.");
    if (backupVersion !== importBackupVersion) throw new Error("Os dados mudaram. Gere um novo backup antes de continuar.");
    const result = planImportUpdates(importPreview, selection, items);
    if (!result.updated.length) throw new Error("Selecione ao menos um campo para atualizar.");
    persistImport(result.items, result.updated.map(entry => importEvent(entry.item, "Atualização por importação", `Arquivo: ${importPreview.filename}\n${entry.changes.map(change => `${change.label}: ${change.before || "(vazio)"} → ${change.after}`).join("\n")}`)));
    setImportMessage(`${result.updated.length} itens atualizados somente nos campos escolhidos. Especificações, status e vínculos foram preservados.`);
    // Retain unapproved changes for a later review, without applying them implicitly.
    const remaining = importPreview.updates.flatMap(entry => {
      const applied = result.updated.find(updated => updated.item.id === entry.before.id);
      const changes = entry.changes.filter(change => !applied?.changes.some(done => done.field === change.field));
      return changes.length ? [{ before: applied?.item ?? entry.before, changes }] : [];
    });
    if (remaining.length || importPreview.newItems.length) setImportPreview({ ...importPreview, updates: remaining }); else cancelImport();
  }

  function deleteSelectedItems() {
    if (!selectedItemIds.length) return;
    if (dlState.error || dlWorkspace.plans.some(plan => plan.lines.some(line => selectedItemIds.includes(line.itemId)))) { window.alert("Há vínculos com DLs ou dados que não puderam ser conferidos. Use o status Inativo para preservar o histórico."); return; }
    if (cycleState.error) { window.alert("Não é possível conferir os vínculos dos ciclos agora. A exclusão foi bloqueada para preservar seus dados."); return; }
    if (cycleWorkspace.lines.some(line => selectedItemIds.includes(line.itemId))) {
      window.alert("Há materiais vinculados a ciclos nesta seleção. Para preservar os vínculos, retire-os dos ciclos antes de excluir ou use o status Inativo no cadastro."); return;
    }
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
  const cycleRows = cycleWorkspace.lines.filter((line) => line.cycleId === activeCycle.id);
  const pendingOrders = demoOrders.filter((order) => order.status !== "Concluído").length;
  const directOrders = demoOrders.filter((order) => order.type === "PCD");

  function addItem() {
    if (!newItem.code.trim() || !newItem.description.trim()) return;
    if (!newItem.unit.trim()) { window.alert("Informe a unidade do material, conforme o MXM. A unidade não será preenchida automaticamente."); return; }
    if (items.some((item) => item.code.toLowerCase() === newItem.code.trim().toLowerCase())) {
      window.alert("Já existe um item com esse código.");
      return;
    }
    const createdItem: Item = {
      id: `local-${crypto.randomUUID()}`,
      code: newItem.code.trim().toUpperCase(),
      description: newItem.description.trim().toUpperCase(),
      unit: newItem.unit.trim().toUpperCase(),
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
    if (!editingItem.unit.trim()) { window.alert("Informe a unidade do material, conforme o MXM."); return; }
    if (items.some((item) => item.id !== editingItem.id && item.code.toUpperCase() === code)) { window.alert("Já existe outro item com esse código."); return; }
    const updated = { ...editingItem, code, description: editingItem.description.trim().toUpperCase(), unit: editingItem.unit.trim().toUpperCase(), type: (editingItem.type || "SEM TIPO").trim().toUpperCase(), group: editingItem.group.trim().toUpperCase(), technicalSpecification: (editingItem.technicalSpecification ?? "").trim() };
    const old = items.find((item) => item.id === updated.id);
    setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
    const changes: string[] = [];
    const fields: { key: "code" | "description" | "unit" | "type" | "group" | "criterion" | "technicalSpecification"; label: string }[] = [
      { key: "code", label: "Código MXM" }, { key: "description", label: "Descrição" },
      { key: "unit", label: "Unidade" }, { key: "type", label: "Tipo" }, { key: "group", label: "Grupo" },
      { key: "criterion", label: "Critério" }, { key: "technicalSpecification", label: "Especificação técnica" },
    ];
    for (const field of fields) {
      if ((old?.[field.key] ?? "") !== (updated[field.key] ?? "")) {
        changes.push(`${field.label}: ${old?.[field.key] || "(vazio)"} → ${updated[field.key] || "(vazio)"}`);
      }
    }
    if (old && old.active !== updated.active) changes.push(`Status: ${old.active ? "Ativo" : "Inativo"} → ${updated.active ? "Ativo" : "Inativo"}`);
    if (changes.length) recordHistory(updated, "Edição de cadastro", changes.join("\n"));
    setEditingItem(null);
  }

  function prepareBulkAction(destination: string) {
    if (!["cycle", "dl", "order", "share"].includes(destination)) return;
    const selected = filteredItems.filter((item) => selectedItemIds.includes(item.id));
    if (!selected.length) return;
    if (destination === "share") { setShareItems(selected); return; }
    if (destination === "cycle") { setCycleDestinationItems(selected); return; }
    if (destination === "dl") {setDLPendingItems(selected); setSection("Planejamento DLs"); return;}
    const label = destination === "dl" ? "Planejamento DLs" : "Pedidos diretos";
    setBulkMessage(`${selected.length} item(ns) selecionado(s) encaminhado(s) para preparação em “${label}”. Nenhum ciclo, pedido ou saldo foi criado automaticamente.`);
    selected.forEach((item) => recordHistory(item, "Encaminhado para preparação", `Destino escolhido: ${label}.`));
    setSection(destination === "dl" ? "Planejamento DLs" : "Pedidos diretos");
  }

  function saveDLPlan(candidate: DLPlan, action: string, options?: DLSaveOptions) {
    if (dlState.error) throw new Error(dlState.error);
    if (JSON.stringify(readDLWorkspace(localStorage.getItem(dlWorkspaceKey))) !== JSON.stringify(dlWorkspace) || (localStorage.getItem("suprimentos:item-history:v1") !== null && localStorage.getItem("suprimentos:item-history:v1") !== JSON.stringify(history))) throw new Error("As DLs ou o histórico mudaram em outra aba. Recarregue antes de salvar.");
    const previous = dlWorkspace.plans.find(plan => plan.id === candidate.id);
    candidate = resolveDLRequestStage(candidate,previous);
    const changes: string[] = [];
    for (const key of ["title", "category", "openedOn", "responsible", "justification", "notes", "deliveryDate", "plannedValidityMonths", "stage"] as const) {
      if (previous?.[key] !== candidate[key]) changes.push(`${({title:"Objeto", category:"Categoria", openedOn:"Abertura", responsible:"Solicitante", justification:"Observação / Justificativa", notes:"Observações legadas", deliveryDate:"Data de entrega", plannedValidityMonths:"Vigência prevista (meses)", stage:"Situação"})[key]}: ${previous?.[key] || "(vazio)"} → ${candidate[key] || "(vazio)"}`);
    }
    for (const key of Object.keys(candidate.request) as (keyof DLPlan["request"])[]) if (previous?.request[key] !== candidate.request[key] && (previous?.request[key] || candidate.request[key])) changes.push(`Requisição (${key}): ${previous?.request[key] || "(vazio)"} → ${candidate.request[key] || "(vazio)"}`);
    if (JSON.stringify(previous?.requestReview) !== JSON.stringify(candidate.requestReview)) changes.push(candidate.requestReview ? `Análise da requisição MXM ${candidate.requestReview.mxmNumber} confirmada em ${candidate.requestReview.timestamp}. Situação: Em processo. Identificação: ${candidate.requestReview.actor}.` : "Análise anterior invalidada pela devolução ou reabertura do planejamento.");
    if (JSON.stringify(previous?.schedule) !== JSON.stringify(candidate.schedule)) {
      const labels = {coverageStart:"Início do abastecimento",coverageMonths:"Meses de abastecimento",plannedAuthorizationOn:"Previsão da autorização",authorizationRequestedOn:"Solicitação à gerência",authorizationGrantedOn:"Autorização recebida",plannedRequestOn:"Previsão da requisição",processMonths:"Prazo do processo em meses",deliveryDays:"Prazo da entrega em dias",deliveryDayBasis:"Contagem da entrega",deliveredOn:"Entrega realizada (acompanhamento)"};
      for (const key of Object.keys(labels) as (keyof typeof labels)[]) if(previous?.schedule?.[key] !== candidate.schedule?.[key]) changes.push(`Cronograma · ${labels[key]}: ${previous?.schedule?.[key] ?? "(não informado)"} → ${candidate.schedule?.[key] ?? "(não informado)"}`);
    }
    if(JSON.stringify(previous?.requestSubmission)!==JSON.stringify(candidate.requestSubmission)) changes.push(candidate.requestSubmission?`Requisição MXM ${candidate.requestSubmission.mxmNumber}, de ${candidate.requestSubmission.requestDate}, enviada explicitamente para análise em ${candidate.requestSubmission.timestamp}. Edição bloqueada até devolução.`:"Envio anterior invalidado pela reabertura do planejamento; será necessário reenviar para análise.");
    if(JSON.stringify(previous?.requestReturn)!==JSON.stringify(candidate.requestReturn)&&candidate.requestReturn)changes.push(`Requisição devolvida para correção em ${candidate.requestReturn.timestamp}. Observação: ${candidate.requestReturn.reason}`);
    if (JSON.stringify(previous?.processFlow) !== JSON.stringify(candidate.processFlow)) changes.push(`Etapas do processo: ${JSON.stringify(previous?.processFlow ?? {})} → ${JSON.stringify(candidate.processFlow ?? {})}`);
    const itemEvents: ItemHistoryEntry[] = [];
    for (const itemId of new Set([...(previous?.lines ?? []).map(line => line.itemId), ...candidate.lines.map(line => line.itemId)])) {
      const old = previous?.lines.find(line => line.itemId === itemId); const next = candidate.lines.find(line => line.itemId === itemId);
      if (JSON.stringify(old) === JSON.stringify(next)) continue;
      const item = items.find(item => item.id === itemId);
      const details = `${candidate.code} · ${item?.code ?? itemId}: ${!old ? "Incluído no planejamento" : !next ? "Retirado do planejamento" : "Orçamento alterado"}. Quantidade: ${old?.quantityMilli == null ? "a definir" : old.quantityMilli / 1000} → ${next?.quantityMilli == null ? "a definir" : next.quantityMilli / 1000}. Preço previsto (R$): ${old?.estimatedPriceCents == null ? "a definir" : old.estimatedPriceCents / 100} → ${next?.estimatedPriceCents == null ? "a definir" : next.estimatedPriceCents / 100}. Unidade: ${next?.unit ?? old?.unit}.`;
      changes.push(details); itemEvents.push({id:`hist-${crypto.randomUUID()}`,itemId,code:item?.code ?? itemId,action:"Planejamento de DL",details,timestamp:new Date().toISOString()});
    }
    if (JSON.stringify(previous?.contract) !== JSON.stringify(candidate.contract)) {
      const oldContract = previous?.contract; const nextContract = candidate.contract;
      const describe = (award: NonNullable<DLPlan["contract"]>["awards"][number] | undefined) => award ? `Fornecedor: ${award.supplier || "a definir"} (${award.supplierReference || "sem identificação"}); pedido MXM ${award.mxmOrder || "a definir"}, data ${award.orderDate || "a definir"}; quantidade ${award.quantityMilli === null ? "a definir" : award.quantityMilli/1000}; preço final R$ ${award.unitPriceCents === null ? "a definir" : award.unitPriceCents/100}` : "Sem contratação";
      for (const key of ["signedOn","validFrom","validUntil","validityMode","validityMonths","orderDatesFromContract","notes"] as const) if (oldContract?.[key] !== nextContract?.[key] && (oldContract?.[key] || nextContract?.[key])) changes.push(`Contratação (${({signedOn:"Data da contratação / Emissão do pedido",orderDatesFromContract:"Data do pedido vinculada à contratação",validityMode:"Cálculo da vigência",validityMonths:"Vigência em meses",validFrom:"Início da vigência",validUntil:"Fim da vigência",notes:"Observações"})[key]}): ${oldContract?.[key] || "(vazio)"} → ${nextContract?.[key] || "(vazio)"}`);
      for (const line of candidate.lines) {
        const old = oldContract?.awards.find(award => award.lineId === line.id); const next = nextContract?.awards.find(award => award.lineId === line.id);
        const oldReason = oldContract?.notAwarded.find(result => result.lineId === line.id)?.reason; const nextReason = nextContract?.notAwarded.find(result => result.lineId === line.id)?.reason;
        if (JSON.stringify(old) === JSON.stringify(next) && oldReason === nextReason && !nextContract?.release) continue;
        const item = items.find(item => item.id === line.itemId);
        const details = `${candidate.code} · ${item?.code ?? line.itemId}: ${describe(old)}${oldReason !== undefined ? `; Não contratado: ${oldReason}` : ""} → ${describe(next)}${nextReason !== undefined ? `; Não contratado: ${nextReason}` : ""}.${nextContract?.release ? ` Conclusão confirmada: ${nextContract.release.reference}. Saldo inicial ${next?.quantityMilli === null || !next ? 0 : next.quantityMilli/1000} ${line.unit}.` : ""}`;
        changes.push(details); itemEvents.push({id:`hist-${crypto.randomUUID()}`,itemId:line.itemId,code:item?.code ?? line.itemId,action:nextContract?.release?"DL concluída e saldo inicial registrado":"Resultado de contratação alterado",details,timestamp:new Date().toISOString()});
      }
      if (!changes.length) changes.push("Rascunho da contratação atualizado.");
    }
    if(options?.release && candidate.lines.some(line => !items.some(item => item.id === line.itemId))) throw new Error("Há um material sem cadastro válido. Revise antes de concluir a DL.");
    if (previous && !changes.length) return previous;
    const result = storeDLPlan(dlWorkspace,candidate,action,changes.join("\n"),options);
    const nextHistory = [...itemEvents,...history];
    writeLocalTransaction(localStorage,[[dlWorkspaceKey,JSON.stringify(result.workspace)],["suprimentos:item-history:v1",JSON.stringify(nextHistory)]]);
    setDLState({workspace:result.workspace,error:""}); setHistory(nextHistory); setDLDirty(false); return result.plan;
  }

  function commitCycleChange(nextCycles: SupplyCycle[], nextWorkspace: CycleWorkspace, events: CycleItemEvent[]) {
    if (cycleState.error) throw new Error(cycleState.error);
    const storedCycles = localStorage.getItem("suprimentos:cycles:v1");
    const storedHistory = localStorage.getItem("suprimentos:item-history:v1");
    if ((storedCycles !== null && storedCycles !== JSON.stringify(cycles)) || (storedHistory !== null && storedHistory !== JSON.stringify(history)) || JSON.stringify(readCycleWorkspace(localStorage.getItem(cycleWorkspaceKey))) !== JSON.stringify(cycleWorkspace)) {
      throw new Error("O planejamento ou histórico mudou em outra aba. Recarregue antes de continuar.");
    }
    const now = new Date().toISOString();
    const nextHistory = [...events.map(event => ({ ...event, id: `hist-${crypto.randomUUID()}`, code: items.find(item => item.id === event.itemId)?.code ?? event.itemId, timestamp: now })), ...history];
    writeLocalTransaction(localStorage, [[cycleWorkspaceKey, JSON.stringify(nextWorkspace)], ["suprimentos:cycles:v1", JSON.stringify(nextCycles)], ["suprimentos:item-history:v1", JSON.stringify(nextHistory)]]);
    setCycles(nextCycles); setCycleState({ workspace: nextWorkspace, error: "" }); setHistory(nextHistory);
  }

  function saveCycle(draft: Omit<SupplyCycle, "id">, id?: string) {
    const validated = validateCycle(draft, cycles, id);
    if (id && !cycles.some(cycle => cycle.id === id)) throw new Error("O ciclo não foi encontrado.");
    const saved = { ...validated, id: id ?? `cycle-${crypto.randomUUID()}` };
    const old = cycles.find(cycle => cycle.id === id);
    const changed = old && (["name", "solicitationStart", "firstDelivery", "lastDelivery", "closingDate", "status"] as const).some(key => old[key] !== saved[key]);
    const events = old && changed ? cycleWorkspace.lines.filter(line => line.cycleId === id).map(line => ({ itemId: line.itemId, action: "Dados do ciclo alterados", details: `Ciclo: ${old.name} → ${saved.name}. Situação: ${old.status} → ${saved.status}. Solicitações: ${old.solicitationStart} → ${saved.solicitationStart}. Primeira entrega: ${old.firstDelivery} → ${saved.firstDelivery}. Última entrega: ${old.lastDelivery} → ${saved.lastDelivery}. Fechamento: ${old.closingDate} → ${saved.closingDate}.` })) : [];
    commitCycleChange(id ? cycles.map(cycle => cycle.id === id ? saved : cycle) : [...cycles, saved], cycleWorkspace, events);
    return saved.id;
  }

  function addCatalogSelectionToCycle(cycleId: string, groupId: string | null) {
    if (!cycleDestinationItems) return;
    const result = addPlanningItems(cycleWorkspace, cycles, items, cycleId, cycleDestinationItems.map(item => item.id), groupId);
    const cycle = cycles.find(cycle => cycle.id === cycleId)!;
    const group = cycleWorkspace.groups.find(group => group.id === groupId)?.name ?? "Sem grupo";
    commitCycleChange(cycles, result.workspace, result.added.map(item => ({ itemId: item.id, action: "Inclusão em ciclo pelo cadastro", details: `Ciclo: ${cycle.name}. Grupo: ${group}. Quantidade a definir.` })));
    setBulkMessage(`${result.added.length} materiais adicionados a ${cycle.name}; ${result.duplicateCount} já estavam no ciclo e foram preservados; ${result.unavailableCount} indisponíveis ou inativos.`);
    setOpenCycleId(cycleId); setCycleDestinationItems(null); setSection("Ciclos de suprimento");
  }

  return (
    <div className={`app-shell modern-shell${sidebarCollapsed ? " menu-collapsed" : ""}`}>
      <a className="skip-navigation" href="#workspace-content">Ir para o conteúdo</a>
      <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(value => !value)} section={section} pendingOrders={pendingOrders} onNavigate={next => {if (!dlDirty || window.confirm("Descartar alterações não salvas desta DL e mudar de tela?")) setSection(next);}} />

      <main className="main-area" id="workspace-content" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumbs" aria-label="Localização">Suprimentos <span>/</span> {navigationLocation(section).label}</div>
          <div className="user-chip"><div className="avatar">US</div><span>Usuário de teste</span><ChevronDown size={15} /></div>
        </header>

        <div className={`page-content${orderSections.includes(section) ? " orders-page" : ""}`}>
          {orderSections.includes(section) && <OrdersNavigation section={section} onNavigate={setSection} />}
          {(section === "Pedidos FRs" || section === "Pedidos DLs" || section === "Pedidos Material Entrada e Saída") && <section className="panel order-placeholder"><span className="tag tag-neutral">Em breve</span><h2>{section}</h2><p className="muted">Área reservada para este tipo de pedido. O fluxo de criação e movimentação será definido em etapa própria.</p></section>}
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
                        return <tr key={line.id}><td><strong>{item?.description ?? "Item removido"}</strong><small>{item?.code}</small></td><td>{line.plannedQuantity === null ? "A definir" : `${line.plannedQuantity} ${item?.unit ?? ""}`}</td><td>Não conectado</td><td>Não conectado</td></tr>;
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
                <div><p className="eyebrow">DADOS SISTEMA MXM</p><h1>Cadastro de itens</h1><p className="muted">Catálogo geral de materiais MXM. Importe, filtre, ordene e selecione vários itens.</p></div>
                <div className="form-actions">
                  <input ref={importInputRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={(e) => void handleImportFile(e.target.files?.[0])} />
                  <button className="secondary-button" onClick={downloadTemplate}><Download size={17} /> Modelo CSV</button>
                  <button className="secondary-button" onClick={() => importInputRef.current?.click()}><FileUp size={17} /> Importar planilha</button>
                  <button className="primary-button" onClick={() => setShowAddItem((v) => !v)}><Boxes size={17} /> {showAddItem ? "Cancelar" : "Novo item"}</button>
                </div>
              </div>
              {importMessage && <div className="notice"><AlertTriangle size={17} /><span>{importMessage}</span></div>}
              {importPreview && <CatalogImportPreview preview={importPreview} canUpdate={editorMode} backupVersion={importBackupVersion} onAdd={addImportedItems} onUpdate={updateImportedItems} onBackup={downloadImportBackup} onCancel={cancelImport} />}
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
              <section className="panel catalog-panel">
                <div className="toolbar catalog-toolbar"><div><h2>Catálogo de itens</h2><p aria-live="polite">{filteredItems.length} de {items.length} itens exibidos</p></div><div className="catalog-toolbar-actions"><label className="search-box catalog-search"><Search size={16} aria-hidden="true" /><input aria-label="Buscar itens" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código, descrição, grupo ou unidade" /></label><CatalogTypeFilter types={allTypes} selected={selectedTypes} onChange={changeTypeView} /></div></div>
                <div className="catalog-filters">
                  <label>Tipo<select value={filterType} onChange={(e) => { setFilterType(e.target.value); setFilterGroup("Todos"); setFilterCriterion("Todos"); setSelectedItemIds([]); }}><option>Todos</option>{types.map((type) => <option key={type}>{type}</option>)}</select></label>
                  <label>Grupo<select value={filterGroup} onChange={(e) => { setFilterGroup(e.target.value); setFilterCriterion("Todos"); }}><option>Todos</option>{groups.map((group) => <option key={group}>{group}</option>)}</select></label>
                  <label>Critério<select value={filterCriterion} onChange={(e) => setFilterCriterion(e.target.value)}><option>Todos</option>{criteria.map(criterion => <option key={criterion}>{criterion}</option>)}</select></label>
                  <label>Status<select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}><option>Todos</option><option>Ativo</option><option>Inativo</option></select></label>
                </div>
                <div className="form-actions catalog-bulk-actions" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                  <label className="select-all-label"><input type="checkbox" checked={filteredItems.length > 0 && filteredItems.every((item) => selectedItemIds.includes(item.id))} onChange={(e) => setSelectedItemIds(e.target.checked ? [...new Set([...selectedItemIds, ...filteredItems.map((item) => item.id)])] : selectedItemIds.filter((id) => !filteredItems.some((item) => item.id === id)))} /> Selecionar todos os itens filtrados</label>
                  <div className="bulk-actions-right">
                    <CatalogActionMenu label={`Preparar seleção (${selectedItemIds.length})`} icon={<ClipboardList size={16} aria-hidden="true" />} disabled={!selectedItemIds.length} options={[
                      { value: "cycle", label: "Ciclo de suprimento" },
                      { value: "dl", label: "Planejamento DLs" },
                      { value: "order", label: "Preparação de pedido direto" },
                      { value: "share", label: "Compartilhar com requisitante" },
                    ]} onSelect={prepareBulkAction} />
                    <CatalogActionMenu label="Ordenar" icon={<ArrowDownAZ size={16} aria-hidden="true" />} selected={sortMode} options={[
                      { value: "description", label: "Descrição (A–Z)" },
                      { value: "code", label: "Código (A–Z)" },
                      { value: "group", label: "Grupo e descrição" },
                    ]} onSelect={setSortMode} />
                    <button className="secondary-button" disabled={!selectedItemIds.length} onClick={deleteSelectedItems}><Trash2 size={16} /> Excluir selecionados</button>
                  </div>
                </div>
                {bulkMessage && <div className="notice"><CheckCircle2 size={17} /><span>{bulkMessage}</span></div>}
                <div className="role-toolbar"><span>Permissão de edição: <strong>{editorMode ? "Editor (demonstração)" : "Consulta"}</strong></span><button className="secondary-button" onClick={() => { setEditingItem(null); setEditorMode((current) => !current); }}>{editorMode ? "Usar perfil Consulta" : "Ativar perfil Editor"}</button><span className="form-note">Controle ilustrativo; não substitui autenticação real.</span></div>
                <div className="table-wrap catalog-table-wrap" ref={catalogWrapRef} onScroll={(e) => { if (syncingScroll.current || !fixedScrollRef.current) return; syncingScroll.current = true; fixedScrollRef.current.scrollLeft = e.currentTarget.scrollLeft; syncingScroll.current = false; }}><table className="catalog-table"><thead><tr><th>Selecionar</th><th>Código</th><th>Descrição</th><th>Unidade</th><th>Critério</th><th>Grupo</th></tr></thead><tbody>
                  {filteredItems.map((item) => <tr key={item.id}>
                    <td><input aria-label={`Selecionar ${item.code}`} type="checkbox" checked={selectedItemIds.includes(item.id)} onChange={(e) => setSelectedItemIds((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /></td>
                    <td className="code-cell"><button className="item-code-button" disabled={!editorMode} aria-label={`Editar item ${item.code}`} title={editorMode ? "Abrir edição do item" : "Ative o perfil Editor para editar"} onClick={() => {
                      if (!editorMode) return;
                      setEditingItem({ ...item, type: item.type || "SEM TIPO", visible: item.visible !== false });
                    }}>{item.code}</button></td>
                    <td><strong>{item.description}</strong></td>
                    <td>{item.unit}</td>
                    <td><span className="tag tag-neutral">{item.criterion}</span></td>
                    <td>{item.group}</td>
                  </tr>)}
                  {filteredItems.length === 0 && <tr><td colSpan={6} className="empty-state">Nenhum item corresponde aos filtros.</td></tr>}
                </tbody></table></div>
                <div className="catalog-fixed-scroll" ref={fixedScrollRef} onScroll={(e) => { if (syncingScroll.current || !catalogWrapRef.current) return; syncingScroll.current = true; catalogWrapRef.current.scrollLeft = e.currentTarget.scrollLeft; syncingScroll.current = false; }}><div ref={fixedScrollInnerRef} style={{ width: `${catalogWidth}px`, height: 1 }} /></div>
                {cycleDestinationItems && <CycleDestinationDialog count={cycleDestinationItems.length} cycles={cycles} groups={cycleWorkspace.groups} onConfirm={addCatalogSelectionToCycle} onClose={() => setCycleDestinationItems(null)} onOpenCycles={() => { setCycleDestinationItems(null); setOpenCycleId(null); setSection("Ciclos de suprimento"); }} />}
                {shareItems && <ShareItemsDialog items={shareItems} onClose={() => setShareItems(null)} />}
                {editingItem && editorMode && <ItemDetailsDialog
                  key={editingItem.id}
                  item={editingItem}
                  history={history}
                  dlPlans={dlWorkspace.plans}
                  cycleItems={cycleWorkspace.lines}
                  cycles={cycles}
                  onChange={setEditingItem}
                  onSave={saveEditedItem}
                  onClose={() => setEditingItem(null)}
                />}

                <p className="form-note">Importação nesta versão aceita CSV/TXT exportado do Excel. A importação .xlsx nativa ainda precisa de uma biblioteca específica. Exclusões afetam o catálogo local. Itens ligados a ciclos ou planejamentos de DL ficam protegidos.</p>
              </section>
            </>
          )}

          {section === "Ciclos de suprimento" && <>
            {bulkMessage && <p role="status" className="catalog-feedback">{bulkMessage}</p>}
            <CiclosSuprimento items={items} cycles={cycles} workspace={cycleWorkspace} storageError={cycleState.error} initialCycleId={openCycleId} onSaveCycle={saveCycle} onCommit={(next, events) => commitCycleChange(cycles, next, events)} />
          </>}

          {section === "Pedidos diretos" && (
            <>
              <div className="page-heading"><div><p className="eyebrow">EXECUÇÃO</p><h2>Pedidos CDs</h2><p className="muted">Pedidos do tipo PCD registrados no protótipo.</p></div><button className="secondary-button" onClick={() => window.alert("O fluxo de criação de pedidos diretos será implementado após a validação das regras de compromisso e saldo.")}>Preparar pedido <FileText size={17} /></button></div>
              <section className="panel">
                <div className="toolbar"><div><h2>Fila de pedidos diretos</h2><p>{directOrders.length} pedidos demonstrativos</p></div></div>
                <div className="table-wrap"><table><thead><tr><th>Item</th><th>Ciclo</th><th>Solicitado</th><th>Recebido</th><th>Entrega prevista</th><th>Status</th></tr></thead><tbody>
                  {directOrders.map((order) => <tr key={order.id}><td><strong>{order.itemDescription}</strong></td><td>{order.cycleName}</td><td>{order.requestedQuantity}</td><td>{order.receivedQuantity}</td><td>{order.expectedDelivery}</td><td><span className={`tag ${order.status === "Recebimento parcial" ? "tag-amber" : "tag-neutral"}`}>{order.status}</span></td></tr>)}
                  {directOrders.length === 0 && <tr><td colSpan={6} className="empty-state">Nenhum pedido direto cadastrado na demonstração.</td></tr>}
                </tbody></table></div>
              </section>
            </>
          )}

          {(section === "Planejamento DLs" || section === "Controle DLs") && <PlanejamentoControleDLs items={items} workspace={dlWorkspace} error={dlState.error} onSave={saveDLPlan} pendingItems={dlPendingItems} onPendingClose={() => setDLPendingItems(null)} onDirtyChange={setDLDirty} tab={section === "Controle DLs" ? "control" : "planning"} onChange={tab => {if (!dlDirty || window.confirm("Descartar alterações não salvas desta DL?")) setSection(tab === "control" ? "Controle DLs" : "Planejamento DLs");}} />}

          {section === "Acompanhamento de pedidos" && (
            <>
              <div className="page-heading"><div><p className="eyebrow">EXECUÇÃO</p><h1>Acompanhamento de pedidos</h1><p className="muted">Visão consolidada dos pedidos registrados e de seus recebimentos.</p></div><button className="secondary-button" onClick={() => window.alert("O fluxo de criação de pedidos será implementado depois da validação das regras de compromisso e saldo.")}>Preparar pedido <FileText size={17} /></button></div>
              <section className="panel"><div className="toolbar"><div><h2>Fila de acompanhamento</h2><p>Dados demonstrativos; referências ERP são ilustrativas.</p></div></div><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Item</th><th>Ciclo</th><th>Pedido ERP</th><th>Solicitado</th><th>Recebido</th><th>Entrega prevista</th><th>Status</th></tr></thead><tbody>{demoOrders.map((order) => <tr key={order.id}><td><span className="tag tag-neutral">{order.type}</span></td><td><strong>{order.itemDescription}</strong></td><td>{order.cycleName}</td><td>{order.erpOrderNumber ?? "Pendente"}</td><td>{order.requestedQuantity}</td><td>{order.receivedQuantity}</td><td>{order.expectedDelivery}</td><td><span className={`tag ${order.status === "Recebimento parcial" ? "tag-amber" : "tag-neutral"}`}>{order.status}</span></td></tr>)}</tbody></table></div><div className="notice"><AlertTriangle size={17} /><span>Um pedido atrasado não deve liberar automaticamente a quantidade comprometida. É necessária confirmação de cancelamento ou não entrega.</span></div></section>
            </>
          )}

          {section === "Tarefas" && <Tarefas />}
          {section === "ATA / Contratos" && <AcompanhamentoATAContratos />}

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
