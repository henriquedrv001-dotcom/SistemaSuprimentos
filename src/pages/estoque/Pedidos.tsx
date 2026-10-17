import { AlertTriangle, FileText } from "lucide-react";
import { demoOrders } from "../../data";

export default function Pedidos() {
  return (
            <>
              <div className="page-heading"><div><p className="eyebrow">EXECUÇÃO</p><h1>Pedidos em aberto</h1><p className="muted">Visão consolidada dos pedidos registrados no acompanhamento.</p></div><button className="secondary-button" onClick={() => window.alert("O fluxo de criação de pedidos será implementado depois da validação das regras de compromisso e saldo.")}>Preparar pedido <FileText size={17} /></button></div>
              <section className="panel"><div className="toolbar"><div><h2>Fila de acompanhamento</h2><p>Dados demonstrativos; referências ERP são ilustrativas.</p></div></div><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Item</th><th>Ciclo</th><th>Pedido ERP</th><th>Solicitado</th><th>Recebido</th><th>Entrega prevista</th><th>Status</th></tr></thead><tbody>{demoOrders.map((order) => <tr key={order.id}><td><span className="tag tag-neutral">{order.type}</span></td><td><strong>{order.itemDescription}</strong></td><td>{order.cycleName}</td><td>{order.erpOrderNumber ?? "Pendente"}</td><td>{order.requestedQuantity}</td><td>{order.receivedQuantity}</td><td>{order.expectedDelivery}</td><td><span className={`tag ${order.status === "Recebimento parcial" ? "tag-amber" : "tag-neutral"}`}>{order.status}</span></td></tr>)}</tbody></table></div><div className="notice"><AlertTriangle size={17} /><span>Um pedido atrasado não deve liberar automaticamente a quantidade comprometida. É necessária confirmação de cancelamento ou não entrega.</span></div></section>
            </>
  );
}
