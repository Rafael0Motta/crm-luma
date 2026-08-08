import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Trash2 } from "lucide-react";
import { api, getApiErrorMessage } from "../api/client";
import { Client, FunnelStage, ScheduledMessage, Tag } from "../types";
import { PageHeader, Button, Modal, Input, Select, Label, Textarea, Badge, LoadingState, EmptyState, Card, SearchableSelect } from "../components/ui";

const STATUS_LABELS: Record<ScheduledMessage["status"], { label: string; color: string }> = {
  PENDING: { label: "Pendente", color: "#A8822E" },
  SENDING: { label: "Enviando", color: "#226B63" },
  SENT: { label: "Enviada", color: "#1B7A4C" },
  FAILED: { label: "Falhou", color: "#8A2B2B" },
  PARTIAL: { label: "Parcial", color: "#A8822E" },
};

const TARGET_LABELS: Record<ScheduledMessage["targetType"], string> = {
  SINGLE: "Cliente único",
  TAG: "Etiqueta",
  FUNNEL_STAGE: "Etapa do funil",
  ALL: "Todos os clientes",
};

export function MensagensAgendadas() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [targetType, setTargetType] = useState<ScheduledMessage["targetType"]>("TAG");
  const [singleClientId, setSingleClientId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["scheduled-messages"],
    queryFn: async () => (await api.get<ScheduledMessage[]>("/scheduled-messages")).data,
  });

  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: async () => (await api.get<Client[]>("/clients")).data });
  const { data: tags } = useQuery({ queryKey: ["tags"], queryFn: async () => (await api.get<Tag[]>("/tags")).data });
  const { data: stages } = useQuery({ queryKey: ["funnel-stages"], queryFn: async () => (await api.get<FunnelStage[]>("/funnel-stages")).data });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post("/scheduled-messages", payload),
    onSuccess: () => {
      setCreateOpen(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
    meta: { skipGlobalErrorToast: true },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/scheduled-messages/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] }),
  });

  const sendNowMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/scheduled-messages/${id}/send-now`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] }),
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    let targetConfig: Record<string, string> = {};
    if (targetType === "SINGLE") targetConfig = { clientId: String(form.get("clientId")) };
    if (targetType === "TAG") targetConfig = { tagId: String(form.get("tagId")) };
    if (targetType === "FUNNEL_STAGE") targetConfig = { funnelStageId: String(form.get("funnelStageId")) };

    createMutation.mutate({
      name: form.get("name"),
      content: form.get("content"),
      scheduledFor: new Date(String(form.get("scheduledFor"))).toISOString(),
      targetType,
      targetConfig,
    });
  }

  return (
    <div>
      <PageHeader
        title="Mensagens agendadas"
        subtitle="Envios avulsos ou em massa por segmento, etiqueta ou etapa do funil"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Nova mensagem
          </Button>
        }
      />

      <div className="p-8">
        {isLoading ? (
          <LoadingState />
        ) : messages?.length === 0 ? (
          <EmptyState title="Nenhuma mensagem agendada" />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-5 py-3">Destinatários</th>
                  <th className="px-5 py-3">Agendada para</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {messages?.map((msg) => (
                  <tr key={msg.id} className="border-b border-ink-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-ink-950">{msg.name}</td>
                    <td className="px-5 py-3 text-ink-600">
                      {TARGET_LABELS[msg.targetType]} · {msg._count?.recipients ?? 0} destinatário(s)
                    </td>
                    <td className="px-5 py-3 text-ink-600">{new Date(msg.scheduledFor).toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3">
                      <Badge color={STATUS_LABELS[msg.status].color}>{STATUS_LABELS[msg.status].label}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {msg.status === "PENDING" && (
                          <>
                            <button
                              onClick={() => sendNowMutation.mutate(msg.id)}
                              className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
                              title="Enviar agora"
                            >
                              <Send size={16} />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(msg.id)}
                              className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova mensagem agendada" wide>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Nome interno</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea name="content" rows={4} required />
          </div>
          <div>
            <Label>Enviar para</Label>
            <Select value={targetType} onChange={(e) => setTargetType(e.target.value as ScheduledMessage["targetType"])}>
              <option value="SINGLE">Cliente único</option>
              <option value="TAG">Clientes com etiqueta</option>
              <option value="FUNNEL_STAGE">Clientes em etapa do funil</option>
              <option value="ALL">Todos os clientes</option>
            </Select>
          </div>

          {targetType === "SINGLE" && (
            <SearchableSelect
              name="clientId"
              value={singleClientId}
              onChange={setSingleClientId}
              options={(clients ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.phone}` }))}
              placeholder="Buscar cliente por nome ou telefone..."
            />
          )}
          {targetType === "TAG" && (
            <Select name="tagId" required>
              <option value="">Selecione a etiqueta</option>
              {tags?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
          {targetType === "FUNNEL_STAGE" && (
            <Select name="funnelStageId" required>
              <option value="">Selecione a etapa</option>
              {stages?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}

          <div>
            <Label>Data e hora do envio</Label>
            <Input name="scheduledFor" type="datetime-local" required />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={createMutation.isPending}>
            Agendar
          </Button>
        </form>
      </Modal>
    </div>
  );
}
