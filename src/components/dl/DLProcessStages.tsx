import { useState } from "react";
import type { DLPlan, DLSaveOptions } from "../../types/dl";
import type { Item } from "../../types";
import { dlObservation } from "../../services/dlRequest";
import {
  canRegisterDLOrder,
  processFlow,
  returnDLSuppliers,
  submitDLSuppliers,
} from "../../services/dlProcess";
import {
  downloadDLDocument,
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
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const eligible = canRegisterDLOrder(plan);
  const submitted = !!plan.processFlow?.suppliersSubmitted;
  const attachment = plan.processFlow?.purchaseOrder;
  const locked = blocked || busy;
  const canFill = eligible && !!attachment && !submitted;
  const released = !!plan.contract?.release;
  async function register() {
    if (!file) return;
    if (
      attachment &&
      !window.confirm(
        "Substituir o anexo atual do pedido? A alteração ficará no histórico.",
      )
    )
      return;
    setBusy(true);
    setError("");
    let uploaded: Awaited<ReturnType<typeof saveDLDocument>> | null = null;
    try {
      uploaded = await saveDLDocument(file);
      onPersist(
        {
          ...plan,
          processFlow: { ...processFlow(plan), purchaseOrder: uploaded },
        },
        `Pedido registrado: ${uploaded.name}`,
        { processAction: "registerOrder" },
      );
      setFile(null);
    } catch (cause) {
      if (uploaded) {
        try {
          await removeDLDocument(uploaded.id);
        } catch {
          /* An unreferenced file must not mask the original failure. */
        }
      }
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
        await requireDLDocument(attachment!.id);
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
          <span className={`tag ${attachment ? "tag-green" : "tag-neutral"}`}>
            {attachment ? "Pedido registrado" : "Aguardando pedido"}
          </span>
        </div>
        <p className="muted">
          A responsável pela compra anexa o pedido emitido no MXM para orientar
          o preenchimento dos dados finais.
        </p>
        {attachment && (
          <p>
            <strong>{attachment.name}</strong> ·{" "}
            {Math.max(1, Math.ceil(attachment.size / 1024)).toLocaleString(
              "pt-BR",
              { maximumFractionDigits: 0 },
            )}{" "}
            KB{" "}
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await downloadDLDocument(attachment.id, attachment.name);
                  setError("");
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Não foi possível abrir o documento.",
                  );
                }
              }}
            >
              Baixar pedido
            </button>
          </p>
        )}
        {!released && (
          <>
            <div className="form-grid">
              <label className="dl-full-row">
                Anexar pedido MXM (PDF, PNG ou JPG até 20 MB)
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  disabled={!eligible || submitted || locked || contractDirty}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <button
              className="secondary-button"
              disabled={
                !file || !eligible || submitted || locked || contractDirty
              }
              onClick={register}
            >
              {busy ? "Registrando…" : "Registrar pedido"}
            </button>
          </>
        )}
        <p className="muted">
          Anexo salvo somente neste navegador. Ainda não é compartilhado entre
          usuários e não acompanha o backup JSON.
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
        {!attachment && !released && (
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
                  await requireDLDocument(attachment!.id);
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
