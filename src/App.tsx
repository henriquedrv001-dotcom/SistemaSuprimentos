import { useState } from "react";
import { Boxes, CalendarDays, ChevronDown, LayoutDashboard, Truck, WalletCards } from "lucide-react";
import { demoItems, demoOrders } from "./data";
import type { Item } from "./types";
import Painel from "./pages/estoque/Painel";
import CadastroItens from "./pages/estoque/CadastroItens";
import CiclosSuprimento from "./pages/estoque/CiclosSuprimento";
import Pedidos from "./pages/estoque/Pedidos";
import SaldosDL from "./pages/estoque/SaldosDL";

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
  const [items, setItems] = useState<Item[]>(demoItems);
  const pendingOrders = demoOrders.filter(order => order.status !== "Concluído").length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Boxes size={22} /></div>
          <div><strong>Suprimentos</strong><span>Planejamento e controle</span></div>
        </div>
        <div className="nav-label">ESTOQUE</div>
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
          <div className="breadcrumbs">Suprimentos <span>/</span> Estoque <span>/</span> {section}</div>
          <div className="user-chip"><div className="avatar">US</div><span>Usuário de teste</span><ChevronDown size={15} /></div>
        </header>

        <div className="page-content">
          {section === "Painel" && <Painel items={items} onOpenCycles={() => setSection("Ciclos de suprimento")} />}

          {section === "Cadastro de itens" && <CadastroItens items={items} onAddItem={item => setItems(previous => [...previous, item])} />}

          {section === "Ciclos de suprimento" && <CiclosSuprimento />}

          {section === "Pedidos em aberto" && <Pedidos />}

          {section === "Saldos das DLs" && <SaldosDL />}
        </div>
      </main>
    </div>
  );
}

export default App;
