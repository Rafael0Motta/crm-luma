import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, History } from "lucide-react";
import { api } from "../api/client";
import { FollowUp, FollowUpRun, FollowUpStep, FollowUpTriggerConfig, FunnelStage, Tag } from "../types";
import { PageHeader, Button, Modal, Input, Select, Label, Switch, LoadingState, EmptyState, Card, Badge } from "../components/ui";

const TRIGGER_TYPE_LABELS: Record<FollowUpTriggerConfig["type"], string> = {
  NO_RESPONSE: "Sem resposta do cliente",
  STUCK_IN_STAGE: "Parado numa etapa do funil",
  AFTER_TAG: "Após receber uma etiqueta",
};

const RUN_STATUS_LABELS: Record<FollowUpRun["status"], { label: string; color: string }> = {
  RUNNING: { label: "Em andamento", color: "#226B63" },
  COMPLETED: { label: "Concluído", color: "#1B7A4C" },
  STOPPED: { label: "Interrompido", color: "#A8822E" },
  FAILED: { label: "Falhou", color: "#8A2B2B" },
};

function defaultTriggerConfig(type: FollowUpTriggerConfig["type"], stages: FunnelStage[], tags: Tag[]): FollowUpTriggerConfig {
  if (type === "NO_RESPONSE") return { type, hours: 24 };
  if (type === "STUCK_IN_STAGE") return { type, funnelStageId: stages[0]?.id ?? "", days: 3 };
  return { type, tagId: tags[0]?.id ?? "" };
}

export function FollowUps() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<FollowUp | "new" | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const { data: followUps, isLoading } = useQuery({
    queryKey: ["followups"],
    queryFn: async () => (await api.get<FollowUp[]>("/followups")).data,
  });
  const { data: stages } = useQuery({ queryKey: ["funnel-stages"], queryFn: async () => (await api.get<FunnelStage[]>("/funnel-stages")).data });
  const { data: tags } = useQuery({ queryKey: ["tags"], queryFn: async () => (await api.get<Tag[]>("/tags")).data });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/followups/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["followups"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/followups/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["followups"] }),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<FollowUp> & { id?: string }) => {
      const { id, ...rest } = payload;
      return id ? api.put(`/followups/${id}`, rest) : api.post("/followups", rest);
    },
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["followups"] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        subtitle="Sequências automáticas de mensagens para reengajar clientes"
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} />
            Novo follow-up
          </Button>
        }
      />

      <div className="p-8">
        {isLoading ? (
          <LoadingState />
        ) : followUps?.length === 0 ? (
          <EmptyState title="Nenhum follow-up criado" />
        ) : (
          <div className="space-y-3">
            {followUps?.map((fu) => (
              <Card key={fu.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-ink-950">{fu.name}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {TRIGGER_TYPE_LABELS[fu.triggerType]} · {fu.steps.length} passo(s) · {fu._count?.runs ?? 0} execuções
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={fu.active} onChange={() => toggleMutation.mutate(fu.id)} />
                  <button onClick={() => setHistoryId(fu.id)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100" title="Histórico de execuções">
                    <History size={16} />
                  </button>
                  <button onClick={() => setEditing(fu)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteMutation.mutate(fu.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <FollowUpForm
          followUp={editing === "new" ? null : editing}
          stages={stages ?? []}
          tags={tags ?? []}
          onClose={() => setEditing(null)}
          onSave={(payload) => saveMutation.mutate(payload)}
          saving={saveMutation.isPending}
        />
      )}

      {historyId && <FollowUpRunsModal followUpId={historyId} onClose={() => setHistoryId(null)} />}
    </div>
  );
}

function FollowUpRunsModal({ followUpId, onClose }: { followUpId: string; onClose: () => void }) {
  const { data: runs, isLoading } = useQuery({
    queryKey: ["followup-runs", followUpId],
    queryFn: async () => (await api.get<FollowUpRun[]>(`/followups/${followUpId}/runs`)).data,
  });

  return (
    <Modal open onClose={onClose} title="Histórico de execuções" wide>
      {isLoading ? (
        <LoadingState />
      ) : runs?.length === 0 ? (
        <EmptyState title="Nenhuma execução registrada ainda" />
      ) : (
        <div className="space-y-2">
          {runs?.map((run) => (
            <div key={run.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-ink-900">{run.client.name}</p>
                <p className="text-xs text-ink-500">
                  {run.client.phone} · passo {run.currentStep}
                  {run.nextRunAt && run.status === "RUNNING" ? ` · próximo envio ${new Date(run.nextRunAt).toLocaleString("pt-BR")}` : ""}
                </p>
              </div>
              <Badge color={RUN_STATUS_LABELS[run.status].color}>{RUN_STATUS_LABELS[run.status].label}</Badge>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function FollowUpForm({
  followUp,
  stages,
  tags,
  onClose,
  onSave,
  saving,
}: {
  followUp: FollowUp | null;
  stages: FunnelStage[];
  tags: Tag[];
  onClose: () => void;
  onSave: (payload: Partial<FollowUp> & { id?: string }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(followUp?.name ?? "");
  const [triggerType, setTriggerType] = useState<FollowUpTriggerConfig["type"]>(followUp?.triggerType ?? "NO_RESPONSE");
  const [triggerConfig, setTriggerConfig] = useState<FollowUpTriggerConfig>(
    followUp?.triggerConfig ?? defaultTriggerConfig("NO_RESPONSE", stages, tags)
  );
  const [steps, setSteps] = useState<FollowUpStep[]>(followUp?.steps ?? [{ message: "", delayMinutes: 0 }]);
  const [stopOnReply, setStopOnReply] = useState(followUp?.stopCondition?.onReply ?? true);

  function handleTriggerTypeChange(type: FollowUpTriggerConfig["type"]) {
    setTriggerType(type);
    setTriggerConfig(defaultTriggerConfig(type, stages, tags));
  }

  function updateStep(index: number, patch: Partial<FollowUpStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function handleSubmit() {
    onSave({ id: followUp?.id, name, triggerType, triggerConfig, steps, stopCondition: { onReply: stopOnReply } });
  }

  return (
    <Modal open onClose={onClose} title={followUp ? "Editar follow-up" : "Novo follow-up"} wide>
      <div className="space-y-5">
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div>
          <Label>Gatilho</Label>
          <Select value={triggerType} onChange={(e) => handleTriggerTypeChange(e.target.value as FollowUpTriggerConfig["type"])}>
            {Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {triggerConfig.type === "NO_RESPONSE" && (
          <div>
            <Label>Horas sem resposta do cliente</Label>
            <Input
              type="number"
              min={1}
              value={triggerConfig.hours}
              onChange={(e) => setTriggerConfig({ type: "NO_RESPONSE", hours: Number(e.target.value) })}
            />
          </div>
        )}

        {triggerConfig.type === "STUCK_IN_STAGE" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Etapa do funil</Label>
              <Select
                value={triggerConfig.funnelStageId}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, funnelStageId: e.target.value })}
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Dias parado na etapa</Label>
              <Input
                type="number"
                min={1}
                value={triggerConfig.days}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, days: Number(e.target.value) })}
              />
            </div>
          </div>
        )}

        {triggerConfig.type === "AFTER_TAG" && (
          <div>
            <Label>Etiqueta</Label>
            <Select value={triggerConfig.tagId} onChange={(e) => setTriggerConfig({ type: "AFTER_TAG", tagId: e.target.value })}>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Sequência de mensagens</Label>
            <button
              type="button"
              onClick={() => setSteps((prev) => [...prev, { message: "", delayMinutes: 60 }])}
              className="text-xs font-medium text-ink-700 hover:underline"
            >
              + adicionar passo
            </button>
          </div>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="rounded-lg border border-ink-100 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink-500">Passo {i + 1}</span>
                  <button type="button" onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-600">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="space-y-2">
                  <Input
                    value={step.message}
                    onChange={(e) => updateStep(i, { message: e.target.value })}
                    placeholder="Mensagem"
                  />
                  <div className="flex items-center gap-2 text-xs text-ink-500">
                    <span>Aguardar</span>
                    <Input
                      type="number"
                      min={0}
                      value={step.delayMinutes}
                      onChange={(e) => updateStep(i, { delayMinutes: Number(e.target.value) })}
                      className="!w-24"
                    />
                    <span>minutos antes de enviar</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2.5">
          <span className="text-sm text-ink-700">Parar sequência se o cliente responder</span>
          <Switch checked={stopOnReply} onChange={() => setStopOnReply((v) => !v)} />
        </div>

        <Button onClick={handleSubmit} loading={saving} className="w-full" disabled={!name.trim() || steps.length === 0}>
          Salvar follow-up
        </Button>
      </div>
    </Modal>
  );
}
