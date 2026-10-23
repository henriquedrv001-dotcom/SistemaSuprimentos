import type { Item } from "../types";
import type { ExpiryWorkspace } from "../types/expiry";
import {
  registerExpiryBatch,
  addExpiryEntry,
  debitExpiry,
  countExpiry,
  transferExpiry,
} from "./expiry.ts";
type WithoutActor<T> = Omit<T, "actor" | "today">;
export type ExpiryCommand =
  | {
      kind: "register";
      entries: WithoutActor<
        Parameters<typeof registerExpiryBatch>[2][number]
      >[];
    }
  | { kind: "entry"; input: WithoutActor<Parameters<typeof addExpiryEntry>[2]> }
  | { kind: "debit"; input: WithoutActor<Parameters<typeof debitExpiry>[1]> }
  | { kind: "count"; counts: Parameters<typeof countExpiry>[1]; reason: string }
  | {
      kind: "transfer";
      input: WithoutActor<Parameters<typeof transferExpiry>[2]>;
    };
export function applyExpiryCommand(
  workspace: ExpiryWorkspace,
  items: Item[],
  command: ExpiryCommand,
  actor: string,
) {
  switch (command.kind) {
    case "register":
      return registerExpiryBatch(
        workspace,
        items,
        command.entries.map((entry) => ({ ...entry, actor })),
      );
    case "entry":
      return addExpiryEntry(workspace, items, { ...command.input, actor });
    case "debit":
      return debitExpiry(workspace, {
        ...command.input,
        actor,
        today: undefined,
      });
    case "count":
      return countExpiry(workspace, command.counts, actor, command.reason);
    case "transfer":
      return transferExpiry(workspace, items, { ...command.input, actor });
    default:
      throw new Error("Operação de validade inválida.");
  }
}
