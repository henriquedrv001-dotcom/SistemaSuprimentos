import { useState } from "react";
import { Download, FileText } from "lucide-react";
import type { DLOrderDocument } from "../../types/dl";
import { downloadDLDocument } from "../../services/dlDocuments";
import DLDocumentPreview from "./DLDocumentPreview";

export default function DLOrderDocumentList({
  documents,
}: {
  documents: DLOrderDocument[];
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function download(document: DLOrderDocument) {
    setError("");
    setBusy(true);
    try {
      await downloadDLDocument(document.id, document.name);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível baixar o documento.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="dl-consult-documents" aria-label="Documentos do pedido">
      <h4>Documento{documents.length === 1 ? "" : "s"} do pedido</h4>
      {documents.length ? (
        <ul>
          {documents.map((document) => (
            <li key={document.id}>
              <FileText size={22} aria-hidden="true" />
              <div>
                <strong>{document.name}</strong>
                <small>
                  {Math.ceil(document.size / 1024)} KB ·{" "}
                  {new Date(document.timestamp).toLocaleDateString("pt-BR")}
                </small>
              </div>
              <DLDocumentPreview document={document} />
              <button
                className="text-button"
                aria-label={`Baixar ${document.name}`}
                disabled={busy}
                onClick={() => void download(document)}
              >
                <Download size={16} aria-hidden="true" />
                Baixar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Nenhum anexo registrado.</p>
      )}
      {error && (
        <p role="alert" className="catalog-error">
          {error}
        </p>
      )}
    </section>
  );
}
