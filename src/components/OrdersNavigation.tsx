import type { AppSection } from "./AppSidebar";
import FilterSelect from "./ui/FilterSelect";
import { orderKindNames } from "../services/orders";
import "./OrdersNavigation.css";

const types: {
  kind: keyof typeof orderKindNames;
  value: AppSection;
  group: string;
}[] = [
  { kind: "PCD", value: "Pedidos diretos", group: "Estoque" },
  { kind: "PFR", value: "Pedidos FRs", group: "Estoque" },
  { kind: "PDL", value: "Pedidos DLs", group: "Estoque" },
  { kind: "ATA", value: "ATA / Contratos", group: "Compras" },
  { kind: "MOV", value: "Pedidos Material Entrada e Saída", group: "Compras" },
];
export default function OrdersNavigation({
  section,
  onNavigate,
}: {
  section: AppSection;
  onNavigate: (section: AppSection) => void;
}) {
  return (
    <div className="page-heading orders-page-heading">
      <div>
        <h1>Pedidos</h1>
        <p className="muted">
          Consulte cada tipo de pedido na sua área de execução.
        </p>
      </div>
      <div className="order-type-picker">
        <FilterSelect
          label="Selecione o tipo de pedido"
          value={section}
          options={types.map((type) => ({
            value: type.value,
            label: orderKindNames[type.kind],
            group: type.group,
          }))}
          onChange={(value) => {
            const type = types.find((type) => type.value === value);
            if (type && type.value !== section) onNavigate(type.value);
          }}
        />
      </div>
    </div>
  );
}
