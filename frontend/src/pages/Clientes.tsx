import { useState, FormEvent, useRef, ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, ShieldPlus, Pencil, X, Check, Upload, Download, Tag as TagIcon, ArrowRightLeft } from "lucide-react";
import { api, getApiErrorMessage } from "../api/client";
import { Client, FunnelStage, Paginated, Policy, Tag, User } from "../types";
import { PageHeader, Button, Modal, Input, Select, Label, Badge, LoadingState, EmptyState, Card } from "../components/ui";

const PAGE_SIZE = 20;

export function Clientes() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterStageId, setFilterStageId] = useState("");
  const [filterTagId, setFilterTagId] = useState("");
  const [filterUserId, setFilterUserId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allFilteredSelected, setAllFilteredSelected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filters = { funnelStageId: filterStageId, tagId: filterTagId, assignedUserId: filterUserId };

  const { data, isLoading } = useQuery({
    queryKey: ["clients", search, page, filterStageId, filterTagId, filterUserId],
    queryFn: async () =>
      (
        await api.get<Paginated<Client>>("/clients", {
          params: { ...(search ? { search } : {}), ...filters, page, pageSize: PAGE_SIZE },
        })
      ).data,
  });
  const clients = data?.items;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const { data: stages } = useQuery({
    queryKey: ["funnel-stages"],
    queryFn: async () => (await api.get<FunnelStage[]>("/funnel-stages")).data,
  });

  const { data: users } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => (await api.get<User[]>("/users")).data,
    retry: false,
  });

  const { data: tags } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => (await api.get<Tag[]>("/tags")).data,
  });

  function resetSelection() {
    setSelectedIds(new Set());
    setAllFilteredSelected(false);
  }

  function updateFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
    resetSelection();
  }

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post("/clients", payload),
    onSuccess: () => {
      setCreateOpen(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
    meta: { skipGlobalErrorToast: true },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      setSelectedClient(null);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => api.post("/clients/bulk-delete", { ids }),
    onSuccess: () => {
      resetSelection();
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const bulkTagMutation = useMutation({
    mutationFn: async ({ ids, tagId }: { ids: string[]; tagId: string }) => api.post("/clients/bulk-tag", { ids, tagId, action: "add" }),
    onSuccess: () => {
      resetSelection();
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const bulkStageMutation = useMutation({
    mutationFn: async ({ ids, funnelStageId }: { ids: string[]; funnelStageId: string }) =>
      api.post("/clients/bulk-stage", { ids, funnelStageId }),
    onSuccess: () => {
      resetSelection();
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return (await api.post("/clients/import", form, { headers: { "Content-Type": "multipart/form-data" } })).data as {
        created: number;
        updated: number;
        errors: string[];
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      name: form.get("name"),
      phone: form.get("phone"),
      email: form.get("email") || undefined,
      document: form.get("document") || undefined,
      funnelStageId: form.get("funnelStageId") || undefined,
      assignedUserId: form.get("assignedUserId") || undefined,
    });
  }

  function toggleSelect(id: string) {
    setAllFilteredSelected(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePageSelection() {
    if (!clients) return;
    const allSelected = clients.every((c) => selectedIds.has(c.id));
    setAllFilteredSelected(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        clients.forEach((c) => next.delete(c.id));
      } else {
        clients.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  async function handleSelectAllMatching() {
    const res = await api.get<string[]>("/clients/ids", { params: { ...(search ? { search } : {}), ...filters } });
    setSelectedIds(new Set(res.data));
    setAllFilteredSelected(true);
  }

  async function handleExport(onlySelected: boolean) {
    const params: Record<string, string> =
      onlySelected && selectedIds.size > 0
        ? { ids: Array.from(selectedIds).join(",") }
        : ({ ...(search ? { search } : {}), ...filters } as Record<string, string>);
    const res = await api.get("/clients/export", { params, responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) importMutation.mutate(file);
    e.target.value = "";
  }

  const allOnPageSelected = Boolean(clients?.length) && clients!.every((c) => selectedIds.has(c.id));

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${data?.total ?? 0} clientes cadastrados`}
        action={
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportFile} />
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} />
              Importar
            </Button>
            <Button variant="secondary" onClick={() => handleExport(selectedIds.size > 0)}>
              <Download size={16} />
              Exportar
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} />
              Novo cliente
            </Button>
          </div>
        }
      />

      <div className="p-8">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="max-w-sm flex-1">
            <Label>Buscar</Label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input
                placeholder="Nome, telefone, e-mail..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                  resetSelection();
                }}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-48">
            <Label>Etapa</Label>
            <Select value={filterStageId} onChange={(e) => updateFilter(setFilterStageId, e.target.value)}>
              <option value="">Todas</option>
              {stages?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <Label>Etiqueta</Label>
            <Select value={filterTagId} onChange={(e) => updateFilter(setFilterTagId, e.target.value)}>
              <option value="">Todas</option>
              {tags?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-48">
            <Label>Atendente</Label>
            <Select value={filterUserId} onChange={(e) => updateFilter(setFilterUserId, e.target.value)}>
              <option value="">Todos</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
            <span className="text-sm font-medium text-ink-800">{selectedIds.size} selecionado(s)</span>

            {!allFilteredSelected && data && data.total > (clients?.length ?? 0) && (
              <button onClick={handleSelectAllMatching} className="text-xs font-medium text-ink-700 underline">
                Selecionar todos os {data.total} que correspondem aos filtros
              </button>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <TagIcon size={14} className="text-ink-400" />
                <select
                  onChange={(e) => {
                    if (e.target.value) bulkTagMutation.mutate({ ids: Array.from(selectedIds), tagId: e.target.value });
                    e.target.value = "";
                  }}
                  defaultValue=""
                  className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-700"
                >
                  <option value="" disabled>
                    Adicionar etiqueta
                  </option>
                  {tags?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <ArrowRightLeft size={14} className="text-ink-400" />
                <select
                  onChange={(e) => {
                    if (e.target.value) bulkStageMutation.mutate({ ids: Array.from(selectedIds), funnelStageId: e.target.value });
                    e.target.value = "";
                  }}
                  defaultValue=""
                  className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-700"
                >
                  <option value="" disabled>
                    Mover para etapa
                  </option>
                  {stages?.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm(`Excluir ${selectedIds.size} cliente(s) selecionado(s)? Essa ação não pode ser desfeita.`)) {
                    bulkDeleteMutation.mutate(Array.from(selectedIds));
                  }
                }}
                loading={bulkDeleteMutation.isPending}
              >
                <Trash2 size={14} />
                Excluir selecionados
              </Button>
              <Button variant="ghost" onClick={resetSelection}>
                Limpar seleção
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <LoadingState />
        ) : clients?.length === 0 ? (
          <EmptyState title="Nenhum cliente encontrado" />
        ) : (
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="w-10 px-5 py-3">
                    <input type="checkbox" checked={allOnPageSelected} onChange={togglePageSelection} className="h-4 w-4 rounded border-ink-300" />
                  </th>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-5 py-3">Telefone</th>
                  <th className="px-5 py-3">Etapa</th>
                  <th className="px-5 py-3">Etiquetas</th>
                  <th className="px-5 py-3">Atendente</th>
                </tr>
              </thead>
              <tbody>
                {clients?.map((client) => (
                  <tr
                    key={client.id}
                    onClick={() => setSelectedClient(client)}
                    className="cursor-pointer border-b border-ink-50 last:border-0 hover:bg-ink-50"
                  >
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(client.id)}
                        onChange={() => toggleSelect(client.id)}
                        className="h-4 w-4 rounded border-ink-300"
                      />
                    </td>
                    <td className="px-5 py-3 font-medium text-ink-950">{client.name}</td>
                    <td className="px-5 py-3 text-ink-600">{client.phone}</td>
                    <td className="px-5 py-3">
                      {client.funnelStage && <Badge color={client.funnelStage.color}>{client.funnelStage.name}</Badge>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {client.tags.map((tag) => (
                          <Badge key={tag.id} color={tag.color}>
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{client.assignedUser?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {data && data.total > data.pageSize && (
          <div className="mt-4 flex items-center justify-between text-sm text-ink-500">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo cliente">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>Telefone (WhatsApp)</Label>
            <Input name="phone" required placeholder="5511999999999" />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input name="email" type="email" />
          </div>
          <div>
            <Label>CPF/CNPJ</Label>
            <Input name="document" />
          </div>
          <div>
            <Label>Etapa do funil</Label>
            <Select name="funnelStageId">
              <option value="">Selecione</option>
              {stages?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Atendente responsável</Label>
            <Select name="assignedUserId">
              <option value="">Sem atendente</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={createMutation.isPending}>
            Salvar cliente
          </Button>
        </form>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Importar clientes (CSV)">
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            O arquivo CSV deve conter as colunas <strong>nome</strong> e <strong>telefone</strong> (obrigatórias) e, opcionalmente,{" "}
            <strong>email</strong>, <strong>documento</strong>, <strong>etapa</strong> e <strong>etiquetas</strong> (separadas por ; ).
            Clientes com telefone já cadastrado são atualizados.
          </p>
          <Button onClick={() => fileInputRef.current?.click()} loading={importMutation.isPending} className="w-full">
            <Upload size={16} />
            Escolher arquivo CSV
          </Button>
          {importMutation.data && (
            <div className="rounded-lg border border-ink-100 bg-ink-50 p-3 text-sm">
              <p className="font-medium text-ink-900">
                {importMutation.data.created} criado(s) · {importMutation.data.updated} atualizado(s)
              </p>
              {importMutation.data.errors.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-red-600">
                  {importMutation.data.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {importMutation.isError && <p className="text-sm text-red-600">{getApiErrorMessage(importMutation.error)}</p>}
        </div>
      </Modal>

      {selectedClient && (
        <ClientDetail
          client={selectedClient}
          stages={stages ?? []}
          tags={tags ?? []}
          users={users ?? []}
          onClose={() => setSelectedClient(null)}
          onDelete={() => deleteMutation.mutate(selectedClient.id)}
        />
      )}
    </div>
  );
}

function ClientDetail({
  client,
  stages,
  tags,
  users,
  onClose,
  onDelete,
}: {
  client: Client;
  stages: FunnelStage[];
  tags: Tag[];
  users: User[];
  onClose: () => void;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [addingPolicy, setAddingPolicy] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState(false);

  const { data: fresh } = useQuery({
    queryKey: ["client", client.id],
    queryFn: async () => (await api.get<Client>(`/clients/${client.id}`)).data,
    initialData: client,
  });

  const { data: policies } = useQuery({
    queryKey: ["policies", client.id],
    queryFn: async () => (await api.get<Policy[]>(`/clients/${client.id}/policies`)).data,
  });

  const addTagMutation = useMutation({
    mutationFn: async (tagId: string) => api.post(`/clients/${client.id}/tags`, { tagId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client", client.id] }),
  });

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => api.delete(`/clients/${client.id}/tags/${tagId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client", client.id] }),
  });

  const updateClientMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.put(`/clients/${client.id}`, payload),
    onSuccess: () => {
      setEditingClient(false);
      queryClient.invalidateQueries({ queryKey: ["client", client.id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  const addPolicyMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post(`/clients/${client.id}/policies`, payload),
    onSuccess: () => {
      setAddingPolicy(false);
      queryClient.invalidateQueries({ queryKey: ["policies", client.id] });
    },
  });

  const updatePolicyMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => api.put(`/policies/${id}`, payload),
    onSuccess: () => {
      setEditingPolicyId(null);
      queryClient.invalidateQueries({ queryKey: ["policies", client.id] });
    },
  });

  const deletePolicyMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/policies/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["policies", client.id] }),
  });

  function handleAddPolicy(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    addPolicyMutation.mutate({
      insuranceType: form.get("insuranceType"),
      insurer: form.get("insurer"),
      policyNumber: form.get("policyNumber"),
      value: Number(form.get("value")),
      dueDay: Number(form.get("dueDay")),
    });
  }

  function handleUpdatePolicy(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    updatePolicyMutation.mutate({
      id,
      payload: {
        insuranceType: form.get("insuranceType"),
        insurer: form.get("insurer"),
        policyNumber: form.get("policyNumber"),
        value: Number(form.get("value")),
        dueDay: Number(form.get("dueDay")),
        status: form.get("status"),
      },
    });
  }

  function handleUpdateClient(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    updateClientMutation.mutate({
      name: form.get("name"),
      phone: form.get("phone"),
      email: form.get("email") || null,
      document: form.get("document") || null,
      funnelStageId: form.get("funnelStageId") || null,
      assignedUserId: form.get("assignedUserId") || null,
    });
  }

  const availableTags = tags.filter((t) => !fresh?.tags.some((ct) => ct.id === t.id));

  return (
    <Modal open onClose={onClose} title={fresh?.name ?? client.name} wide>
      <div className="space-y-6">
        {editingClient ? (
          <form onSubmit={handleUpdateClient} className="grid grid-cols-2 gap-3 rounded-lg border border-ink-100 p-3">
            <Input name="name" defaultValue={fresh?.name} placeholder="Nome" required />
            <Input name="phone" defaultValue={fresh?.phone} placeholder="Telefone" required />
            <Input name="email" type="email" defaultValue={fresh?.email ?? ""} placeholder="E-mail" />
            <Input name="document" defaultValue={fresh?.document ?? ""} placeholder="CPF/CNPJ" />
            <Select name="funnelStageId" defaultValue={fresh?.funnelStageId ?? ""}>
              <option value="">Etapa do funil</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select name="assignedUserId" defaultValue={fresh?.assignedUserId ?? ""}>
              <option value="">Sem atendente</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
            <div className="col-span-2 flex gap-2">
              <Button type="submit" loading={updateClientMutation.isPending}>
                <Check size={14} />
                Salvar
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEditingClient(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase text-ink-400">Telefone</p>
              <p className="font-medium text-ink-900">{fresh?.phone}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-ink-400">E-mail</p>
              <p className="font-medium text-ink-900">{fresh?.email ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-ink-400">Documento</p>
              <p className="font-medium text-ink-900">{fresh?.document ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-ink-400">Etapa</p>
              <p className="font-medium text-ink-900">{fresh?.funnelStage?.name ?? "—"}</p>
            </div>
            <button
              onClick={() => setEditingClient(true)}
              className="col-span-2 flex w-fit items-center gap-1 text-xs font-medium text-ink-700 hover:underline"
            >
              <Pencil size={12} />
              Editar dados do cliente
            </button>
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Etiquetas</p>
          <div className="flex flex-wrap gap-2">
            {fresh?.tags.map((tag) => (
              <button key={tag.id} onClick={() => removeTagMutation.mutate(tag.id)} title="Remover etiqueta">
                <Badge color={tag.color}>{tag.name} ×</Badge>
              </button>
            ))}
            {availableTags.length > 0 && (
              <select
                onChange={(e) => e.target.value && addTagMutation.mutate(e.target.value)}
                value=""
                className="rounded-full border border-dashed border-ink-300 bg-transparent px-2.5 py-0.5 text-xs text-ink-500"
              >
                <option value="">+ adicionar</option>
                {availableTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Apólices</p>
            <button onClick={() => setAddingPolicy((v) => !v)} className="flex items-center gap-1 text-xs font-medium text-ink-700 hover:underline">
              <ShieldPlus size={14} />
              Nova apólice
            </button>
          </div>

          {addingPolicy && (
            <form onSubmit={handleAddPolicy} className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-ink-100 p-3">
              <Input name="insuranceType" placeholder="Tipo de seguro" required />
              <Input name="insurer" placeholder="Seguradora" required />
              <Input name="policyNumber" placeholder="Número da apólice" required />
              <Input name="value" type="number" step="0.01" placeholder="Valor" required />
              <Input name="dueDay" type="number" min={1} max={31} placeholder="Dia de vencimento" required />
              <Button type="submit" className="col-span-2" loading={addPolicyMutation.isPending}>
                Salvar apólice
              </Button>
            </form>
          )}

          <div className="space-y-2">
            {policies?.length === 0 && <p className="text-sm text-ink-400">Nenhuma apólice cadastrada.</p>}
            {policies?.map((policy) =>
              editingPolicyId === policy.id ? (
                <form
                  key={policy.id}
                  onSubmit={(e) => handleUpdatePolicy(e, policy.id)}
                  className="grid grid-cols-2 gap-2 rounded-lg border border-ink-100 p-3"
                >
                  <Input name="insuranceType" defaultValue={policy.insuranceType} placeholder="Tipo de seguro" required />
                  <Input name="insurer" defaultValue={policy.insurer} placeholder="Seguradora" required />
                  <Input name="policyNumber" defaultValue={policy.policyNumber} placeholder="Número da apólice" required />
                  <Input name="value" type="number" step="0.01" defaultValue={policy.value} placeholder="Valor" required />
                  <Input name="dueDay" type="number" min={1} max={31} defaultValue={policy.dueDay} placeholder="Dia de vencimento" required />
                  <Select name="status" defaultValue={policy.status}>
                    <option value="ATIVA">Ativa</option>
                    <option value="CANCELADA">Cancelada</option>
                    <option value="INADIMPLENTE">Inadimplente</option>
                    <option value="VENCIDA">Vencida</option>
                  </Select>
                  <div className="col-span-2 flex gap-2">
                    <Button type="submit" loading={updatePolicyMutation.isPending}>
                      <Check size={14} />
                      Salvar
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setEditingPolicyId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <div key={policy.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-ink-900">
                      {policy.insuranceType} · {policy.insurer}
                    </p>
                    <p className="text-xs text-ink-500">
                      Nº {policy.policyNumber} · vencimento dia {policy.dueDay} · R$ {policy.value}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={policy.status === "ATIVA" ? "#1B7A4C" : "#8A2B2B"}>{policy.status}</Badge>
                    <button onClick={() => setEditingPolicyId(policy.id)} className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deletePolicyMutation.mutate(policy.id)}
                      className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <div className="flex justify-end border-t border-ink-100 pt-4">
          <Button variant="danger" onClick={onDelete}>
            <Trash2 size={14} />
            Excluir cliente
          </Button>
        </div>
      </div>
    </Modal>
  );
}
