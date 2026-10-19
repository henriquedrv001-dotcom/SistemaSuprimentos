import { Boxes, CalendarDays, ClipboardList, FileCheck2, LayoutDashboard, ListTodo, Settings, Truck, WalletCards } from "lucide-react";

export type AppSection = "Tarefas" | "Painel" | "Cadastro de itens" | "Ciclos de suprimento" | "Pedidos diretos" | "Planejamento DLs" | "Controle DLs" | "Acompanhamento de pedidos" | "ATA / Contratos";
type NavigationItem = { label: string; section?: AppSection; matches?: AppSection[]; icon: typeof LayoutDashboard };
const groups: { label: string; items: NavigationItem[] }[] = [
  { label: "Administração", items: [
    { label: "Cadastro de itens", section: "Cadastro de itens", icon: Boxes },
    { label: "Tarefas", section: "Tarefas", icon: ListTodo },
    { label: "Configurações", icon: Settings },
  ] },
  { label: "Estoque", items: [
    { label: "Painel", section: "Painel", icon: LayoutDashboard },
    { label: "Ciclos de suprimentos", section: "Ciclos de suprimento", icon: CalendarDays },
    { label: "Planejamento e Controle DLs", section: "Planejamento DLs", matches: ["Planejamento DLs", "Controle DLs"], icon: WalletCards },
    { label: "Pedidos diretos", section: "Pedidos diretos", icon: Truck },
    { label: "Acompanhamento de pedidos", section: "Acompanhamento de pedidos", icon: ClipboardList },
  ] },
  { label: "Compras", items: [
    { label: "Acompanhamento pedidos de ATA / Contratos", section: "ATA / Contratos", icon: FileCheck2 },
  ] },
];
export function navigationLocation(section: AppSection) {
  for (const group of groups) {
    const item = group.items.find(item => item.section === section || item.matches?.includes(section));
    if (item) return { group: group.label, label: item.label };
  }
  return { group: "Estoque", label: section };
}

export default function AppSidebar({ section, pendingOrders, onNavigate }: { section: AppSection; pendingOrders: number; onNavigate: (section: AppSection) => void }) {
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark brand-logo">sesc</div><div><strong>Suprimentos</strong><span>Planejamento e controle</span></div></div>
    <div className="sidebar-navigation">{groups.map((group, index) => <section className="sidebar-nav-section" key={group.label} aria-labelledby={`nav-group-${index}`}>
      <h2 id={`nav-group-${index}`} className="nav-label">{group.label}</h2>
      <nav aria-label={group.label}>{group.items.map(({ label, section: target, matches, icon: Icon }) => {
        const active = target === section || matches?.includes(section);
        return <button type="button" key={label} className={`nav-item ${active ? "active" : ""}`} disabled={!target} aria-current={active ? "page" : undefined} title={target ? label : "Em breve — função ainda não disponível"} onClick={() => { if (target) onNavigate(target); }}><Icon size={18} aria-hidden="true" /><span>{label}</span>{!target && <small className="nav-upcoming">Em breve</small>}{target === "Acompanhamento de pedidos" && <small>{pendingOrders}</small>}</button>;
      })}</nav>
    </section>)}</div>
    <div className="sidebar-bottom"><div className="mode-pill"><span className="status-dot" />Protótipo local</div><p>Dados fictícios para validação do fluxo. Não usar para operações reais.</p></div>
  </aside>;
}
