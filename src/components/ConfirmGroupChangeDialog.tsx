import { useEffect, useRef, useState } from "react";

export default function ConfirmGroupChangeDialog({ count, origins, destination, onConfirm, onClose }: {
  count: number;
  origins: string[];
  destination: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); cancelButton.current?.focus(); }, []);
  return <dialog ref={dialog} className="item-edit-dialog cycle-confirm-dialog" aria-labelledby="confirm-group-title" aria-describedby="confirm-group-description" onClose={onClose}>
    <h2 id="confirm-group-title">Confirmar alteração de grupo</h2>
    <p id="confirm-group-description">Mover <strong>{count} {count === 1 ? "material" : "materiais"}</strong> de <strong>{origins.join(", ")}</strong> para <strong>{destination}</strong>?</p>
    <p className="muted">As quantidades previstas serão mantidas.</p>
    {error && <p role="alert" className="catalog-error">{error}</p>}
    <div className="form-actions"><button ref={cancelButton} type="button" className="secondary-button" onClick={onClose}>Não, manter grupo</button><button type="button" className="primary-button" onClick={() => { try { onConfirm(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível alterar o grupo."); } }}>Sim, alterar grupo</button></div>
  </dialog>;
}
