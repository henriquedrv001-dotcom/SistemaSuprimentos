import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download } from "lucide-react";
import type { Item } from "../types";
import { buildShareImagePages, buildShareText, createShareImage } from "../services/catalogShare";

export default function ShareItemsDialog({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const text = useMemo(() => buildShareText(items), [items]);
  const pages = useMemo(() => {
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return [];
    context.font = "16px sans-serif";
    return buildShareImagePages(items, text => context.measureText(text).width);
  }, [items]);
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function copyText() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text); setStatus("Lista copiada! Agora você pode colar na mensagem para o requisitante.");
    } catch {
      textArea.current?.focus(); textArea.current?.select();
      setStatus("O navegador bloqueou a cópia automática. O texto está selecionado: use Ctrl+C ou a opção Copiar do seu dispositivo.");
    }
  }

  async function downloadImage() {
    if (!pages[page]) return;
    setBusy(true); setStatus("");
    try {
      const blob = await createShareImage(pages[page], page, pages.length, items.length);
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url;
      link.download = `materiais-mxm-pagina-${page + 1}.png`; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`PNG da página ${page + 1} gerado para download.`);
    } catch (cause) { setStatus(cause instanceof Error ? cause.message : "Não foi possível gerar a imagem."); }
    finally { setBusy(false); }
  }

  return <dialog ref={dialog} className="item-edit-dialog share-items-dialog" aria-labelledby="share-items-title" onClose={onClose}>
    <div className="panel-heading"><div><h2 id="share-items-title">Compartilhar com requisitante</h2><p>{items.length} {items.length === 1 ? "item selecionado" : "itens selecionados"}. Código, descrição, unidade, critério e grupo.</p></div><button type="button" className="secondary-button" onClick={onClose}>Fechar</button></div>
    <label className="share-text-label">Lista pronta para copiar<textarea ref={textArea} readOnly value={text} rows={12} /></label>
    {pages.length > 1 && <div className="share-pagination"><p>Para manter a imagem legível, a lista foi dividida em {pages.length} páginas.</p><div><button type="button" className="secondary-button" disabled={page === 0 || busy} onClick={() => setPage(page - 1)}>Anterior</button><span aria-live="polite">Página {page + 1} de {pages.length}</span><button type="button" className="secondary-button" disabled={page === pages.length - 1 || busy} onClick={() => setPage(page + 1)}>Próxima</button></div></div>}
    {!pages.length && <p className="form-note">A geração de imagem está indisponível neste navegador. Você pode copiar o texto.</p>}
    <p className="share-status" role="status">{status}</p>
    <div className="form-actions"><button type="button" className="secondary-button" disabled={!pages.length || busy} onClick={() => void downloadImage()}><Download size={16} />{busy ? "Gerando PNG…" : pages.length > 1 ? `Baixar PNG · página ${page + 1}` : "Baixar PNG"}</button><button type="button" className="primary-button" onClick={() => void copyText()}><Copy size={16} />Copiar texto</button></div>
  </dialog>;
}
