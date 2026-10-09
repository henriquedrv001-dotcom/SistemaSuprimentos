import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDownToLine, Boxes, CalendarDays, CheckCircle2,
  ChevronDown, ClipboardList, FileText, LayoutDashboard, PackageSearch,
  Search, Truck, WalletCards
} from "lucide-react";
import { demoCycleItems, demoCycles, demoItems, demoOrders } from "./data";
import type { Item } from "./types";

type Section = "Painel" | "Cadastro de itens" | "Ciclos de suprimento" | "Pedidos em aberto" | "Saldos das DLs";

const nav: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: "Painel", icon: LayoutDashboard },
  { label: "Cadastro de itens", icon: Boxes },
  { label: "Ciclos de suprimento", icon: CalendarDays },
  { label: "Pedidos em aberto", icon: Truck },
  { label: "Saldos das DLs", icon: WalletCards },
];

function App() {
  const [section, setSection] = useState<Section>("Painel");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>(demoItems);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ code: "", description: "", unit: "kg", group: "Gêneros alimentícios", criterion: "Mensal" as Item["criterion"] });

  const filteredItems = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    if (!q) return items;
    return items.filter((item) =>
      `${item.code} ${item.description} ${item.group} ${item.criterion}`.toLocaleLowerCase("pt-BR").includes(q)
    );
  }, [items, query]);

  const activeCycle = demoCycles[0];
  const cycleRows = demoCycleItems.filter((line) => line.cycleId === activeCycle.id);
  const pendingOrders = demoOrders.filter((order) => order.status !== "Concluído").length;

  function addItem() {
    if (!newItem.code.trim() || !newItem.description.trim()) return;
    if (items.some((item) => item.code.toLowerCase() === newItem.code.trim().toLowerCase())) {
      window.alert("Já existe um item com esse código.");
      return;
    }
    setItems((prev) => [...prev, {
      id: `local-${crypto.randomUUID()}`,
      code: newItem.code.trim(),
      description: newItem.description.trim(),
      unit: newItem.unit.trim() || "un",
      group: newItem.group.trim() || "Sem grupo",
      criterion: newItem.criterion,
      active: true,
    }]);
    setNewItem({ code: "", description: "", unit: "kg", group: "Gêneros alimentícios", criterion: "Mensal" });
    setShowAddItem(false);
    window.alert("Item incluído nesta sessão de demonstração. Ainda não foi gravado em banco de dados.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Boxes size={22} /></div>
          <div><strong>Suprimentos</strong><span>Planejamento e controle</span></div>
        </div>
        <div className="nav-label">GESTÃO</div>
        <nav>
          {nav.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${section === label ? "active" : ""}`} onClick={() => setSection(label)}>
              <Icon size={18} /><span>{label}</span>{label === "Pedidos em aberto" && <small>{pendingOrders}</small>}
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
          {section === "Painel" && (
            <>
              <div className="page-heading">
                <div><p className="eyebrow">VISÃO GERAL</p><h1>Painel de suprimentos</h1><p className="muted">Acompanhe o planejamento, os pedidos e as pendências em um só lugar.</p></div>
                <button className="primary-button" onClick={() => setSection("Ciclos de suprimento")}><CalendarDays size={17} /> Consultar ciclos</button>
              </div>
              <div className="metric-grid">
                <Metric icon={<ClipboardList size={19} />} label="Ciclos cadastrados" value={String(demoCycles.length)} detail="Períodos de planejamento" />
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
                <div><p className="eyebrow">DADOS MESTRES</p><h1>Cadastro de itens</h1><p className="muted">Cada produto é cadastrado uma vez e relacionado aos ciclos, PDLs e pedidos.</p></div>
                <button className="primary-button" onClick={() => setShowAddItem((v) => !v)}><Boxes size={17} /> {showAddItem ? "Cancelar" : "Novo item"}</button>
              </div>
              {showAddItem && <section className="panel form-panel">
                <h2>Novo item (demonstração)</h2>
                <div className="form-grid">
                  <label>Código único<input value={newItem.code} onChange={(e) => setNewItem({ ...newItem, code: e.target.value })} placeholder="Ex.: IT005" /></label>
                  <label>Descrição<input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="Descrição do produto" /></label>
                  <label>Unidade<input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} /></label>
                  <label>Grupo<input value={newItem.group} onChange={(e) => setNewItem({ ...newItem, group: e.target.value })} /></label>
                  <label>Critério de solicitação<select value={newItem.criterion} onChange={(e) => setNewItem({ ...newItem, criterion: e.target.value as Item["criterion"] })}><option>Mensal</option><option>Entrada e saída</option><option>Sob solicitação</option></select></label>
                </div>
                <div className="form-actions"><button className="secondary-button" onClick={() => setShowAddItem(false)}>Cancelar</button><button className="primary-button" onClick={addItem}>Adicionar à demonstração</button></div>
                <p className="form-note">Nesta etapa, os dados são mantidos apenas na memória da página. O banco de dados será conectado em uma fase seguinte.</p>
              </section>}
              <section className="panel">
                <div className="toolbar"><div><h2>Catálogo de itens</h2><p>{filteredItems.length} itens encontrados</p></div><div className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código, descrição ou grupo" /></div></div>
                <div className="table-wrap"><table><thead><tr><th>Código</th><th>Descrição</th><th>Unidade</th><th>Grupo</th><th>Critério</th><th>Status</th></tr></thead><tbody>
                  {filteredItems.map((item) => <tr key={item.id}><td className="code-cell">{item.code}</td><td><strong>{item.description}</strong></td><td>{item.unit}</td><td>{item.group}</td><td><span className="tag tag-neutral">{item.criterion}</span></td><td><span className="tag tag-green">Ativo</span></td></tr>)}
                  {filteredItems.length === 0 && <tr><td colSpan={6} className="empty-state">Nenhum item corresponde à busca.</td></tr>}
                </tbody></table></div>
              </section>
            </>
          )}

          {section === "Ciclos de suprimento" && (
            <>
              <div className="page-heading"><div><p className="eyebrow">PLANEJAMENTO</p><h1>Ciclos de suprimento</h1><p className="muted">Períodos de planejamento conectados ao cadastro mestre de itens.</p></div><button className="secondary-button" onClick={() => window.alert("A criação e edição de ciclos será implementada após a validação do modelo de dados.")}>Novo ciclo <CalendarDays size={17} /></button></div>
              <div className="cycle-list">{demoCycles.map((cycle) => {
                const lines = demoCycleItems.filter((line) => line.cycleId === cycle.id);
                return <section className="panel cycle-card" key={cycle.id}><div className="panel-heading"><div><p className="eyebrow">{cycle.id}</p><h2>{cycle.name}</h2></div><span className={`tag ${cycle.status === "Em execução" ? "tag-green" : "tag-neutral"}`}>{cycle.status}</span></div><div className="date-grid"><DateInfo label="Solicitações" value={cycle.solicitationStart} /><DateInfo label="1ª entrega" value={cycle.firstDelivery} /><DateInfo label="Última entrega" value={cycle.lastDelivery} /><DateInfo label="Fechamento" value={cycle.closingDate} /></div><div className="panel-footer"><span>{lines.length} itens vinculados no protótipo</span><span className="muted">Edição será conectada ao banco</span></div></section>;
              })}</div>
            </>
          )}

          {section === "Pedidos em aberto" && (
            <>
              <div className="page-heading"><div><p className="eyebrow">EXECUÇÃO</p><h1>Pedidos em aberto</h1><p className="muted">Visão consolidada dos pedidos registrados no acompanhamento.</p></div><button className="secondary-button" onClick={() => window.alert("O fluxo de criação de pedidos será implementado depois da validação das regras de compromisso e saldo.")}>Preparar pedido <FileText size={17} /></button></div>
              <section className="panel"><div className="toolbar"><div><h2>Fila de acompanhamento</h2><p>Dados demonstrativos; referências ERP são ilustrativas.</p></div></div><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Item</th><th>Ciclo</th><th>Pedido ERP</th><th>Solicitado</th><th>Recebido</th><th>Entrega prevista</th><th>Status</th></tr></thead><tbody>{demoOrders.map((order) => <tr key={order.id}><td><span className="tag tag-neutral">{order.type}</span></td><td><strong>{order.itemDescription}</strong></td><td>{order.cycleName}</td><td>{order.erpOrderNumber ?? "Pendente"}</td><td>{order.requestedQuantity}</td><td>{order.receivedQuantity}</td><td>{order.expectedDelivery}</td><td><span className={`tag ${order.status === "Recebimento parcial" ? "tag-amber" : "tag-neutral"}`}>{order.status}</span></td></tr>)}</tbody></table></div><div className="notice"><AlertTriangle size={17} /><span>Um pedido atrasado não deve liberar automaticamente a quantidade comprometida. É necessária confirmação de cancelamento ou não entrega.</span></div></section>
            </>
          )}

          {section === "Saldos das DLs" && (
            <>
              <div className="page-heading"><div><p className="eyebrow">LICITAÇÕES</p><h1>Saldos das DLs</h1><p className="muted">Cada saldo será associado a um item licitado e ao pedido ERP de origem.</p></div><button className="secondary-button" onClick={() => window.alert("A tela de saldos será ativada após implementar PDLs, itens licitados e compromissos no banco.")}>Ver regras <WalletCards size={17} /></button></div>
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
