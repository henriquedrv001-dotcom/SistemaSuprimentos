import { useEffect, useState } from "react";
import App from "./App";
import ThemeToggle from "./components/ThemeToggle";
import { RemoteRepository } from "./repositories/remoteRepository";
import type { AppUser, RemoteSnapshot } from "./types/remote";
import "./LaunchApp.css";
const repository = new RemoteRepository();
export default function LaunchApp() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [initial, setInitial] = useState<RemoteSnapshot | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const auth = await repository.me();
        const state = await repository.snapshot();
        if (alive) {
          setUser(auth.user);
          setInitial(state);
        }
      } catch {
        /* Sem sessão, mostrar a entrada; nunca usar dados locais como substitutos. */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const auth = await repository.login(email, password);
      const state = await repository.snapshot();
      setPassword("");
      setUser(auth.user);
      setInitial(state);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível entrar.",
      );
    } finally {
      setPending(false);
    }
  }
  async function logout() {
    try {
      await repository.logout();
      setUser(null);
      setInitial(null);
    } catch (cause) {
      window.alert(
        cause instanceof Error ? cause.message : "Não foi possível sair.",
      );
    }
  }
  if (user && initial)
    return (
      <App
        key={user.id}
        remote={{ repository, initial, user, onLogout: () => void logout() }}
      />
    );
  return (
    <main className="launch-login">
      <div className="launch-theme">
        <ThemeToggle />
      </div>
      <section className="launch-card">
        <h1>Suprimentos</h1>
        <p>Cadastro e Validades</p>
        {loading ? (
          <p role="status">Carregando…</p>
        ) : (
          <form onSubmit={(event) => void login(event)}>
            <label>
              E-mail
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={pending}
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button className="primary-button" disabled={pending}>
              {pending ? "Entrando…" : "Entrar"}
            </button>
            <small>Acesso somente para usuários autorizados.</small>
          </form>
        )}
      </section>
    </main>
  );
}
