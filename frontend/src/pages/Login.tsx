import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-ink-950 p-12 text-ink-50 lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gold-500 text-ink-950">
            <Sparkles size={20} strokeWidth={2.5} />
          </div>
          <span className="text-lg font-semibold tracking-wide">Luma Benefícios</span>
        </div>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-white">
            Clareza no atendimento. Solidez na gestão dos seus segurados.
          </h2>
          <p className="mt-4 max-w-md text-sm text-ink-300">
            Centralize conversas de WhatsApp, funil de vendas, automações e cobranças em um único lugar.
          </p>
        </div>
        <p className="text-xs text-ink-400">© {new Date().getFullYear()} Luma Benefícios</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-ink-50 p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500 text-ink-950">
              <Sparkles size={18} strokeWidth={2.5} />
            </div>
            <span className="text-base font-semibold text-ink-950">Luma Benefícios</span>
          </div>

          <h1 className="text-2xl font-semibold text-ink-950">Entrar</h1>
          <p className="mt-1 text-sm text-ink-500">Acesse o CRM com suas credenciais.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-500">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-100"
                placeholder="voce@lumabeneficios.com.br"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-500">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm focus:border-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-100"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-700 disabled:bg-ink-300"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
