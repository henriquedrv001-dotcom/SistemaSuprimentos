import type { RemoteSnapshot, CatalogCommand, AppUser } from "../types/remote";
import type { ExpiryCommand } from "../services/expiryCommands";
export class RemoteRepository {
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`/api${path}`, {
        credentials: "same-origin",
        cache: "no-store",
        ...init,
        headers: {
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new Error(
        "Sem conexão com o servidor. Seu preenchimento foi mantido.",
      );
    }
    const body = await response
      .json()
      .catch(() => ({ error: "Resposta inválida do servidor." }));
    if (!response.ok)
      throw new Error(body.error || "Não foi possível concluir a operação.");
    return body as T;
  }
  backup() {
    return this.request<Record<string, unknown>>("/backup");
  }
  snapshot() {
    return this.request<RemoteSnapshot>("/workspace");
  }
  catalog(command: CatalogCommand, revision: string) {
    return this.request<RemoteSnapshot>("/catalog", {
      method: "POST",
      body: JSON.stringify({ command, revision }),
    });
  }
  expiry(command: ExpiryCommand, revision: string) {
    return this.request<RemoteSnapshot>("/expiry", {
      method: "POST",
      body: JSON.stringify({ command, revision }),
    });
  }
  login(email: string, password: string) {
    return this.request<{ user: AppUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }
  me() {
    return this.request<{ user: AppUser }>("/auth/me");
  }
  logout() {
    return this.request<{ ok: true }>("/auth/logout", {
      method: "POST",
      body: "{}",
    });
  }
}
export type RemoteContext = {
  repository: RemoteRepository;
  initial: RemoteSnapshot;
  user: AppUser;
  onLogout: () => void;
};
