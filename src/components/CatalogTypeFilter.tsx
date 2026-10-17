import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

const preferenceKey = "suprimentos:cadastro:mostrar-tipos:v1";
export function readCatalogTypeView(): string[] | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(preferenceKey) ?? "null");
    return Array.isArray(value) && value.every(type => typeof type === "string") ? [...new Set(value)] : null;
  } catch { return null; }
}

type Props = { types: { name: string; count: number }[]; selected: string[] | null; onChange: (types: string[] | null) => void };

export default function CatalogTypeFilter({ types, selected, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const count = selected === null ? types.length : types.filter(type => selected.includes(type.name)).length;
  const options = types.filter(type => type.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")));

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const outside = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("mousedown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  function saveDefault() {
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(selected));
      setMessage("Visualização salva como padrão neste navegador.");
    } catch { setMessage("Não foi possível salvar. Verifique se o navegador permite armazenamento local."); }
  }
  function removeDefault() {
    try {
      localStorage.removeItem(preferenceKey); onChange(null);
      setMessage("Padrão removido. Todos os tipos estão permitidos.");
    } catch { setMessage("Não foi possível remover o padrão neste navegador."); }
  }

  return <div className="type-filter" ref={rootRef}>
    <button ref={triggerRef} type="button" className="type-filter-trigger" aria-expanded={open} aria-controls="catalog-type-view" onClick={() => { setOpen(!open); setQuery(""); setMessage(""); }}><span>Mostrar: {selected === null ? "todos os tipos" : count === 0 ? "nenhum tipo" : `${count} ${count === 1 ? "tipo" : "tipos"}`}</span><ChevronDown size={16} /></button>
    {open && <section id="catalog-type-view" className="type-filter-menu" aria-label="Tipos permitidos no cadastro">
      <div className="type-filter-heading"><strong>Mostrar tipos de itens</strong><span>{count} de {types.length}</span></div>
      <p className="type-filter-help">Escolha os tipos que aparecem no cadastro e nos filtros abaixo. Os demais continuam na base.</p>
      <label className="type-search-box"><Search size={16} aria-hidden="true" /><input ref={searchRef} aria-label="Pesquisar tipos" value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar tipos" /></label>
      <div className="type-filter-selection-actions"><button type="button" className="text-button" onClick={() => onChange(null)}>Selecionar todos</button><button type="button" className="text-button" onClick={() => onChange([])}>Desmarcar todos</button></div>
      <div className="type-filter-options">{options.map(type => <label className="type-filter-option" key={type.name}><input type="checkbox" aria-label={type.name} checked={selected === null || selected.includes(type.name)} onChange={e => {
        const current = selected ?? types.map(type => type.name);
        onChange(e.target.checked ? [...new Set([...current, type.name])] : current.filter(name => name !== type.name));
        setMessage("");
      }} /><span>{type.name}</span><small>{type.count}</small></label>)}{options.length === 0 && <p className="muted">Nenhum tipo encontrado.</p>}</div>
      <div className="type-filter-preferences"><button type="button" className="secondary-button" onClick={saveDefault}>Salvar como padrão</button><button type="button" className="text-button" onClick={() => { onChange(readCatalogTypeView()); setMessage("Visualização padrão restaurada."); }}>Restaurar padrão</button><button type="button" className="text-button" onClick={removeDefault}>Remover padrão</button></div>
      <p className="type-filter-help">O padrão fica salvo neste navegador, sem alterar o cadastro dos itens.</p>
      <p className="type-filter-message" role="status">{message}</p>
      <button type="button" className="primary-button type-filter-done" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>Concluir</button>
    </section>}
  </div>;
}
