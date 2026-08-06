import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, GripVertical, Settings2 } from "lucide-react";
import { api } from "../api/client";
import { Client, FunnelStage } from "../types";
import { PageHeader, Button, Modal, Input, Badge, LoadingState, EmptyState } from "../components/ui";

export function Funil() {
  const queryClient = useQueryClient();
  const [manageOpen, setManageOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [draggingClientId, setDraggingClientId] = useState<string | null>(null);

  const { data: stages, isLoading: loadingStages } = useQuery({
    queryKey: ["funnel-stages"],
    queryFn: async () => (await api.get<FunnelStage[]>("/funnel-stages")).data,
  });

  const { data: clients, isLoading: loadingClients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await api.get<Client[]>("/clients")).data,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ clientId, funnelStageId }: { clientId: string; funnelStageId: string }) =>
      api.put(`/clients/${clientId}/funnel-stage`, { funnelStageId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clients"] }),
  });

  const createStageMutation = useMutation({
    mutationFn: async (name: string) => api.post("/funnel-stages", { name }),
    onSuccess: () => {
      setNewStageName("");
      queryClient.invalidateQueries({ queryKey: ["funnel-stages"] });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/funnel-stages/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["funnel-stages"] }),
  });

  if (loadingStages || loadingClients) return <LoadingState />;

  const orderedStages = [...(stages ?? [])].sort((a, b) => a.order - b.order);

  function clientsForStage(stageId: string) {
    return (clients ?? []).filter((c) => c.funnelStageId === stageId);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Funil de vendas"
        subtitle="Arraste os cards para mover clientes entre etapas"
        action={
          <Button variant="secondary" onClick={() => setManageOpen(true)}>
            <Settings2 size={16} />
            Gerenciar etapas
          </Button>
        }
      />

      <div className="flex-1 overflow-x-auto p-6">
        {orderedStages.length === 0 ? (
          <EmptyState title="Nenhuma etapa configurada" subtitle="Crie a primeira etapa do funil em 'Gerenciar etapas'." />
        ) : (
          <div className="flex h-full gap-4">
            {orderedStages.map((stage) => (
              <div
                key={stage.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggingClientId) moveMutation.mutate({ clientId: draggingClientId, funnelStageId: stage.id });
                  setDraggingClientId(null);
                }}
                className="flex w-72 flex-shrink-0 flex-col rounded-xl bg-ink-100/60"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm font-semibold text-ink-800">{stage.name}</span>
                  </div>
                  <span className="text-xs text-ink-500">{clientsForStage(stage.id).length}</span>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
                  {clientsForStage(stage.id).map((client) => (
                    <div
                      key={client.id}
                      draggable
                      onDragStart={() => setDraggingClientId(client.id)}
                      className="cursor-grab rounded-lg border border-ink-100 bg-white p-3 shadow-card active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-ink-950">{client.name}</p>
                        <GripVertical size={14} className="mt-0.5 flex-shrink-0 text-ink-300" />
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">{client.phone}</p>
                      {client.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {client.tags.map((tag) => (
                            <Badge key={tag.id} color={tag.color}>
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Gerenciar etapas do funil">
        <div className="space-y-2">
          {orderedStages.map((stage) => (
            <div key={stage.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="text-sm text-ink-800">{stage.name}</span>
              </div>
              <button
                onClick={() => deleteStageMutation.mutate(stage.id)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="Nome da nova etapa"
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
          />
          <Button
            onClick={() => newStageName.trim() && createStageMutation.mutate(newStageName.trim())}
            loading={createStageMutation.isPending}
          >
            <Plus size={16} />
            Adicionar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
