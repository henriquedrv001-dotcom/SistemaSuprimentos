// Files stay in this browser until a shared document backend is connected.
const databaseName = "suprimentos:documents:v1";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("documents");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error("Não foi possível abrir o armazenamento de documentos."),
      );
    request.onblocked = () =>
      reject(
        new Error("Feche outras abas do sistema para abrir os documentos."),
      );
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("documents", mode);
      const request = run(tx.objectStore("documents"));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () =>
        reject(
          new Error(
            "Não foi possível gravar ou acessar o documento. Os dados da DL foram preservados.",
          ),
        );
      tx.onerror = () =>
        reject(new Error("Falha no armazenamento do documento."));
    });
  } finally {
    db.close();
  }
}
export async function saveDLDocument(file: File) {
  if (
    !["application/pdf", "image/png", "image/jpeg"].includes(file.type) ||
    !file.size ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error("Use um arquivo PDF, PNG ou JPG com até 20 MB.");
  const id = `dl-document-${crypto.randomUUID()}`;
  await transaction("readwrite", (store) => store.add(file, id));
  return {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    timestamp: new Date().toISOString(),
    actor: "Sessão local · sem autenticação",
  };
}
export async function removeDLDocument(id: string) {
  await transaction("readwrite", (store) => store.delete(id));
}
export async function requireDLDocument(id: string) {
  const blob = await transaction<Blob | undefined>("readonly", (store) =>
    store.get(id),
  );
  if (!blob)
    throw new Error(
      "O arquivo não está neste navegador. Anexos locais não são sincronizados com outros dispositivos. Registre novamente o pedido antes de prosseguir.",
    );
  return blob;
}
export async function downloadDLDocument(id: string, name: string) {
  const blob = await requireDLDocument(id);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
