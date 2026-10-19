import { useEffect, useRef, useState } from "react";
import type { DLControlRow } from "../../services/dlControl";
import type { DLManualDebitInput } from "../../types/orders";
import { decimalInput, parseScaledInput } from "../../services/dlPlanning";
import { DEFAULT_DL_REQUESTER } from "../../config/uiDefaults";

export default function DLManualDebitDialog({
  row,
  onSave,
  onClose,
}: {
  row: DLControlRow;
  onSave: (input: DLManualDebitInput) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [quantity, setQuantity] = useState("");
  const [actor, setActor] = useState(DEFAULT_DL_REQUESTER);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  function save() {
    try {
      const quantityMilli =
        parseScaledInput(quantity, 3, "Quantidade da baixa") || 0;
      onSave({
        planId: row.plan.id,
        originId: row.origin.id,
        quantityMilli,
        actor,
        reason,
      });
      ref.current?.close();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível registrar a baixa.",
      );
    }
  }
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog dl-manual-debit-dialog"
      aria-labelledby="dl-manual-title"
      onClose={onClose}
    >
      <h2 id="dl-manual-title">Registrar baixa manual</h2>
      <p>
        {row.item?.description || row.origin.itemId} · {row.plan.code}
      </p>
      <p>
        Disponível:{" "}
        <strong>
          {decimalInput(row.origin.availableMilli, 3)} {row.origin.unit}
        </strong>
        . Quantidades reservadas em PDLs ficam protegidas.
      </p>
      <p>
        Para entregas de um PDL, registre o recebimento no próprio pedido. Use
        esta baixa para consumos fora desse fluxo.
      </p>
      <label>
        Quantidade
        <input
          aria-label="Quantidade da baixa manual"
          inputMode="decimal"
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value);
            setError("");
          }}
        />
      </label>
      <label>
        Responsável
        <input
          aria-label="Responsável pela baixa manual"
          value={actor}
          onChange={(event) => setActor(event.target.value)}
        />
      </label>
      <label>
        Justificativa
        <textarea
          aria-label="Justificativa da baixa manual"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="catalog-error">
          {error}
        </p>
      )}
      <footer>
        <button
          className="secondary-button"
          onClick={() => ref.current?.close()}
        >
          Fechar
        </button>
        <button className="primary-button" onClick={save}>
          Confirmar baixa
        </button>
      </footer>
    </dialog>
  );
}
