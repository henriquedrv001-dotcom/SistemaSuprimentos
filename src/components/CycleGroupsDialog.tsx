import { useEffect, useRef, useState } from "react";
import type {
  CycleItemEvent,
  CycleWorkspace,
  Item,
  SupplyCycle,
} from "../types";
import {
  applyGroupTemplate,
  normalizeName,
  removeRequestGroup,
  saveGroupTemplate,
  saveRequestGroup,
} from "../services/cyclePlanning";

export default function CycleGroupsDialog({
  workspace,
  cycles,
  items,
  cycleId,
  onCommit,
  onClose,
  onApplied,
}: {
  workspace: CycleWorkspace;
  cycles: SupplyCycle[];
  items: Item[];
  cycleId: string;
  onCommit: (next: CycleWorkspace, events: CycleItemEvent[]) => void;
  onClose: () => void;
  onApplied: (groupId: string, message: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"groups" | "templates">("groups");
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const groups = workspace.groups.filter((group) => group.cycleId === cycleId);
  const closed =
    cycles.find((cycle) => cycle.id === cycleId)?.status === "Encerrado";
  function action(run: () => void) {
    try {
      run();
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    }
  }
  return (
    <dialog
      ref={ref}
      className="item-edit-dialog cycle-groups-dialog"
      aria-labelledby="cycle-groups-title"
      onClose={onClose}
    >
      <div className="panel-heading">
        <div>
          <h2 id="cycle-groups-title">Grupos de solicitação</h2>
          <p>
            Organização própria do ciclo, independente de Tipo e Grupo do
            cadastro MXM.
          </p>
        </div>
        <button className="secondary-button" onClick={onClose}>
          Fechar
        </button>
      </div>
      <div className="tabs">
        <button
          className={`tab ${tab === "groups" ? "active" : ""}`}
          onClick={() => setTab("groups")}
        >
          Grupos deste ciclo
        </button>
        <button
          className={`tab ${tab === "templates" ? "active" : ""}`}
          onClick={() => setTab("templates")}
        >
          Modelos salvos ({workspace.templates.length})
        </button>
      </div>
      {error && (
        <p role="alert" className="catalog-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="catalog-feedback">
          {message}
        </p>
      )}
      {tab === "groups" ? (
        <>
          <form
            className="cycle-group-create"
            onSubmit={(e) => {
              e.preventDefault();
              action(() => {
                const result = saveRequestGroup(
                  workspace,
                  cycles,
                  cycleId,
                  name,
                  editingId,
                );
                const affected = editingId
                  ? workspace.lines.filter(
                      (line) => line.requestGroupId === editingId,
                    )
                  : [];
                onCommit(
                  result.workspace,
                  affected.map((line) => ({
                    itemId: line.itemId,
                    action: "Grupo de solicitação renomeado",
                    details: `Ciclo: ${cycles.find((c) => c.id === cycleId)?.name}. Novo grupo: ${result.group.name}.`,
                  })),
                );
                setName("");
                setEditingId(undefined);
                setMessage(editingId ? "Grupo renomeado." : "Grupo criado.");
              });
            }}
          >
            <label>
              Nome do grupo de solicitação
              <input
                required
                value={name}
                disabled={closed}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Gêneros, Congelados, Bebidas"
              />
            </label>
            <button type="submit" className="primary-button" disabled={closed}>
              {editingId ? "Salvar nome" : "Criar grupo"}
            </button>
            {editingId && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditingId(undefined);
                  setName("");
                }}
              >
                Cancelar
              </button>
            )}
          </form>
          {!editingId && (
            <div className="cycle-group-suggestions">
              {[
                "Gêneros",
                "Congelados",
                "Bebidas",
                "Limpeza",
                "Administrativo",
                "Embalagens",
              ]
                .filter(
                  (name) =>
                    !groups.some(
                      (group) =>
                        normalizeName(group.name) === normalizeName(name),
                    ),
                )
                .map((suggestion) => (
                  <button
                    className="text-button"
                    key={suggestion}
                    disabled={closed}
                    onClick={() => setName(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
            </div>
          )}
          <div className="cycle-group-cards">
            {groups.map((group) => {
              const lines = workspace.lines.filter(
                (line) =>
                  line.requestGroupId === group.id && line.cycleId === cycleId,
              );
              return (
                <section className="cycle-group-card" key={group.id}>
                  <div>
                    <h3>{group.name}</h3>
                    <p>{lines.length} materiais</p>
                  </div>
                  <div className="cycle-inline-actions">
                    <button
                      className="secondary-button"
                      disabled={closed}
                      onClick={() => {
                        setEditingId(group.id);
                        setName(group.name);
                      }}
                    >
                      Renomear
                    </button>
                    <button
                      className="secondary-button"
                      disabled={!lines.length || closed}
                      onClick={() =>
                        action(() => {
                          const title = window.prompt(
                            "Nome do modelo reutilizável:",
                            group.name,
                          );
                          if (title === null) return;
                          const exists = workspace.templates.some(
                            (model) =>
                              normalizeName(model.name) ===
                              normalizeName(title),
                          );
                          if (
                            exists &&
                            !window.confirm(
                              "Substituir o modelo salvo? Os grupos já usados em outros ciclos não serão alterados.",
                            )
                          )
                            return;
                          onCommit(
                            saveGroupTemplate(
                              workspace,
                              title,
                              lines.map((line) => line.itemId),
                              exists,
                            ),
                            [],
                          );
                          setMessage(
                            "Modelo salvo. Use-o em outros ciclos pela aba Modelos salvos.",
                          );
                        })
                      }
                    >
                      Salvar como modelo
                    </button>
                    <button
                      className="secondary-button"
                      disabled={closed}
                      onClick={() =>
                        action(() => {
                          if (
                            !window.confirm(
                              `Excluir o grupo “${group.name}”? Os materiais permanecerão no ciclo, sem grupo.`,
                            )
                          )
                            return;
                          onCommit(
                            removeRequestGroup(
                              workspace,
                              cycles,
                              cycleId,
                              group.id,
                            ),
                            lines.map((line) => ({
                              itemId: line.itemId,
                              action: "Remoção de grupo de solicitação",
                              details: `Grupo ${group.name} removido do ciclo ${cycles.find((c) => c.id === cycleId)?.name}. Material mantido no ciclo, sem grupo.`,
                            })),
                          );
                          if (editingId === group.id) {
                            setEditingId(undefined);
                            setName("");
                          }
                          setMessage(
                            "Grupo removido. Seus materiais continuam no ciclo.",
                          );
                        })
                      }
                    >
                      Excluir grupo
                    </button>
                  </div>
                </section>
              );
            })}
            {!groups.length && (
              <p className="empty-state">
                Crie seus grupos e distribua os materiais do ciclo entre eles.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            Modelos guardam uma seleção de materiais, sem copiar quantidades,
            pedidos ou recebimentos. Cada ciclo terá sua própria composição.
          </p>
          <div className="cycle-group-cards">
            {workspace.templates.map((model) => (
              <section className="cycle-group-card" key={model.id}>
                <div>
                  <h3>{model.name}</h3>
                  <p>{model.itemIds.length} materiais no modelo</p>
                </div>
                <div className="cycle-inline-actions">
                  <button
                    className="primary-button"
                    disabled={closed}
                    onClick={() =>
                      action(() => {
                        const result = applyGroupTemplate(
                          workspace,
                          cycles,
                          items,
                          cycleId,
                          model.id,
                        );
                        const cycleName = cycles.find(
                          (c) => c.id === cycleId,
                        )?.name;
                        onCommit(
                          result.workspace,
                          result.added.map((item) => ({
                            itemId: item.id,
                            action: "Inclusão em ciclo por modelo",
                            details: `Ciclo: ${cycleName}. Grupo: ${result.group.name}. Quantidade a definir.`,
                          })),
                        );
                        onApplied(
                          result.group.id,
                          `${result.added.length} materiais incluídos; ${result.duplicateCount} já estavam no ciclo e foram preservados; ${result.unavailableCount} indisponíveis ou inativos.`,
                        );
                        onClose();
                      })
                    }
                  >
                    Usar neste ciclo
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      action(() => {
                        if (
                          !window.confirm(
                            `Excluir o modelo “${model.name}”? Os ciclos existentes serão preservados.`,
                          )
                        )
                          return;
                        onCommit(
                          {
                            ...workspace,
                            templates: workspace.templates.filter(
                              (entry) => entry.id !== model.id,
                            ),
                          },
                          [],
                        );
                        setMessage("Modelo excluído sem alterar os ciclos.");
                      })
                    }
                  >
                    Excluir modelo
                  </button>
                </div>
              </section>
            ))}
            {!workspace.templates.length && (
              <p className="empty-state">
                Salve um grupo como modelo ou selecione materiais no ciclo e use
                “Salvar seleção como modelo”.
              </p>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
