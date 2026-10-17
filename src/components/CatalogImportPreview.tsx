import { useEffect, useRef, useState } from "react";
import type { ImportPreview, ImportSelection } from "../services/catalogImport";

type Props = {
  preview: ImportPreview;
  canUpdate: boolean;
  backupVersion: string;
  onAdd: () => void;
  onUpdate: (selection: ImportSelection, confirmation: string, backupVersion: string) => void;
  onBackup: () => void;
  onCancel: () => void;
};

export default function CatalogImportPreview({ preview, canUpdate, backupVersion, onAdd, onUpdate, onBackup, onCancel }: Props) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selection, setSelection] = useState<ImportSelection>({});
  const [confirmation, setConfirmation] = useState("");
  const [downloadedVersion, setDownloadedVersion] = useState<string | null>(null);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (reviewOpen) dialogRef.current?.showModal(); }, [reviewOpen]);
  const selectedCount = preview.updates.filter(entry => entry.changes.some(change => selection[entry.before.id]?.includes(change.field))).length;
  const selectedFields = preview.updates.reduce((count, entry) => count + entry.changes.filter(change => selection[entry.before.id]?.includes(change.field)).length, 0);
  const backupReady = downloadedVersion === backupVersion;

  return <section className="panel form-panel import-preview" aria-labelledby="import-preview-title">
    <h2 id="import-preview-title">Conferir importação antes de aplicar</h2>
    <p className="muted">Arquivo: {preview.filename}</p>
    <div className="import-summary"><span><strong>{preview.newItems.length}</strong> novos</span><span><strong>{preview.updates.length}</strong> existentes com diferenças</span><span><strong>{preview.unchangedCount}</strong> sem alteração</span></div>
    <p className="import-protection-note">Adicionar novos não altera os itens existentes. Especificações técnicas, status, histórico e vínculos com ciclos, pedidos e DLs ficam protegidos.</p>
    {preview.newItems.length > 0 && <details><summary>Ver os {preview.newItems.length} novos itens</summary><div className="import-new-list">{preview.newItems.map(item => <p key={item.id}><strong>{item.code}</strong> · {item.description}</p>)}</div></details>}
    <div className="form-actions import-preview-actions">
      <button type="button" className="secondary-button" onClick={onCancel}>Cancelar importação</button>
      <button type="button" className="secondary-button" disabled={!preview.updates.length || !canUpdate} title={canUpdate ? "Revisar antes de atualizar" : "Ative o perfil Editor para atualizar existentes"} onClick={() => { setSelection({}); setConfirmation(""); setDownloadedVersion(null); setError(""); setReviewOpen(true); }}>Revisar atualizações ({preview.updates.length})</button>
      <button type="button" className="primary-button" disabled={!preview.newItems.length} onClick={onAdd}>Adicionar somente novos ({preview.newItems.length})</button>
    </div>
    {!canUpdate && preview.updates.length > 0 && <p className="form-note">Para atualizar itens existentes, ative o perfil Editor. Esse perfil ainda é demonstrativo.</p>}
    {reviewOpen && canUpdate && <dialog className="item-edit-dialog import-review-dialog" ref={dialogRef} aria-labelledby="import-review-title" onClose={() => setReviewOpen(false)}>
      <div className="panel-heading"><div><h2 id="import-review-title">Revisar atualizações de itens existentes</h2><p>Nenhum item ou campo vem selecionado. Marque somente o que deseja alterar.</p></div><button type="button" className="secondary-button" onClick={() => setReviewOpen(false)}>Fechar</button></div>
      <p className="import-protection-note">Somente Descrição, Unidade, Tipo, Grupo e Critério podem ser atualizados. Campos vazios ou ausentes na planilha preservam o valor atual. Os códigos MXM e suas personalizações protegidas não serão substituídos.</p>
      <div className="import-update-list">{preview.updates.map(entry => {
        const selected = selection[entry.before.id] ?? [];
        return <section className="import-update-item" key={entry.before.id} aria-label={`Atualizações de ${entry.before.code}`}>
          <label className="import-item-select"><input type="checkbox" ref={input => { if (input) input.indeterminate = selected.length > 0 && !entry.changes.every(change => selected.includes(change.field)); }} aria-label={`Selecionar alterações de ${entry.before.code}`} checked={entry.changes.every(change => selected.includes(change.field))} onChange={e => setSelection(current => ({ ...current, [entry.before.id]: e.target.checked ? entry.changes.map(change => change.field) : [] }))} /><strong>{entry.before.code}</strong><span>{entry.before.description}</span></label>
          <div className="table-wrap"><table><thead><tr><th>Aplicar</th><th>Campo</th><th>Valor atual</th><th>Valor da planilha</th></tr></thead><tbody>{entry.changes.map(change => <tr key={change.field}><td><input type="checkbox" aria-label={`Atualizar ${change.label} de ${entry.before.code}`} checked={selected.includes(change.field)} onChange={e => setSelection(current => ({ ...current, [entry.before.id]: e.target.checked ? [...new Set([...selected, change.field])] : selected.filter(field => field !== change.field) }))} /></td><td>{change.label}</td><td>{change.before || "(vazio)"}</td><td>{change.after}</td></tr>)}</tbody></table></div>
        </section>;
      })}</div>
      <div className="import-update-confirmation">
        <p><strong>{selectedCount} itens · {selectedFields} campos selecionados</strong></p>
        <button type="button" className="secondary-button" onClick={() => {
          try { onBackup(); setDownloadedVersion(backupVersion); setError(""); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível gerar o backup."); }
        }}>{backupReady ? "Baixar backup novamente" : "Baixar backup antes de atualizar"}</button>
        <p className="form-note">{backupReady ? "Backup gerado para download. Confira se o arquivo foi salvo no computador antes de continuar." : "O backup inclui os cadastros, ciclos e histórico atuais. Gere-o antes de atualizar."}</p>
        <label className="import-confirmation-label">Digite ATUALIZAR para confirmar<input value={confirmation} autoComplete="off" onChange={e => setConfirmation(e.target.value)} placeholder="ATUALIZAR" /></label>
        {error && <p role="alert" className="catalog-error">{error}</p>}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setReviewOpen(false)}>Cancelar atualização</button><button type="button" className="primary-button" disabled={!selectedCount || confirmation !== "ATUALIZAR" || !backupReady} onClick={() => {
          try { onUpdate(selection, confirmation, downloadedVersion ?? ""); setReviewOpen(false); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar."); }
        }}>Aplicar atualizações ({selectedCount})</button></div>
      </div>
    </dialog>}
  </section>;
}
