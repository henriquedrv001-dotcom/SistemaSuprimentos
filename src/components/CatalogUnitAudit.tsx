import { useEffect, useRef } from "react";
import type { Item } from "../types";
import { normalizeCatalogUnit } from "../services/catalogUnits";
export default function CatalogUnitAudit({
  items,
  onClose,
}: {
  items: Item[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.unit?.trim() || "";
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  const missing = items.filter((item) => !item.unit?.trim()).length;
  const spelling = items.filter(
    (item) => item.unit !== normalizeCatalogUnit(item.unit || ""),
  ).length;
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog expiry-dialog"
      aria-labelledby="unit-audit-title"
      onClose={onClose}
    >
      <header>
        <h2 id="unit-audit-title">Conferência de unidades</h2>
        <p>
          {items.length} materiais · {missing} sem unidade · {spelling} com
          diferença de grafia
        </p>
      </header>
      <div className="expiry-dialog-body">
        <p className="expiry-note">
          A padronização ajusta abreviações e maiúsculas. KG, UN, CX e PCT não
          são convertidos entre si. Confira a unidade de cada material com o
          cadastro do MXM antes de corrigir.
        </p>
        <div className="table-wrap">
          <table className="catalog-unit-audit-table">
            <thead>
              <tr>
                <th>Informada</th>
                <th>Exibição padronizada</th>
                <th>Materiais</th>
                <th>Exemplos</th>
              </tr>
            </thead>
            <tbody>
              {[...groups]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([unit, entries]) => (
                  <tr key={unit || "missing"}>
                    <td>{unit || "Sem unidade"}</td>
                    <td>{normalizeCatalogUnit(unit) || "Revisar no MXM"}</td>
                    <td>{entries.length}</td>
                    <td>
                      {entries
                        .slice(0, 3)
                        .map((item) => item.code)
                        .join(", ")}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="expiry-note">
          Esta conferência não altera os registros nem as quantidades. Use a
          revisão da importação para aplicar correções confirmadas.
        </p>
      </div>
      <footer>
        <button
          className="secondary-button"
          onClick={() => ref.current?.close()}
        >
          Fechar
        </button>
      </footer>
    </dialog>
  );
}
