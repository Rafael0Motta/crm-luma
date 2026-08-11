import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, PlayCircle } from "lucide-react";
import { api, getApiErrorMessage } from "../api/client";
import { Automation, AutomationAction, AutomationCondition, AutomationTrigger, Client, FunnelStage, Tag, User } from "../types";
import { PageHeader, Button, Modal, Input, Select, Label, Switch, Textarea, LoadingState, EmptyState, Card } from "../components/ui";

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  new_conversation: "Nova conversa iniciada",
  message_received: "Mensagem recebida",
  funnel_stage_changed: "Cliente entra em etapa do funil",
  tag_applied: "Etiqueta aplicada ao cliente",
};

const ACTION_LABELS: Record<AutomationAction["type"], string> = {
  send_message: "Enviar mensagem",
  apply_tag: "Aplicar etiqueta",
  move_funnel_stage: "Mover etapa do funil",
  assign_user: "Atribuir a um atendente",
  trigger_ai: "Acionar a IA",
  notify_internal: "Notificar equipe interna",
};

function emptyAction(type: AutomationAction["type"]): AutomationAction {
  switch (type) {
    case "send_message":
      return { type, content: "" };
    case "apply_tag":
      return { type, tagId: "" };
    case "move_funnel_stage":
      return { type, funnelStageId: "" };
    case "assign_user":
      return { type, userId: "" };
    case "trigger_ai":
      return { type };
    case "notify_internal":
      return { type, message: "" };
  }
}

export function Automacoes() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Automation | "new" | null>(null);
  const [simulating, setSimulating] = useState<Automation | null>(null);

  const { data: automations, isLoading } = useQuery({
    queryKey: ["automations"],
    queryFn: async () => (await api.get<Automation[]>("/automations")).data,
  });

  const { data: tags } = useQuery({ queryKey: ["tags"], queryFn: async () => (await api.get<Tag[]>("/tags")).data });
  const { data: stages } = useQuery({ queryKey: ["funnel-stages"], queryFn: async () => (await api.get<FunnelStage[]>("/funnel-stages")).data });
  const { data: users } = useQuery({ queryKey: ["users-list"], queryFn: async () => (await api.get<User[]>("/users")).data, retry: false });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => api.patch(`/automations/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/automations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations"] }),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Automation> & { id?: string }) => {
      const { id, ...rest } = payload;
      return id ? api.put(`/automations/${id}`, rest) : api.post("/automations", rest);
    },
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });

  return (
    <div>
      <PageHeader
        title="Automações"
        subtitle="Regras automáticas de resposta e organização"
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} />
            Nova automação
          </Button>
        }
      />

      <div className="p-4 lg:p-8">
        {isLoading ? (
          <LoadingState />
        ) : automations?.length === 0 ? (
          <EmptyState title="Nenhuma automação criada" />
        ) : (
          <div className="space-y-3">
            {automations?.map((automation) => (
              <Card key={automation.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-ink-950">{automation.name}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {TRIGGER_LABELS[automation.trigger]} · {automation.actions.length} ação(ões)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={automation.active} onChange={() => toggleMutation.mutate(automation.id)} />
                  <button onClick={() => setSimulating(automation)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100" title="Testar automação">
                    <PlayCircle size={16} />
                  </button>
                  <button onClick={() => setEditing(automation)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100">
                    <Pencil size={16} />
                  </button>
                  <button onClick={() => deleteMutation.mutate(automation.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <AutomationForm
          automation={editing === "new" ? null : editing}
          tags={tags ?? []}
          stages={stages ?? []}
          users={users ?? []}
          onClose={() => setEditing(null)}
          onSave={(payload) => saveMutation.mutate(payload)}
          saving={saveMutation.isPending}
        />
      )}

      {simulating && <SimulateModal automation={simulating} onClose={() => setSimulating(null)} />}
    </div>
  );
}

function SimulateModal({ automation, onClose }: { automation: Automation; onClose: () => void }) {
  const [clientId, setClientId] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [result, setResult] = useState<{ matched: boolean; reason?: string } | null>(null);

  const { data: clients } = useQuery({ queryKey: ["clients"], queryFn: async () => (await api.get<Client[]>("/clients")).data });

  const simulateMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/automations/${automation.id}/simulate`, {
          clientId,
          trigger: automation.trigger,
          messageContent: messageContent || undefined,
        })
      ).data,
    onSuccess: (data) => setResult(data),
    meta: { skipGlobalErrorToast: true },
  });

  return (
    <Modal open onClose={onClose} title={`Testar: ${automation.name}`}>
      <div className="space-y-4">
        <p className="text-sm text-ink-500">
          Executa a automação de verdade (envia mensagens, aplica tags, etc.) para o cliente selecionado, usando o gatilho{" "}
          <strong>{TRIGGER_LABELS[automation.trigger]}</strong>.
        </p>
        <div>
          <Label>Cliente</Label>
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Selecione um cliente</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        {automation.trigger === "message_received" && (
          <div>
            <Label>Conteúdo da mensagem simulada</Label>
            <Input value={messageContent} onChange={(e) => setMessageContent(e.target.value)} placeholder="Ex: quero saber o preço" />
          </div>
        )}
        {simulateMutation.isError && <p className="text-sm text-red-600">{getApiErrorMessage(simulateMutation.error)}</p>}
        {result && (
          <p className={`text-sm ${result.matched ? "text-emerald-700" : "text-ink-500"}`}>
            {result.matched ? "Automação executada com sucesso." : result.reason ?? "As condições não foram atendidas."}
          </p>
        )}
        <Button className="w-full" disabled={!clientId} loading={simulateMutation.isPending} onClick={() => simulateMutation.mutate()}>
          <PlayCircle size={16} />
          Executar teste
        </Button>
      </div>
    </Modal>
  );
}

function AutomationForm({
  automation,
  tags,
  stages,
  users,
  onClose,
  onSave,
  saving,
}: {
  automation: Automation | null;
  tags: Tag[];
  stages: FunnelStage[];
  users: User[];
  onClose: () => void;
  onSave: (payload: Partial<Automation> & { id?: string }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(automation?.name ?? "");
  const [trigger, setTrigger] = useState<AutomationTrigger>(automation?.trigger ?? "new_conversation");
  const [conditions, setConditions] = useState<AutomationCondition[]>(automation?.conditions ?? []);
  const [actions, setActions] = useState<AutomationAction[]>(automation?.actions ?? [emptyAction("send_message")]);

  function updateCondition(index: number, patch: Partial<AutomationCondition>) {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function updateAction(index: number, next: AutomationAction) {
    setActions((prev) => prev.map((a, i) => (i === index ? next : a)));
  }

  function handleSubmit() {
    onSave({ id: automation?.id, name, trigger, conditions, actions });
  }

  return (
    <Modal open onClose={onClose} title={automation ? "Editar automação" : "Nova automação"} wide>
      <div className="space-y-5">
        <div>
          <Label>Nome</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        <div>
          <Label>Gatilho</Label>
          <Select value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}>
            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Condições (opcional — todas precisam ser verdadeiras)</Label>
            <button
              type="button"
              onClick={() => setConditions((prev) => [...prev, { field: "message.content", operator: "contains", value: "" }])}
              className="text-xs font-medium text-ink-700 hover:underline"
            >
              + adicionar condição
            </button>
          </div>
          <div className="space-y-2">
            {conditions.map((cond, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={cond.field} onChange={(e) => updateCondition(i, { field: e.target.value as AutomationCondition["field"] })}>
                  <option value="message.content">Conteúdo da mensagem</option>
                  <option value="client.name">Nome do cliente</option>
                  <option value="client.phone">Telefone do cliente</option>
                  <option value="client.funnelStageId">Etapa do funil (ID)</option>
                </Select>
                <Select value={cond.operator} onChange={(e) => updateCondition(i, { operator: e.target.value as AutomationCondition["operator"] })} className="!w-40">
                  <option value="contains">contém</option>
                  <option value="not_contains">não contém</option>
                  <option value="equals">igual a</option>
                  <option value="not_equals">diferente de</option>
                </Select>
                <Input value={cond.value} onChange={(e) => updateCondition(i, { value: e.target.value })} placeholder="valor" />
                <button type="button" onClick={() => setConditions((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {conditions.length === 0 && <p className="text-xs text-ink-400">Sem condições — a automação sempre dispara neste gatilho.</p>}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Ações</Label>
            <button
              type="button"
              onClick={() => setActions((prev) => [...prev, emptyAction("send_message")])}
              className="text-xs font-medium text-ink-700 hover:underline"
            >
              + adicionar ação
            </button>
          </div>
          <div className="space-y-2">
            {actions.map((action, i) => (
              <div key={i} className="rounded-lg border border-ink-100 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <Select
                    value={action.type}
                    onChange={(e) => updateAction(i, emptyAction(e.target.value as AutomationAction["type"]))}
                    className="!w-56"
                  >
                    {Object.entries(ACTION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <button type="button" onClick={() => setActions((prev) => prev.filter((_, idx) => idx !== i))} className="text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>

                {action.type === "send_message" && (
                  <Textarea
                    rows={3}
                    value={action.content}
                    onChange={(e) => updateAction(i, { ...action, content: e.target.value })}
                    placeholder="Mensagem a enviar"
                  />
                )}
                {action.type === "apply_tag" && (
                  <Select value={action.tagId} onChange={(e) => updateAction(i, { ...action, tagId: e.target.value })}>
                    <option value="">Selecione a etiqueta</option>
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                )}
                {action.type === "move_funnel_stage" && (
                  <Select value={action.funnelStageId} onChange={(e) => updateAction(i, { ...action, funnelStageId: e.target.value })}>
                    <option value="">Selecione a etapa</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
                {action.type === "assign_user" && (
                  <Select value={action.userId} onChange={(e) => updateAction(i, { ...action, userId: e.target.value })}>
                    <option value="">Selecione o atendente</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                )}
                {action.type === "notify_internal" && (
                  <Input
                    value={action.message}
                    onChange={(e) => updateAction(i, { ...action, message: e.target.value })}
                    placeholder="Mensagem interna (log)"
                  />
                )}
                {action.type === "trigger_ai" && <p className="text-xs text-ink-500">A IA configurada irá gerar e enviar a resposta.</p>}
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSubmit} loading={saving} className="w-full" disabled={!name.trim() || actions.length === 0}>
          Salvar automação
        </Button>
      </div>
    </Modal>
  );
}
