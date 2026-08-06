import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Send, History } from "lucide-react";
import { api, getApiErrorMessage } from "../api/client";
import { BillingReminder, Client, Policy } from "../types";
import { PageHeader, Button, Modal, Input, Select, Label, Textarea, Switch, LoadingState, EmptyState, Card } from "../components/ui";

export function Cobranca() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<"policy" | "client">("policy");
  const [error, setError] = useState<string | null>(null);

  const { data: reminders, isLoading } = useQuery({
    queryKey: ["billing-reminders"],
    queryFn: async () => (await api.get<BillingReminder[]>("/billing-reminders")).data,
  });

  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: async () => (await api.get<Client[]>("/clients")).data });

  const { data: allPolicies } = useQuery({
    queryKey: ["all-policies", clients?.map((c) => c.id)],
    queryFn: async () => {
      if (!clients) return [] as (Policy & { clientName: string })[];
      const results = await Promise.all(
        clients.map(async (c) => {
          const res = await api.get<Policy[]>(`/clients/${c.id}/policies`);
          return res.data.map((p) => ({ ...p, clientName: c.name }));
        })
      );
      return results.flat();
    },
    enabled: Boolean(clients),
  });

  const { data: history } = useQuery({
    queryKey: ["billing-history", historyId],
    queryFn: async () => (await api.get(`/billing-reminders/${historyId}/history`)).data,
    enabled: Boolean(historyId),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post("/billing-reminders", payload),
    onSuccess: () => {
      setCreateOpen(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["billing-reminders"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
    meta: { skipGlobalErrorToast: true },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/billing-reminders/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing-reminders"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/billing-reminders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing-reminders"] }),
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/billing-reminders/${id}/send-test`),
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      name: form.get("name"),
      daysOffset: Number(form.get("daysOffset")),
      messageTemplate: form.get("messageTemplate"),
    };
    if (linkType === "policy") {
      payload.policyId = form.get("policyId");
    } else {
      payload.clientId = form.get("clientId");
      payload.dueDay = Number(form.get("dueDay"));
    }
    createMutation.mutate(payload);
  }

  return (
    <div>
      <PageHeader
        title="Cobrança e lembretes"
        subtitle="Lembretes automáticos de vencimento de apólices"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Novo lembrete
          </Button>
        }
      />

      <div className="p-8">
        {isLoading ? (
          <LoadingState />
        ) : reminders?.length === 0 ? (
          <EmptyState title="Nenhum lembrete configurado" />
        ) : (
          <div className="space-y-3">
            {reminders?.map((reminder) => (
              <Card key={reminder.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-ink-950">{reminder.name}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {reminder.policy ? `Apólice ${reminder.policy.policyNumber} · ${reminder.policy.client.name}` : reminder.client?.name}
                    {" · "}
                    {reminder.daysOffset <= 0 ? `${Math.abs(reminder.daysOffset)} dia(s) antes do vencimento` : `${reminder.daysOffset} dia(s) depois`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setHistoryId(reminder.id)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100" title="Histórico">
                    <History size={16} />
                  </button>
                  <button
                    onClick={() => testMutation.mutate(reminder.id)}
                    className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
                    title="Enviar teste agora"
                  >
                    <Send size={16} />
                  </button>
                  <Switch checked={reminder.active} onChange={() => toggleMutation.mutate(reminder.id)} />
                  <button onClick={() => deleteMutation.mutate(reminder.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo lembrete de cobrança">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Nome interno</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>Vincular a</Label>
            <Select value={linkType} onChange={(e) => setLinkType(e.target.value as "policy" | "client")}>
              <option value="policy">Apólice específica</option>
              <option value="client">Cliente (sem vencimento automático)</option>
            </Select>
          </div>
          {linkType === "policy" ? (
            <Select name="policyId" required>
              <option value="">Selecione a apólice</option>
              {allPolicies?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.clientName} · {p.insurer} · {p.policyNumber}
                </option>
              ))}
            </Select>
          ) : (
            <Select name="clientId" required>
              <option value="">Selecione o cliente</option>
              {clients?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
          {linkType === "client" && (
            <div>
              <Label>Dia do mês do vencimento</Label>
              <Input name="dueDay" type="number" min={1} max={31} required />
            </div>
          )}
          <div>
            <Label>Dias em relação ao vencimento (negativo = antes, positivo = depois)</Label>
            <Input name="daysOffset" type="number" defaultValue={-3} required />
          </div>
          <div>
            <Label>Mensagem (use {"{{nome}}"}, {"{{apolice}}"}, {"{{valor}}"}, {"{{dia_vencimento}}"})</Label>
            <Textarea name="messageTemplate" rows={4} required />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={createMutation.isPending}>
            Salvar lembrete
          </Button>
        </form>
      </Modal>

      <Modal open={Boolean(historyId)} onClose={() => setHistoryId(null)} title="Histórico de envios">
        <div className="space-y-2">
          {history?.length === 0 && <p className="text-sm text-ink-400">Nenhum envio registrado ainda.</p>}
          {history?.map((log: { id: string; status: string; sentAt: string; errorMessage: string | null }) => (
            <div key={log.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-sm">
              <span className={log.status === "SENT" ? "text-ink-800" : "text-red-600"}>
                {log.status === "SENT" ? "Enviado" : `Falhou: ${log.errorMessage ?? ""}`}
              </span>
              <span className="text-xs text-ink-400">{new Date(log.sentAt).toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
