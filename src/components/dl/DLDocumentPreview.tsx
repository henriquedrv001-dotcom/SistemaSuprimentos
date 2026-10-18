import { useEffect, useRef, useState } from "react";
import { Eye, X } from "lucide-react";
import type { DLOrderDocument } from "../../types/dl";
import { requireDLDocument } from "../../services/dlDocuments";

export default function DLDocumentPreview({
  document,
}: {
  document: DLOrderDocument;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  async function preview() {
    setError("");
    setLoading(true);
    try {
      const blob = await requireDLDocument(document.id);
      setUrl(URL.createObjectURL(blob));
      dialog.current?.showModal();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível visualizar o anexo.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <button
        className="text-button"
        aria-label={`Visualizar ${document.name}`}
        disabled={loading}
        onClick={preview}
      >
        <Eye size={15} aria-hidden="true" /> Visualizar
      </button>
      {error && (
        <span role="alert" className="dl-preview-error">
          {error}
        </span>
      )}
      <dialog
        ref={dialog}
        className="dl-document-preview"
        aria-label={`Visualização de ${document.name}`}
        onClose={() => setUrl("")}
      >
        <header>
          <strong>{document.name}</strong>
          <button
            className="text-button"
            aria-label="Fechar visualização"
            onClick={() => dialog.current?.close()}
          >
            <X size={20} />
          </button>
        </header>
        {url &&
          (document.type === "application/pdf" ? (
            <iframe title={document.name} src={url} />
          ) : (
            <img alt={document.name} src={url} />
          ))}
      </dialog>
    </>
  );
}
