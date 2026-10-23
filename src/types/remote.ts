import type { Item, ItemHistoryEntry } from "../types";
import type { ExpiryWorkspace } from "./expiry";
export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "reader";
};
export type RemoteSnapshot = {
  revision: string;
  items: Item[];
  history: ItemHistoryEntry[];
  expiry: ExpiryWorkspace;
};
export type CatalogCommand =
  | {
      kind: "create" | "update" | "import-create" | "import-update";
      items: Item[];
    }
  | { kind: "delete"; ids: string[] };
