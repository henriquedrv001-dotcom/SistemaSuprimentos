import { CalendarDays } from "lucide-react";
import { demoCycles, demoCycleItems } from "../../data";
import { DateInfo } from "../../components/Resumo";

export default function CiclosSuprimento() {
  return (
            <>
              <div className="page-heading"><div><p className="eyebrow">PLANEJAMENTO</p><h1>Ciclos de suprimento</h1><p className="muted">Períodos de planejamento conectados ao cadastro mestre de itens.</p></div><button className="secondary-button" onClick={() => window.alert("A criação e edição de ciclos será implementada após a validação do modelo de dados.")}>Novo ciclo <CalendarDays size={17} /></button></div>
              <div className="cycle-list">{demoCycles.map((cycle) => {
                const lines = demoCycleItems.filter((line) => line.cycleId === cycle.id);
                return <section className="panel cycle-card" key={cycle.id}><div className="panel-heading"><div><p className="eyebrow">{cycle.id}</p><h2>{cycle.name}</h2></div><span className={`tag ${cycle.status === "Em execução" ? "tag-green" : "tag-neutral"}`}>{cycle.status}</span></div><div className="date-grid"><DateInfo label="Solicitações" value={cycle.solicitationStart} /><DateInfo label="1ª entrega" value={cycle.firstDelivery} /><DateInfo label="Última entrega" value={cycle.lastDelivery} /><DateInfo label="Fechamento" value={cycle.closingDate} /></div><div className="panel-footer"><span>{lines.length} itens vinculados no protótipo</span><span className="muted">Edição será conectada ao banco</span></div></section>;
              })}</div>
            </>
  );
}
