import type { ExpiryWorkspace } from "../types/expiry";
import { expiryKey, readExpiryWorkspace } from "../services/expiry.ts";
export type ExpirySnapshot = {
  workspace: ExpiryWorkspace;
  revision: string | null;
};
export interface ExpiryRepository {
  read(): ExpirySnapshot;
  save(
    workspace: ExpiryWorkspace,
    expectedRevision: string | null,
  ): ExpirySnapshot;
}
/** Adaptador local atual. Firebase será outro adaptador, sem acesso do componente ao SDK. */
export class LocalExpiryRepository implements ExpiryRepository {
  private storage: Pick<Storage, "getItem" | "setItem">;
  constructor(storage: Pick<Storage, "getItem" | "setItem">) {
    this.storage = storage;
  }
  read() {
    const raw = this.storage.getItem(expiryKey);
    return { workspace: readExpiryWorkspace(raw), revision: raw };
  }
  save(workspace: ExpiryWorkspace, expectedRevision: string | null) {
    if (this.storage.getItem(expiryKey) !== expectedRevision)
      throw new Error(
        "As validades mudaram em outra aba. Recarregue antes de salvar; a edição foi preservada.",
      );
    const raw = JSON.stringify(workspace);
    readExpiryWorkspace(raw);
    this.storage.setItem(expiryKey, raw);
    return { workspace, revision: raw };
  }
}
