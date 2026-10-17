import { AlertTriangle, CalendarDays, ClipboardList, PackageSearch, Truck, CheckCircle2, WalletCards, FileText } from "lucide-react";
import { demoCycles, demoCycleItems, demoOrders } from "../../data";
import type { Item } from "../../types";
import { Metric, DateInfo } from "../../components/Resumo";

export default function Painel({ items, onOpenCycles }: { items: Item[]; onOpenCycles: () => void }) {
  const activeCycle = demoCycles[0];
  const cycleRows = demoCycleItems.filter(line => line.cycleId === activeCycle.id);
  const pendingOrders = demoOrders.filter(order => order.status !== "Concluído").length;
  return (
            <>
              <div className="page-heading">
                <div><p className="eyebrow">VISÃO GERAL</p><h1>Painel de suprimentos</h1><p className="muted">Acompanhe o planejamento, os pedidos e as pendências em um só lugar.</p></div>
                <button className="primary-button" onClick={onOpenCycles}><CalendarDays size={17} /> Consultar ciclos</button>
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
                  <div className="panel-footer"><span>{cycleRows.length} itens distintos no ciclo</span><button className="text-button" onClick={onOpenCycles}>Ver ciclo <span>→</span></button></div>
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
  );
}
