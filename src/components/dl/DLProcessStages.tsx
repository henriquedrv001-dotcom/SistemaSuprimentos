import DLDocumentPreview from "./DLDocumentPreview";
import DLWorkflowStep from "./DLWorkflowStep";
import { Paperclip, FileText, Download, X } from "lucide-react";
import { dlOrderDocuments } from "../../services/dlOrderDocuments";
import { useRef, useState } from "react";
import type { DLPlan, DLSaveOptions } from "../../types/dl";
import type { Item } from "../../types";
import { dlObservation } from "../../services/dlRequest";
import {
  canRegisterDLOrder,
  needsDLContractRegistration,
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
    <DLWorkflowStep
      id="dl-justification-title"
      number={1}
      context={
        plan.processFlow?.justification?.completedAt
          ? "Justificativa registrada."
          : "Justificativa do processo a preparar."
      }
      title="Gerar justificativa"
      status={
        plan.processFlow?.justification?.completedAt
          ? "Concluída"
          : "Preparação"
      }
      completed={!!plan.processFlow?.justification?.completedAt}
      active={editable}
      description="Revise e copie o modelo básico para a documentação. O texto é independente da justificativa do MXM."
    >
      <div className="dl-step-content">
        <div className="form-grid">
          <label className="dl-full-row">
            Justificativa do processo
            <textarea
              aria-label="Justificativa do processo"
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
      </div>
      {error && (
        <p role="status" className="muted">
          {error}
        </p>
      )}
    </DLWorkflowStep>
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
  const needsRegistration = needsDLContractRegistration(plan);
  const locked = blocked || busy;
  const canFill =
    eligible &&
    !needsRegistration &&
    hasAttachments &&
    !submitted &&
    (processClosed || !plan.processFlow?.purchaseOrders);
  const released = !!plan.contract?.release;
  async function register() {
    if (
      !files.length &&
      (!hasAttachments || (processClosed && !needsRegistration))
    )
      return;
    if (
      !window.confirm(
        processClosed && !files.length && needsRegistration
          ? "Completar os dados automáticos da contratação a partir do registro existente?"
          : processClosed
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
        `${processClosed ? (uploaded.length ? "Anexos do pedido adicionados" : "Dados automáticos da contratação atualizados") : "Pedido gerado · processo fechado"}: ${dlOrderDocuments(
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
      <DLWorkflowStep
        id="dl-order-title"
        number={4}
        context={
          attachments.length
            ? `${attachments.length} anexo(s) do pedido registrado(s).`
            : "Pedido emitido a registrar."
        }
        title="Registro do pedido"
        status={
          needsRegistration && hasAttachments && eligible
            ? "Completar registro"
            : processClosed
              ? "Pedido gerado"
              : hasAttachments
                ? "Anexos registrados"
                : "Aguardando pedido"
        }
        completed={(processClosed || hasAttachments) && !needsRegistration}
        active={eligible && (!processClosed || needsRegistration)}
        description="Anexe o pedido emitido no MXM. Registrar fecha o processo de compra com status Pedido gerado."
      >
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
                <DLDocumentPreview document={document} />
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
                (!files.length &&
                  (!hasAttachments || (processClosed && !needsRegistration))) ||
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
          Anexos locais neste navegador; não são compartilhados entre usuários
          nem incluídos no backup JSON.
        </p>
      </DLWorkflowStep>
      <DLWorkflowStep
        id="dl-suppliers-title"
        number={5}
        context={`${plan.lines.length} material(is) para conferência dos dados finais.`}
        title="Definição de fornecedores"
        status={
          released
            ? "Aprovada"
            : submitted
              ? "Enviada para aprovação"
              : canFill
                ? "Em preenchimento"
                : "Aguardando pedido"
        }
        completed={submitted || released}
        active={canFill}
        description="Confira o pedido e informe fornecedores, números MXM e preços. As quantidades vêm do planejamento."
      >
        {(!hasAttachments ||
          needsRegistration ||
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
        <div className="dl-step-content">
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
        </div>
      </DLWorkflowStep>
      <DLWorkflowStep
        id="dl-approval-title"
        number={6}
        context={
          released
            ? "Conferência final concluída."
            : "Conferência final dos dados da aquisição."
        }
        title="Aprovação"
        status={
          released
            ? "DL concluída"
            : submitted
              ? "Aguardando aprovação"
              : "Aguardando fornecedores"
        }
        completed={released}
        active={submitted && !released}
        description="Confira os dados finais. A aprovação libera os saldos no Controle de DLs."
      >
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
      </DLWorkflowStep>
      {error && (
        <p className="catalog-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
