import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import { api, getApiErrorMessage } from "../api/client";
import { User } from "../types";
import { PageHeader, Button, Modal, Input, Select, Label, Switch, LoadingState, Card, Badge } from "../components/ui";

export function Usuarios() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => (await api.get<User[]>("/users")).data,
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post("/users", payload),
    onSuccess: () => {
      setCreateOpen(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
    meta: { skipGlobalErrorToast: true },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => api.put(`/users/${id}`, payload),
    onSuccess: () => {
      setEditingUser(null);
      setEditError(null);
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
    },
    onError: (err) => setEditError(getApiErrorMessage(err)),
    meta: { skipGlobalErrorToast: true },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => api.put(`/users/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users-list"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users-list"] }),
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      role: form.get("role"),
    });
  }

  function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingUser) return;
    const form = new FormData(e.currentTarget);
    const password = form.get("password");
    updateMutation.mutate({
      id: editingUser.id,
      payload: {
        name: form.get("name"),
        email: form.get("email"),
        role: form.get("role"),
        ...(password ? { password } : {}),
      },
    });
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle="Gestão de acessos da equipe"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Novo usuário
          </Button>
        }
      />

      <div className="p-4 lg:p-8">
        {isLoading ? (
          <LoadingState />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-5 py-3">E-mail</th>
                  <th className="px-5 py-3">Papel</th>
                  <th className="px-5 py-3">Ativo</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr key={u.id} className="border-b border-ink-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-ink-950">{u.name}</td>
                    <td className="px-5 py-3 text-ink-600">{u.email}</td>
                    <td className="px-5 py-3">
                      <Badge color={u.role === "ADMIN" ? "#8C6B22" : "#226B63"}>{u.role === "ADMIN" ? "Administrador" : "Atendente"}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Switch checked={u.active} onChange={() => toggleActiveMutation.mutate({ id: u.id, active: !u.active })} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditingUser(u)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => deleteMutation.mutate(u.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo usuário">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input name="email" type="email" required />
          </div>
          <div>
            <Label>Senha</Label>
            <Input name="password" type="password" minLength={6} required />
          </div>
          <div>
            <Label>Papel</Label>
            <Select name="role" defaultValue="ATENDENTE">
              <option value="ATENDENTE">Atendente</option>
              <option value="ADMIN">Administrador</option>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={createMutation.isPending}>
            Criar usuário
          </Button>
        </form>
      </Modal>

      {editingUser && (
        <Modal open onClose={() => setEditingUser(null)} title="Editar usuário">
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input name="name" defaultValue={editingUser.name} required />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input name="email" type="email" defaultValue={editingUser.email} required />
            </div>
            <div>
              <Label>Nova senha (opcional)</Label>
              <Input name="password" type="password" minLength={6} placeholder="Deixe em branco para manter a atual" />
            </div>
            <div>
              <Label>Papel</Label>
              <Select name="role" defaultValue={editingUser.role}>
                <option value="ATENDENTE">Atendente</option>
                <option value="ADMIN">Administrador</option>
              </Select>
            </div>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            <Button type="submit" className="w-full" loading={updateMutation.isPending}>
              Salvar alterações
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
