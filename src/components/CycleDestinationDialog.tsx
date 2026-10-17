import { useEffect, useRef, useState } from "react";
import type { CycleRequestGroup, SupplyCycle } from "../types";
export default function CycleDestinationDialog({
  count,
  cycles,
  groups,
  onConfirm,
  onClose,
  onOpenCycles,
}: {
  count: number;
  cycles: SupplyCycle[];
  groups: CycleRequestGroup[];
  onConfirm: (cycleId: string, groupId: string | null) => void;
  onClose: () => void;
  onOpenCycles: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [cycleId, setCycleId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const available = cycles.filter((cycle) => cycle.status !== "Encerrado");
  return (
    <dialog
      className="item-edit-dialog"
      ref={ref}
      aria-labelledby="cycle-destination-title"
      onClose={onClose}
    >
      <div className="panel-heading">
        <div>
          <h2 id="cycle-destination-title">Adicionar seleção a um ciclo</h2>
          <p>
            {count} materiais selecionados. Os que já estiverem no ciclo serão
            preservados, sem duplicar.
          </p>
        </div>
        <button className="secondary-button" onClick={onClose}>
          Fechar
        </button>
      </div>
      {available.length ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              onConfirm(cycleId, groupId || null);
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Não foi possível adicionar.",
              );
            }
          }}
        >
          <div className="form-grid">
            <label>
              Ciclo de destino
              <select
                aria-label="Ciclo de destino"
                required
                value={cycleId}
                onChange={(e) => {
                  setCycleId(e.target.value);
                  setGroupId("");
                }}
              >
                <option value="">Escolha um ciclo</option>
                {available.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.name} · {cycle.status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Grupo de solicitação
              <select
                aria-label="Grupo de solicitação"
                value={groupId}
                disabled={!cycleId}
                onChange={(e) => setGroupId(e.target.value)}
              >
                <option value="">Sem grupo</option>
                {groups
                  .filter((group) => group.cycleId === cycleId)
                  .map((group) => (
                    <option value={group.id} key={group.id}>
                      {group.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <p className="form-note">
            As quantidades entram como “A definir”. Materiais inativos não serão
            incluídos.
          </p>
          {error && (
            <p role="alert" className="catalog-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={!cycleId}
            >
              Adicionar ao ciclo
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="empty-state">
            Ainda não há ciclos abertos. Crie um ciclo para receber os
            materiais.
          </p>
          <button className="primary-button" onClick={onOpenCycles}>
            Ir para ciclos
          </button>
        </>
      )}
    </dialog>
  );
}
