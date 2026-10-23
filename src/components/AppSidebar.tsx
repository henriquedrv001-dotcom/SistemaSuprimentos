import {
  CalendarClock,
  PackageSearch,
  RefreshCw,
  ClipboardList,
  LayoutDashboard,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Truck,
  ShoppingCart,
} from "lucide-react";

export type AppSection =
  | "Validades"
  | "Tarefas"
  | "Painel"
  | "Cadastro de itens"
  | "Ciclos de suprimento"
  | "Pedidos diretos"
  | "Planejamento DLs"
  | "Controle DLs"
  | "Acompanhamento de pedidos"
  | "ATA / Contratos"
  | "Pedidos FRs"
  | "Pedidos DLs"
  | "Pedidos Material Entrada e Saída";
export const orderSections: AppSection[] = [
  "Pedidos diretos",
  "Pedidos FRs",
  "Pedidos DLs",
  "ATA / Contratos",
  "Pedidos Material Entrada e Saída",
];
const items: {
  label: string;
  section?: AppSection;
  matches?: AppSection[];
  icon: typeof PackageSearch;
}[] = [
  { label: "Visão geral", section: "Painel", icon: LayoutDashboard },
  { label: "Tarefas", section: "Tarefas", icon: ListTodo },
  { label: "Catálogo", section: "Cadastro de itens", icon: PackageSearch },
  { label: "Validades", section: "Validades", icon: CalendarClock },
  {
    label: "Ciclos",
    section: "Ciclos de suprimento",
    icon: RefreshCw,
  },
  {
    label: "Aquisições",
    section: "Planejamento DLs",
    matches: ["Planejamento DLs", "Controle DLs"],
    icon: ShoppingCart,
  },
  {
    label: "Pedidos",
    section: "Pedidos diretos",
    matches: orderSections,
    icon: ClipboardList,
  },
  {
    label: "Acompanhamento",
    section: "Acompanhamento de pedidos",
    icon: Truck,
  },
  { label: "Configurações", icon: Settings },
];
export function navigationLocation(section: AppSection) {
  const item = items.find(
    (item) => item.section === section || item.matches?.includes(section),
  );
  return { group: "Suprimentos", label: item?.label ?? section };
}
export default function AppSidebar({
  section,
  pendingOrders,
  onNavigate,
  collapsed,
  onToggle,
}: {
  section: AppSection;
  pendingOrders: number;
  onNavigate: (section: AppSection) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={`sidebar${collapsed ? " is-collapsed" : ""}`}
      aria-label="Menu principal"
    >
      <div className="sidebar-brand-row">
        <div className="brand">
          <div className="brand-mark brand-logo">sesc</div>
          <div className="brand-copy">
            <strong>Suprimentos</strong>
            <span>Planejamento e controle</span>
          </div>
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          aria-controls="main-navigation"
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>
      </div>
      <nav id="main-navigation" aria-label="Navegação principal">
        {items.map(({ label, section: target, matches, icon: Icon }) => {
          const active = target === section || matches?.includes(section);
          return (
            <button
              type="button"
              key={label}
              className={`nav-item ${active ? "active" : ""}`}
              disabled={!target}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              title={target ? label : "Configurações — em breve"}
              onClick={() => {
                if (target) onNavigate(target);
              }}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {!target && <small>Em breve</small>}
              {target === "Acompanhamento de pedidos" && (
                <small>{pendingOrders}</small>
              )}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="mode-pill">
          <span className="status-dot" />
          <span className="mode-copy">Protótipo local</span>
        </div>
        <p>Dados salvos neste navegador.</p>
      </div>
    </aside>
  );
}
