import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QrCode, RefreshCw, Plus, Trash2, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { api, getApiErrorMessage } from "../api/client";
import { AISettings } from "../types";
import { PageHeader, Button, Modal, Input, Select, Label, Textarea, Card, Switch, LoadingState } from "../components/ui";

export function Configuracoes() {
  const [tab, setTab] = useState<"evolution" | "ai">("evolution");

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Integração com WhatsApp e Inteligência Artificial" />
      <div className="border-b border-ink-100 bg-white px-8">
        <div className="flex gap-6">
          {[
            { key: "evolution", label: "WhatsApp (Evolution API)" },
            { key: "ai", label: "Inteligência Artificial" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as "evolution" | "ai")}
              className={`border-b-2 py-3 text-sm font-medium ${
                tab === t.key ? "border-ink-800 text-ink-950" : "border-transparent text-ink-400 hover:text-ink-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-8">{tab === "evolution" ? <EvolutionTab /> : <AITab />}</div>
    </div>
  );
}

function EvolutionTab() {
  const { data: status, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["evolution-status"],
    queryFn: async () => (await api.get("/settings/evolution/status")).data,
  });

  const { data: qr, refetch: refetchQr, isFetching: loadingQr } = useQuery({
    queryKey: ["evolution-qr"],
    queryFn: async () => (await api.get("/settings/evolution/qrcode")).data,
    enabled: false,
  });

  if (isLoading) return <LoadingState />;

  const connected = status?.state === "open" || status?.state === "connected";

  return (
    <Card className="max-w-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-500">Instância</p>
          <p className="font-medium text-ink-950">{status?.instanceName || "não configurada"}</p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-700">
              <CheckCircle2 size={14} className="text-emerald-600" />
              Conectado
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
              <XCircle size={14} />
              {status?.state ?? "Desconectado"}
            </span>
          )}
          <button onClick={() => refetch()} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100" title="Atualizar status">
            <RefreshCw size={16} className={isRefetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {!connected && (
        <div className="mt-5 border-t border-ink-100 pt-5">
          <Button variant="secondary" onClick={() => refetchQr()} loading={loadingQr}>
            <QrCode size={16} />
            Gerar QR Code de conexão
          </Button>
          {qr?.base64 && (
            <div className="mt-4 flex justify-center rounded-lg border border-ink-100 p-4">
              <img src={qr.base64} alt="QR Code Evolution API" className="h-56 w-56" />
            </div>
          )}
        </div>
      )}

      <p className="mt-5 text-xs text-ink-400">
        As credenciais da Evolution API (URL, chave e nome da instância) são definidas nas variáveis de ambiente do backend
        (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME).
      </p>
    </Card>
  );
}

function AITab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AISettings | null>(null);
  const [provider, setProvider] = useState<AISettings["provider"]>("OPENAI");
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data: settingsList, isLoading } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: async () => (await api.get<AISettings[]>("/ai-settings")).data,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post("/ai-settings", payload),
    onSuccess: () => {
      setCreateOpen(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
    meta: { skipGlobalErrorToast: true },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => api.put(`/ai-settings/${id}`, payload),
    onSuccess: () => {
      setEditing(null);
      setEditError(null);
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
    },
    onError: (err) => setEditError(getApiErrorMessage(err)),
    meta: { skipGlobalErrorToast: true },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => api.put(`/ai-settings/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-settings"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/ai-settings/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ai-settings"] }),
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      provider,
      apiKey: form.get("apiKey"),
      model: form.get("model"),
      baseUrl: provider === "CUSTOM" ? form.get("baseUrl") : undefined,
      systemPrompt: form.get("systemPrompt"),
      temperature: Number(form.get("temperature")),
      maxTokens: Number(form.get("maxTokens")),
    });
  }

  function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const form = new FormData(e.currentTarget);
    const apiKey = form.get("apiKey");
    updateMutation.mutate({
      id: editing.id,
      payload: {
        model: form.get("model"),
        baseUrl: editing.provider === "CUSTOM" ? form.get("baseUrl") : undefined,
        systemPrompt: form.get("systemPrompt"),
        temperature: Number(form.get("temperature")),
        maxTokens: Number(form.get("maxTokens")),
        ...(apiKey ? { apiKey } : {}),
      },
    });
  }

  if (isLoading) return <LoadingState />;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Nova configuração de IA
        </Button>
      </div>

      <div className="space-y-3">
        {settingsList?.length === 0 && <p className="text-sm text-ink-400">Nenhuma configuração de IA cadastrada.</p>}
        {settingsList?.map((s) => (
          <Card key={s.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-ink-950">
                {s.provider} · {s.model}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">Chave: {s.apiKeyMasked}</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={s.active} onChange={() => toggleMutation.mutate({ id: s.id, active: !s.active })} />
              <button onClick={() => setEditing(s)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100">
                <Pencil size={16} />
              </button>
              <button onClick={() => deleteMutation.mutate(s.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova configuração de IA">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Provedor</Label>
            <Select value={provider} onChange={(e) => setProvider(e.target.value as AISettings["provider"])}>
              <option value="OPENAI">OpenAI</option>
              <option value="ANTHROPIC">Anthropic (Claude)</option>
              <option value="CUSTOM">Outro (compatível com API REST tipo OpenAI)</option>
            </Select>
          </div>
          {provider === "CUSTOM" && (
            <div>
              <Label>URL base da API</Label>
              <Input name="baseUrl" placeholder="https://minha-api.com/v1" required />
            </div>
          )}
          <div>
            <Label>Modelo</Label>
            <Input name="model" placeholder={provider === "ANTHROPIC" ? "claude-sonnet-5" : "gpt-4o-mini"} required />
          </div>
          <div>
            <Label>Chave de API</Label>
            <Input name="apiKey" type="password" required />
          </div>
          <div>
            <Label>Prompt de sistema / persona</Label>
            <Textarea name="systemPrompt" rows={4} required placeholder="Você é a assistente virtual da Luma Benefícios..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Temperatura</Label>
              <Input name="temperature" type="number" step="0.1" min={0} max={2} defaultValue={0.7} />
            </div>
            <div>
              <Label>Máx. tokens</Label>
              <Input name="maxTokens" type="number" min={1} defaultValue={1024} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={createMutation.isPending}>
            Salvar configuração
          </Button>
        </form>
      </Modal>

      {editing && (
        <Modal open onClose={() => setEditing(null)} title={`Editar configuração · ${editing.provider}`}>
          <form onSubmit={handleUpdate} className="space-y-4">
            {editing.provider === "CUSTOM" && (
              <div>
                <Label>URL base da API</Label>
                <Input name="baseUrl" defaultValue={editing.baseUrl ?? ""} placeholder="https://minha-api.com/v1" required />
              </div>
            )}
            <div>
              <Label>Modelo</Label>
              <Input name="model" defaultValue={editing.model} required />
            </div>
            <div>
              <Label>Nova chave de API (opcional)</Label>
              <Input name="apiKey" type="password" placeholder={`Atual: ${editing.apiKeyMasked}`} />
            </div>
            <div>
              <Label>Prompt de sistema / persona</Label>
              <Textarea name="systemPrompt" rows={4} defaultValue={editing.systemPrompt} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Temperatura</Label>
                <Input name="temperature" type="number" step="0.1" min={0} max={2} defaultValue={editing.temperature} />
              </div>
              <div>
                <Label>Máx. tokens</Label>
                <Input name="maxTokens" type="number" min={1} defaultValue={editing.maxTokens} />
              </div>
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            <Button type="submit" className="w-full" loading={updateMutation.isPending}>
              Salvar alterações
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
