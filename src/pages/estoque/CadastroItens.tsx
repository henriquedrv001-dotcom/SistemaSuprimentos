import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Boxes, Search } from "lucide-react";
import type { Item } from "../../types";

const emptyItem = { code: "", description: "", unit: "kg", group: "Gêneros alimentícios", criterion: "Mensal" as Item["criterion"] };

export default function CadastroItens({ items, onAddItem }: { items: Item[]; onAddItem: (item: Item) => void }) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyItem);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("pt-BR");
    return items.filter(item => `${item.code} ${item.description} ${item.group} ${item.criterion}`.toLocaleLowerCase("pt-BR").includes(search));
  }, [items, query]);

  function closeForm() {
    setShowForm(false);
    setDraft(emptyItem);
    setError("");
  }

  function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = draft.code.trim();
    const description = draft.description.trim();
    if (!code || !description || !draft.unit.trim() || !draft.group.trim()) {
      setError("Preencha o código, a descrição, a unidade e o grupo do item.");
      return;
    }
    if (items.some(item => item.code.trim().toLocaleLowerCase("pt-BR") === code.toLocaleLowerCase("pt-BR"))) {
      setError("Este código já está cadastrado. Confira o código ou procure o item na lista.");
      return;
    }
    onAddItem({ ...draft, code, description, unit: draft.unit.trim(), group: draft.group.trim(), id: `local-${crypto.randomUUID()}`, active: true });
    setQuery("");
    closeForm();
    setMessage(`Item ${code} incluído na demonstração. Ele ficará disponível até você recarregar ou fechar esta página.`);
  }

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">ESTOQUE · CADASTROS</p><h1>Cadastro de itens</h1><p className="muted">Organize os itens acompanhados pela filial e usados no planejamento dos suprimentos.</p></div>
      <button className="primary-button" aria-expanded={showForm} aria-controls="item-form" onClick={() => {
        if (showForm) closeForm(); else { setMessage(""); setShowForm(true); }
      }}><Boxes size={17} />{showForm ? "Cancelar" : "Novo item"}</button>
    </div>
    <p className="catalog-context">Este cadastro apoia o acompanhamento do setor. A execução dos processos e o controle oficial de estoque continuam no ERP.</p>
    <p className="demo-notice">Demonstração: os dados ainda não são gravados. Ao recarregar a página, os itens adicionados serão perdidos.</p>
    {message && <p className="catalog-feedback" role="status">{message}</p>}
    {showForm && <section className="panel form-panel" id="item-form" aria-labelledby="item-form-title">
      <h2 id="item-form-title">Novo item (demonstração)</h2>
      <p className="muted">Use o mesmo código do ERP. Ele será a referência para ligar este item aos ciclos e pedidos. Preencha todos os campos.</p>
      <form onSubmit={saveItem}>
        <div className="form-grid">
          <label>Código do ERP<input autoFocus required value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="Informe exatamente o código do ERP" /></label>
          <label>Descrição<input required value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Descrição do produto" /></label>
          <label>Unidade<input required value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })} placeholder="Ex.: kg, un, litro" /></label>
          <label>Grupo<input required value={draft.group} onChange={e => setDraft({ ...draft, group: e.target.value })} /></label>
          <label>Critério de solicitação<select value={draft.criterion} onChange={e => setDraft({ ...draft, criterion: e.target.value as Item["criterion"] })}><option>Mensal</option><option>Entrada e saída</option><option>Sob solicitação</option></select></label>
        </div>
        {error && <p className="catalog-error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={closeForm}>Cancelar</button><button type="submit" className="primary-button">Adicionar à demonstração</button></div>
      </form>
    </section>}
    <section className="panel" aria-labelledby="catalog-title">
      <div className="toolbar"><div><h2 id="catalog-title">Catálogo de itens</h2><p aria-live="polite">{filtered.length} {filtered.length === 1 ? "item encontrado" : "itens encontrados"}</p></div><div className="search-box"><Search size={16} /><input aria-label="Buscar itens" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar código, descrição ou grupo" /></div></div>
      <div className="table-wrap"><table><thead><tr><th scope="col">Código</th><th scope="col">Descrição</th><th scope="col">Unidade</th><th scope="col">Grupo</th><th scope="col">Critério</th><th scope="col">Status</th></tr></thead><tbody>
        {filtered.map(item => <tr key={item.id}><td className="code-cell">{item.code}</td><td><strong>{item.description}</strong></td><td>{item.unit}</td><td>{item.group}</td><td><span className="tag tag-neutral">{item.criterion}</span></td><td><span className={`tag ${item.active ? "tag-green" : "tag-neutral"}`}>{item.active ? "Ativo" : "Inativo"}</span></td></tr>)}
        {filtered.length === 0 && <tr><td colSpan={6} className="empty-state">Nenhum item corresponde à busca. Tente outro código, descrição ou grupo.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
