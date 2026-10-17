import { Paperclip, FileText, Download, X } from "lucide-react";
import { dlOrderDocuments } from "../../services/dlOrderDocuments";
import { useRef, useState } from "react";
import type { DLPlan, DLSaveOptions } from "../../types/dl";
import type { Item } from "../../types";
import { dlObservation } from "../../services/dlRequest";
import {
  canRegisterDLOrder,
  processFlow,
  registerDLOrder,
  returnDLSuppliers,
  submitDLSuppliers,
} from "../../services/dlProcess";
import {
  downloadDLDocument,
  findDLDocument,
  requireDLDocument,
  removeDLDocument,
  saveDLDocument,
} from "../../services/dlDocuments";
import DLContractForm from "./DLContractForm";
import type { ContractInput } from "./DLContractForm";
import { validateDLContract } from "../../services/dlContract";
export function DLJustificationStep({
  plan,
  blocked,
  onPersist,
  text,
  onTextChange,
}: {
  text: string;
  onTextChange: (value: string) => void;
  plan: DLPlan;
  blocked: boolean;
  onPersist: (plan: DLPlan, label: string, options: DLSaveOptions) => void;
}) {
  const [error, setError] = useState("");
  const editable =
    !plan.contract?.release &&
    [
      "Rascunho",
      "Em planejamento",
      "Planejamento concluído",
      "Gerar requisição",
    ].includes(plan.stage);
  function save(complete: boolean) {
    try {
      if (!text.trim())
        throw new Error("Preencha a justificativa antes de salvar.");
      onPersist(
        {
          ...plan,
          processFlow: {
            ...processFlow(plan),
            justification: {
              text: text.trim(),
              ...(complete ? { completedAt: new Date().toISOString() } : {}),
            },
          },
        },
        complete
          ? "Justificativa concluída"
          : "Rascunho da justificativa salvo",
        { processAction: "justification" },
      );
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a justificativa.",
      );
    }
  }
  return (
    <section
      className="dl-request-step"
      aria-labelledby="dl-justification-title"
    >
      <div className="panel-heading">
        <h3 id="dl-justification-title">1. Gerar justificativa</h3>
        <span
          className={`tag ${plan.processFlow?.justification?.completedAt ? "tag-green" : "tag-neutral"}`}
        >
          {plan.processFlow?.justification?.completedAt
            ? "Concluída"
            : "Preparação"}
        </span>
      </div>
      <p className="muted">
        Modelo básico para revisar e copiar para a documentação. Não substitui a
        Observação / Justificativa do MXM.
      </p>
      <details>
        <summary>Preparar justificativa</summary>
        <div className="form-grid">
          <label className="dl-full-row">
            Justificativa do processo
            <textarea
              rows={4}
              disabled={!editable || blocked}
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
            />
          </label>
        </div>
        <div className="dl-actions">
          <button
            className="secondary-button"
            disabled={!editable || blocked}
            onClick={() => {
              if (
                !text.trim() ||
                window.confirm(
                  "Substituir o texto em edição pelo modelo básico?",
                )
              )
                onTextChange(
                  `Solicita-se a aquisição de ${plan.title.toLocaleLowerCase("pt-BR")} para atender às necessidades de abastecimento.\n\n${dlObservation(plan)}\n\nAs quantidades e especificações constam na relação de materiais. Revisar a necessidade, o período de atendimento e os impactos da não aquisição.`,
                );
            }}
          >
            Usar modelo básico
          </button>
          <button
            className="secondary-button"
            disabled={!text.trim()}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setError("Texto copiado.");
              } catch {
                setError(
                  "Não foi possível copiar. Selecione o texto para copiar manualmente.",
                );
              }
            }}
          >
            Copiar justificativa
          </button>
          <button
            className="secondary-button"
            disabled={!editable || blocked}
            onClick={() => save(false)}
          >
            Salvar justificativa
          </button>
          <button
            className="primary-button"
            disabled={!editable || blocked}
            onClick={() => save(true)}
          >
            Concluir justificativa
          </button>
        </div>
      </details>
      {error && (
        <p role="status" className="muted">
          {error}
        </p>
      )}
    </section>
  );
}
export default function DLProcessStages({
  plan,
  items,
  value,
  onChange,
  contractDirty,
  blocked,
  onPersist,
  onSaveContract,
  onApprove,
}: {
  plan: DLPlan;
  items: Item[];
  value: ContractInput;
  onChange: (value: ContractInput) => void;
  contractDirty: boolean;
  blocked: boolean;
  onPersist: (plan: DLPlan, label: string, options: DLSaveOptions) => void;
  onSaveContract: () => void;
  onApprove: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const eligible = canRegisterDLOrder(plan);
  const submitted = !!plan.processFlow?.suppliersSubmitted;
  const attachments = dlOrderDocuments(plan);
  const hasAttachments = attachments.length > 0;
  const processClosed =
    plan.stage === "Pedido gerado" || !!plan.contract?.release;
  const locked = blocked || busy;
  const canFill =
    eligible &&
    hasAttachments &&
    !submitted &&
    (processClosed || !plan.processFlow?.purchaseOrders);
  const released = !!plan.contract?.release;
  async function register() {
    if (!files.length && (!hasAttachments || processClosed)) return;
    if (
      !window.confirm(
        processClosed
          ? "Registrar os novos anexos? O processo permanece fechado com status Pedido gerado."
          : "Registrar o pedido? O processo de compra será fechado com status Pedido gerado. Fornecedores e aprovação final continuam nas próximas etapas.",
      )
    )
      return;
    setBusy(true);
    setError("");
    const uploaded: Awaited<ReturnType<typeof saveDLDocument>>[] = [];
    try {
      for (const file of files) {
        let recovery;
        for (const document of attachments) {
          if (
            document.name === file.name &&
            document.size === file.size &&
            document.type === file.type &&
            !(await findDLDocument(document.id))
          ) {
            recovery = document;
            break;
          }
        }
        uploaded.push(await saveDLDocument(file, recovery));
      }
      const candidate = registerDLOrder(plan, uploaded);
      onPersist(
        candidate,
        `${processClosed ? "Anexos do pedido adicionados" : "Pedido gerado · processo fechado"}: ${dlOrderDocuments(
          candidate,
        )
          .map((document) => document.name)
          .join(", ")}`,
        { processAction: "registerOrder" },
      );
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
    } catch (cause) {
      await Promise.allSettled(
        uploaded.map((document) => removeDLDocument(document.id)),
      );
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível registrar o pedido.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function act(action: "submit" | "return") {
    try {
      if (action === "submit") {
        if (
          !window.confirm(
            "Enviar os fornecedores e valores para aprovação? Os dados ficarão bloqueados até uma devolução.",
          )
        )
          return;
        await Promise.all(
          attachments.map((document) => requireDLDocument(document.id)),
        );
        onPersist(
          submitDLSuppliers(plan),
          "Fornecedores enviados para aprovação",
          { processAction: "submitSuppliers" },
        );
      } else {
        const reason = window.prompt(
          "Informe o que precisa ser corrigido nos dados finais:",
        );
        if (reason === null) return;
        onPersist(
          returnDLSuppliers(plan, reason),
          `Fornecedores devolvidos para correção: ${reason.trim()}`,
          { processAction: "returnSuppliers" },
        );
      }
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar a etapa.",
      );
    }
  }
  return (
    <>
      <section className="dl-request-step" aria-labelledby="dl-order-title">
        <div className="panel-heading">
          <h3 id="dl-order-title">4. Registro do pedido</h3>
          <span
            className={`tag ${processClosed || hasAttachments ? "tag-green" : "tag-neutral"}`}
          >
            {processClosed
              ? "Pedido gerado"
              : hasAttachments
                ? "Anexos registrados"
                : "Aguardando pedido"}
          </span>
        </div>
        <p className="muted">
          A responsável pela compra anexa o pedido emitido no MXM para orientar
          o preenchimento dos dados finais.
        </p>
        {processClosed && plan.processFlow?.orderRegistered && (
          <p className="dl-order-closed" role="status">
            Processo de compra fechado ao registrar o pedido em{" "}
            {new Date(
              plan.processFlow.orderRegistered.timestamp,
            ).toLocaleString("pt-BR")}
            . A definição dos fornecedores e a aprovação final continuam abaixo.
          </p>
        )}
        {hasAttachments && (
          <ul className="dl-order-files" aria-label="Anexos registrados">
            {attachments.map((document) => (
              <li key={document.id}>
                <FileText size={17} aria-hidden="true" />
                <span>
                  <strong>{document.name}</strong>
                  <small>
                    {Math.max(
                      1,
                      Math.ceil(document.size / 1024),
                    ).toLocaleString("pt-BR")}{" "}
                    KB
                  </small>
                </span>
                <button
                  className="text-button"
                  aria-label={`Baixar ${document.name}`}
                  onClick={async () => {
                    try {
                      await downloadDLDocument(document.id, document.name);
                      setError("");
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Não foi possível baixar o documento.",
                      );
                    }
                  }}
                >
                  <Download size={15} aria-hidden="true" />
                  Baixar
                </button>
              </li>
            ))}
          </ul>
        )}
        {!released && (
          <>
            <div className="dl-order-upload">
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                multiple
                aria-label="Anexar pedidos MXM"
                accept="application/pdf,image/png,image/jpeg"
                disabled={!eligible || submitted || locked || contractDirty}
                onChange={(event) => {
                  const incoming = Array.from(event.target.files ?? []);
                  setFiles((current) => {
                    const next = [...current];
                    for (const file of incoming)
                      if (
                        !next.some(
                          (existing) =>
                            existing.name === file.name &&
                            existing.size === file.size &&
                            existing.type === file.type &&
                            existing.lastModified === file.lastModified,
                        )
                      )
                        next.push(file);
                    return next;
                  });
                  event.target.value = "";
                }}
              />
              <button
                className="secondary-button"
                disabled={!eligible || submitted || locked || contractDirty}
                onClick={() => fileInput.current?.click()}
              >
                <Paperclip size={17} aria-hidden="true" />
                Anexar arquivos
              </button>
              <span className="muted">
                PDF, PNG ou JPG · até 20 MB por arquivo
              </span>
            </div>
            {files.length > 0 && (
              <ul
                className="dl-order-files dl-order-pending"
                aria-label="Arquivos a registrar"
              >
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`}>
                    <FileText size={17} aria-hidden="true" />
                    <span>
                      <strong>{file.name}</strong>
                      <small>
                        A registrar ·{" "}
                        {Math.max(
                          1,
                          Math.ceil(file.size / 1024),
                        ).toLocaleString("pt-BR")}{" "}
                        KB
                      </small>
                    </span>
                    <button
                      className="text-button"
                      aria-label={`Remover ${file.name} da seleção`}
                      disabled={busy}
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="primary-button"
              disabled={
                (!files.length && (!hasAttachments || processClosed)) ||
                !eligible ||
                submitted ||
                locked ||
                contractDirty
              }
              onClick={register}
            >
              {busy ? "Registrando…" : "Registrar pedido"}
            </button>
            {!processClosed && (
              <p className="muted">
                Registrar o pedido fecha o processo de compra e muda o status
                para Pedido gerado.
              </p>
            )}
          </>
        )}
        <p className="muted">
          Anexos salvos somente neste navegador. Ainda não são compartilhados
          entre usuários e não acompanham o backup JSON.
        </p>
      </section>
      <section className="dl-request-step" aria-labelledby="dl-suppliers-title">
        <div className="panel-heading">
          <h3 id="dl-suppliers-title">5. Definição de fornecedores</h3>
          <span
            className={`tag ${submitted || released ? "tag-green" : "tag-neutral"}`}
          >
            {released
              ? "Aprovada"
              : submitted
                ? "Enviada para aprovação"
                : "A preencher"}
          </span>
        </div>
        <p className="muted">
          O aprendiz confere o pedido anexado e informa fornecedores, números
          MXM, preços e vigência. Um fornecedor por item; as quantidades vêm do
          planejamento.
        </p>
        {(!hasAttachments ||
          (!processClosed && !!plan.processFlow?.purchaseOrders)) &&
          !released && (
            <p className="catalog-feedback">
              Registre o pedido na etapa 4 para liberar o preenchimento.
            </p>
          )}
        {plan.processFlow?.suppliersReturn && !submitted && !released && (
          <p className="dl-return-note">
            <strong>Correção solicitada:</strong>{" "}
            {plan.processFlow.suppliersReturn.reason}
          </p>
        )}
        <details>
          <summary>Conferir fornecedores e valores</summary>
          <DLContractForm
            plan={plan}
            items={items}
            value={value}
            onChange={onChange}
            readOnly={!canFill || locked}
          />
          {!released && (
            <div className="dl-actions">
              <button
                className="secondary-button"
                disabled={!canFill || locked}
                onClick={onSaveContract}
              >
                Salvar fornecedores e valores
              </button>
              <button
                className="primary-button"
                disabled={!canFill || locked || contractDirty}
                onClick={() => act("submit")}
              >
                Enviar para aprovação
              </button>
            </div>
          )}
        </details>
      </section>
      <section className="dl-request-step" aria-labelledby="dl-approval-title">
        <div className="panel-heading">
          <h3 id="dl-approval-title">6. Aprovação</h3>
          <span className={`tag ${released ? "tag-green" : "tag-neutral"}`}>
            {released
              ? "DL concluída"
              : submitted
                ? "Aguardando aprovação"
                : "Aguardando fornecedores"}
          </span>
        </div>
        <p className="muted">
          Confira o pedido, os fornecedores e os valores. Somente a aprovação
          final libera os saldos no Controle de DLs.
        </p>
        {!released && (
          <div className="dl-actions">
            <button
              className="secondary-button"
              disabled={!submitted || !eligible || locked || contractDirty}
              onClick={() => act("return")}
            >
              Devolver fornecedores para correção
            </button>
            <button
              className="primary-button"
              disabled={!submitted || !eligible || locked || contractDirty}
              onClick={async () => {
                try {
                  await Promise.all(
                    attachments.map((document) =>
                      requireDLDocument(document.id),
                    ),
                  );
                  validateDLContract(plan, true);
                  onApprove();
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Revise os dados finais.",
                  );
                }
              }}
            >
              Aprovar e concluir DL
            </button>
          </div>
        )}
        {released && (
          <p className="muted">
            Aprovada em{" "}
            {new Date(plan.contract!.release!.timestamp).toLocaleString(
              "pt-BR",
            )}{" "}
            · {plan.contract!.release!.actor}
          </p>
        )}
      </section>
      {error && (
        <p className="catalog-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
