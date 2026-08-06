import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api } from "../api/client";
import { Tag } from "../types";
import { PageHeader, Button, Modal, Input, Label, LoadingState, EmptyState, Card } from "../components/ui";

const PRESET_COLORS = ["#1B4B4A", "#2A6F6D", "#C9A24B", "#1B7A4C", "#8A2B2B", "#3B5BA5", "#7B4FA5"];

export function Etiquetas() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const { data: tags, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => (await api.get<Tag[]>("/tags")).data,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; color: string }) => api.post("/tags", payload),
    onSuccess: () => {
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/tags/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tags"] }),
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({ name: String(form.get("name")), color });
  }

  return (
    <div>
      <PageHeader
        title="Etiquetas"
        subtitle="Organize seus clientes com etiquetas coloridas"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Nova etiqueta
          </Button>
        }
      />

      <div className="p-8">
        {isLoading ? (
          <LoadingState />
        ) : tags?.length === 0 ? (
          <EmptyState title="Nenhuma etiqueta criada" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tags?.map((tag) => (
              <Card key={tag.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-2.5">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                  <div>
                    <p className="text-sm font-medium text-ink-950">{tag.name}</p>
                    <p className="text-xs text-ink-400">{tag._count?.clients ?? 0} cliente(s)</p>
                  </div>
                </div>
                <button onClick={() => deleteMutation.mutate(tag.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                  <Trash2 size={16} />
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova etiqueta">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-ink-800" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full" loading={createMutation.isPending}>
            Salvar etiqueta
          </Button>
        </form>
      </Modal>
    </div>
  );
}
