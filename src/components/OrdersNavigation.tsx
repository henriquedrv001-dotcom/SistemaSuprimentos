import type { AppSection } from "./AppSidebar";
const groups: {
  label: string;
  items: { label: string; section: AppSection }[];
}[] = [
  {
    label: "Estoque",
    items: [
      { label: "Pedidos CDs", section: "Pedidos diretos" },
      { label: "Pedidos FRs", section: "Pedidos FRs" },
      { label: "Pedidos DLs", section: "Pedidos DLs" },
    ],
  },
  {
    label: "Compras",
    items: [
      { label: "Pedidos ATA/Contrato", section: "ATA / Contratos" },
      {
        label: "Pedidos Material Entrada e Saída",
        section: "Pedidos Material Entrada e Saída",
      },
    ],
  },
];
export default function OrdersNavigation({
  section,
  onNavigate,
}: {
  section: AppSection;
  onNavigate: (section: AppSection) => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Pedidos</h1>
          <p className="muted">
            Consulte cada tipo de pedido na sua área de execução.
          </p>
        </div>
      </div>
      <div className="orders-navigation">
        {groups.map((group) => (
          <section className="orders-group" key={group.label}>
            <h2>{group.label}</h2>
            <nav aria-label={`Pedidos de ${group.label}`}>
              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.section}
                  className={`order-type ${section === item.section ? "active" : ""}`}
                  aria-current={section === item.section ? "page" : undefined}
                  onClick={() => onNavigate(item.section)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </section>
        ))}
      </div>
    </>
  );
}
