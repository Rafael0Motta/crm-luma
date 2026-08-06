import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import { api, getApiErrorMessage } from "../api/client";
import { Plan, User } from "../types";
import { PageHeader, Button, Modal, Input, Select, Label, Switch, LoadingState, Card, Badge } from "../components/ui";

export function Usuarios() {
  const [tab, setTab] = useState<"users" | "plans">("users");

  return (
    <div>
      <PageHeader title="Usuários e Planos" subtitle="Gestão de acessos e limites contratados" />
      <div className="border-b border-ink-100 bg-white px-8">
        <div className="flex gap-6">
          {[
            { key: "users", label: "Usuários" },
            { key: "plans", label: "Planos" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as "users" | "plans")}
              className={`border-b-2 py-3 text-sm font-medium ${
                tab === t.key ? "border-ink-800 text-ink-950" : "border-transparent text-ink-400 hover:text-ink-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-8">{tab === "users" ? <UsersTab /> : <PlansTab />}</div>
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => (await api.get<User[]>("/users")).data,
  });
  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: async () => (await api.get<Plan[]>("/plans")).data });

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
      planId: form.get("planId") || undefined,
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
        planId: form.get("planId") || null,
        ...(password ? { password } : {}),
      },
    });
  }

  if (isLoading) return <LoadingState />;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Novo usuário
        </Button>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">E-mail</th>
              <th className="px-5 py-3">Papel</th>
              <th className="px-5 py-3">Plano</th>
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
                <td className="px-5 py-3 text-ink-600">{u.plan?.name ?? "—"}</td>
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
          <div>
            <Label>Plano</Label>
            <Select name="planId">
              <option value="">Sem plano</option>
              {plans?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p._count?.users ?? 0}/{p.maxUsers} usuários)
                </option>
              ))}
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
            <div>
              <Label>Plano</Label>
              <Select name="planId" defaultValue={editingUser.planId ?? ""}>
                <option value="">Sem plano</option>
                {plans?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p._count?.users ?? 0}/{p.maxUsers} usuários)
                  </option>
                ))}
              </Select>
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

function PlansTab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: plans, isLoading } = useQuery({ queryKey: ["plans"], queryFn: async () => (await api.get<Plan[]>("/plans")).data });

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post("/plans", payload),
    onSuccess: () => {
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/plans/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      name: form.get("name"),
      maxUsers: Number(form.get("maxUsers")),
      maxConversationsMo: form.get("maxConversationsMo") ? Number(form.get("maxConversationsMo")) : undefined,
      price: Number(form.get("price")),
    });
  }

  if (isLoading) return <LoadingState />;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          Novo plano
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans?.map((plan) => (
          <Card key={plan.id} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-ink-950">{plan.name}</p>
                <p className="mt-1 text-2xl font-semibold text-ink-950">R$ {plan.price}</p>
              </div>
              <button onClick={() => deleteMutation.mutate(plan.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50">
                <Trash2 size={16} />
              </button>
            </div>
            <ul className="mt-3 space-y-1 text-sm text-ink-600">
              <li>
                {plan._count?.users ?? 0} / {plan.maxUsers} usuários
              </li>
              {plan.maxConversationsMo && <li>{plan.maxConversationsMo} conversas/mês</li>}
            </ul>
          </Card>
        ))}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo plano">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>Limite de usuários</Label>
            <Input name="maxUsers" type="number" min={1} required />
          </div>
          <div>
            <Label>Limite de conversas/mês (opcional)</Label>
            <Input name="maxConversationsMo" type="number" min={1} />
          </div>
          <div>
            <Label>Preço (R$)</Label>
            <Input name="price" type="number" step="0.01" min={0} required />
          </div>
          <Button type="submit" className="w-full" loading={createMutation.isPending}>
            Salvar plano
          </Button>
        </form>
      </Modal>
    </>
  );
}
