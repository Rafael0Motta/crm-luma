import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QrCode, RefreshCw, Plus, Trash2, CheckCircle2, XCircle, Pencil } from "lucide-react";
import { api, getApiErrorMessage } from "../api/client";
import { AISettings, WhatsAppInstance } from "../types";
import { PageHeader, Button, Modal, Input, Select, Label, Textarea, Card, Switch, LoadingState, Badge } from "../components/ui";

const INSTANCE_PURPOSE_LABELS: Record<WhatsAppInstance["purpose"], string> = {
  ATENDIMENTO: "Atendimento",
  FOLLOWUP: "Follow-ups",
  COBRANCA: "Cobrança",
};

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
      <div className="p-4 lg:p-8">{tab === "evolution" ? <EvolutionTab /> : <AITab />}</div>
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
    <>
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
        (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME). Essa é a instância padrão, usada quando nenhuma
        instância específica está configurada abaixo para um módulo.
      </p>
    </Card>
    <WhatsAppInstancesSection />
    </>
  );
}

function WhatsAppInstancesSection() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsAppInstance | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null);

  const { data: instances, isLoading } = useQuery({
    queryKey: ["whatsapp-instances"],
    queryFn: async () => (await api.get<WhatsAppInstance[]>("/settings/whatsapp-instances")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown> & { id?: string }) => {
      const { id, ...rest } = payload;
      return id ? api.put(`/settings/whatsapp-instances/${id}`, rest) : api.post("/settings/whatsapp-instances", rest);
    },
    onSuccess: () => {
      setFormOpen(false);
      setEditing(null);
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
    },
    onError: (err) => setFormError(getApiErrorMessage(err)),
    meta: { skipGlobalErrorToast: true },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/settings/whatsapp-instances/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/settings/whatsapp-instances/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] }),
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const apiKey = form.get("apiKey");
    saveMutation.mutate({
      id: editing?.id,
      label: form.get("label"),
      instanceName: form.get("instanceName"),
      apiUrl: form.get("apiUrl") || undefined,
      purpose: form.get("purpose"),
      ...(apiKey ? { apiKey } : {}),
    });
  }

  return (
    <Card className="mt-6 max-w-xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-ink-950">Instâncias por módulo</p>
          <p className="mt-0.5 text-xs text-ink-500">Defina números diferentes para atendimento, follow-ups e cobrança</p>
        </div>
        <Button variant="secondary" onClick={() => setFormOpen(true)}>
          <Plus size={14} />
          Nova instância
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : instances?.length === 0 ? (
        <p className="mt-4 text-sm text-ink-400">Nenhuma instância cadastrada — todos os módulos usam a instância padrão acima.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {instances?.map((instance) => (
            <div key={instance.id} className="rounded-lg border border-ink-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-950">{instance.label}</p>
                  <p className="truncate text-xs text-ink-500">{instance.instanceName}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Badge>{INSTANCE_PURPOSE_LABELS[instance.purpose]}</Badge>
                  <Switch checked={instance.active} onChange={() => toggleMutation.mutate(instance.id)} />
                  <button
                    onClick={() => setQrInstanceId(instance.id)}
                    className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
                    title="Ver status / QR Code"
                  >
                    <QrCode size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setEditing(instance);
                      setFormOpen(true);
                    }}
                    className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(instance.id)}
                    className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setFormError(null);
        }}
        title={editing ? "Editar instância" : "Nova instância"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome (para identificação interna)</Label>
            <Input name="label" defaultValue={editing?.label ?? ""} placeholder="Ex: Número de cobrança" required />
          </div>
          <div>
            <Label>Nome da instância na Evolution API</Label>
            <Input name="instanceName" defaultValue={editing?.instanceName ?? ""} required />
          </div>
          <div>
            <Label>Módulo responsável</Label>
            <Select name="purpose" defaultValue={editing?.purpose ?? "ATENDIMENTO"}>
              {Object.entries(INSTANCE_PURPOSE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>URL da API (opcional — em branco usa a URL padrão)</Label>
            <Input name="apiUrl" defaultValue={editing?.apiUrl ?? ""} placeholder="https://minha-evolution-api.com" />
          </div>
          <div>
            <Label>{editing ? "Nova chave de API (opcional)" : "Chave de API (opcional — em branco usa a chave padrão)"}</Label>
            <Input name="apiKey" type="password" placeholder={editing?.apiKeyMasked ? `Atual: ${editing.apiKeyMasked}` : undefined} />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button type="submit" className="w-full" loading={saveMutation.isPending}>
            Salvar instância
          </Button>
        </form>
      </Modal>

      {qrInstanceId && <InstanceStatusModal instanceId={qrInstanceId} onClose={() => setQrInstanceId(null)} />}
    </Card>
  );
}

function InstanceStatusModal({ instanceId, onClose }: { instanceId: string; onClose: () => void }) {
  const { data: status, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["whatsapp-instance-status", instanceId],
    queryFn: async () => (await api.get(`/settings/whatsapp-instances/${instanceId}/status`)).data,
  });

  const { data: qr, refetch: refetchQr, isFetching: loadingQr } = useQuery({
    queryKey: ["whatsapp-instance-qr", instanceId],
    queryFn: async () => (await api.get(`/settings/whatsapp-instances/${instanceId}/qrcode`)).data,
    enabled: false,
  });

  const connected = status?.state === "open" || status?.state === "connected";

  return (
    <Modal open onClose={onClose} title="Status da instância">
      {isLoading ? (
        <LoadingState />
      ) : (
        <div>
          <div className="flex items-center justify-between">
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
        </div>
      )}
    </Modal>
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
