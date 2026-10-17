import { WalletCards } from "lucide-react";

export default function SaldosDL() {
  return (
            <>
              <div className="page-heading"><div><p className="eyebrow">LICITAÇÕES</p><h1>Saldos das DLs</h1><p className="muted">Cada saldo será associado a um item licitado e ao pedido ERP de origem.</p></div><button className="secondary-button" onClick={() => window.alert("A tela de saldos será ativada após implementar PDLs, itens licitados e compromissos no banco.")}>Ver regras <WalletCards size={17} /></button></div>
              <section className="panel"><div className="empty-panel"><div className="empty-icon"><WalletCards size={27} /></div><h2>Estrutura preparada para o próximo módulo</h2><p>O saldo não será digitado isoladamente. Será calculado a partir da quantidade licitada, dos compromissos válidos, dos recebimentos e dos cancelamentos registrados.</p><div className="rule-callout"><strong>Regra obrigatória para PDF</strong><span>Selecionar o pedido ERP que identifica o PDL de origem; validar saldo disponível e planejamento antes da emissão.</span></div></div></section>
            </>
  );
}
