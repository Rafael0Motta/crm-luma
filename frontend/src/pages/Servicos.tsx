import { useState, FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Package, Link2 } from "lucide-react";
import { api, getApiErrorMessage } from "../api/client";
import { Client, ClientService, ClientServiceStatus, Service } from "../types";
import { PageHeader, Button, Modal, Input, Select, Label, Textarea, Switch, Badge, LoadingState, EmptyState, Card } from "../components/ui";

const STATUS_LABELS: Record<ClientServiceStatus, { label: string; color: string }> = {
  ATIVO: { label: "Ativo", color: "#1B7A4C" },
  CANCELADO: { label: "Cancelado", color: "#6B7280" },
  INADIMPLENTE: { label: "Inadimplente", color: "#A8822E" },
  VENCIDO: { label: "Vencido", color: "#8A2B2B" },
};

export function Servicos() {
  const [tab, setTab] = useState<"catalogo" | "vinculos">("catalogo");

  return (
    <div>
      <PageHeader title="Serviços" subtitle="Catálogo de planos e serviços vinculados aos clientes" />

      <div className="border-b border-ink-100 bg-white px-8">
        <div className="flex gap-6">
          <button
            onClick={() => setTab("catalogo")}
            className={`border-b-2 py-3 text-sm font-medium transition-colors ${
              tab === "catalogo" ? "border-ink-800 text-ink-900" : "border-transparent text-ink-400 hover:text-ink-700"
            }`}
          >
            Catálogo
          </button>
          <button
            onClick={() => setTab("vinculos")}
            className={`border-b-2 py-3 text-sm font-medium transition-colors ${
              tab === "vinculos" ? "border-ink-800 text-ink-900" : "border-transparent text-ink-400 hover:text-ink-700"
            }`}
          >
            Vínculos com clientes
          </button>
        </div>
      </div>

      {tab === "catalogo" ? <CatalogoTab /> : <VinculosTab />}
    </div>
  );
}

function CatalogoTab() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Service | "new" | null>(null);

  const { data: services, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await api.get<Service[]>("/services")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: string; name: string; description: string | null; category: string | null; price: number | null }) => {
      const { id, ...rest } = payload;
      return id ? api.put(`/services/${id}`, rest) : api.post("/services", rest);
    },
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/services/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => api.put(`/services/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const priceRaw = form.get("price");
    saveMutation.mutate({
      id: editing !== "new" ? editing?.id : undefined,
      name: String(form.get("name")),
      description: (form.get("description") as string) || null,
      category: (form.get("category") as string) || null,
      price: priceRaw ? Number(priceRaw) : null,
    });
  }

  return (
    <div className="p-8">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus size={16} />
          Novo serviço
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : services?.length === 0 ? (
        <EmptyState title="Nenhum serviço cadastrado" subtitle="Adicione os planos/serviços que sua empresa oferece" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services?.map((service) => (
            <Card key={service.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-700">
                    <Package size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-950">{service.name}</p>
                    <p className="text-xs text-ink-400">
                      {service.category || "Sem categoria"} · {service._count?.subscriptions ?? 0} vínculo(s)
                    </p>
                  </div>
                </div>
                <Switch checked={service.active} onChange={() => toggleActiveMutation.mutate({ id: service.id, active: !service.active })} />
              </div>
              {service.description && <p className="mt-2 text-xs text-ink-500">{service.description}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-900">
                  {service.price ? `R$ ${Number(service.price).toFixed(2)}` : "—"}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(service)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => confirm(`Excluir o serviço "${service.name}"?`) && deleteMutation.mutate(service.id)}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Novo serviço" : "Editar serviço"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome</Label>
            <Input name="name" defaultValue={editing !== "new" ? editing?.name : ""} required />
          </div>
          <div>
            <Label>Categoria</Label>
            <Input name="category" defaultValue={editing !== "new" ? editing?.category ?? "" : ""} placeholder="Ex: Saúde, Auto, Vida" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea name="description" rows={3} defaultValue={editing !== "new" ? editing?.description ?? "" : ""} />
          </div>
          <div>
            <Label>Preço padrão (R$)</Label>
            <Input name="price" type="number" step="0.01" min={0} defaultValue={editing !== "new" ? editing?.price ?? "" : ""} />
          </div>
          <Button type="submit" className="w-full" loading={saveMutation.isPending}>
            Salvar serviço
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function VinculosTab() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["client-services"],
    queryFn: async () => (await api.get<ClientService[]>("/services/subscriptions")).data,
  });

  const { data: services } = useQuery({
    queryKey: ["services", "active"],
    queryFn: async () => (await api.get<Service[]>("/services", { params: { active: "true" } })).data,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-full"],
    queryFn: async () => (await api.get<Client[]>("/clients")).data,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      id ? api.put(`/services/subscriptions/${id}`, payload) : api.post("/services/subscriptions", payload),
    onSuccess: () => {
      setCreating(false);
      setEditingId(null);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["client-services"] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
    meta: { skipGlobalErrorToast: true },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/services/subscriptions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-services"] }),
  });

  function buildPayload(form: FormData) {
    const paymentDate = form.get("paymentDate") as string;
    const startDate = form.get("startDate") as string;
    return {
      clientId: form.get("clientId"),
      serviceId: form.get("serviceId"),
      value: Number(form.get("value")),
      dueDay: Number(form.get("dueDay")),
      status: form.get("status"),
      paymentDate: paymentDate ? new Date(paymentDate).toISOString() : null,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      notes: (form.get("notes") as string) || null,
    };
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    saveMutation.mutate({ payload: buildPayload(new FormData(e.currentTarget)) });
  }

  function handleUpdate(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    saveMutation.mutate({ id, payload: buildPayload(new FormData(e.currentTarget)) });
  }

  const editingSub = subscriptions?.find((s) => s.id === editingId);

  return (
    <div className="p-8">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)} disabled={!services?.length}>
          <Link2 size={16} />
          Novo vínculo
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : subscriptions?.length === 0 ? (
        <EmptyState title="Nenhum vínculo criado" subtitle="Vincule um serviço do catálogo a um cliente" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Serviço</th>
                <th className="px-5 py-3">Valor</th>
                <th className="px-5 py-3">Vencimento</th>
                <th className="px-5 py-3">Pagamento</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {subscriptions?.map((sub) => (
                <tr key={sub.id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50">
                  <td className="px-5 py-3 font-medium text-ink-950">
                    {sub.client.name}
                    <p className="text-xs font-normal text-ink-400">{sub.client.phone}</p>
                  </td>
                  <td className="px-5 py-3 text-ink-700">{sub.service.name}</td>
                  <td className="px-5 py-3 text-ink-700">R$ {Number(sub.value).toFixed(2)}</td>
                  <td className="px-5 py-3 text-ink-600">dia {sub.dueDay}</td>
                  <td className="px-5 py-3 text-ink-600">
                    {sub.paymentDate ? new Date(sub.paymentDate).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge color={STATUS_LABELS[sub.status].color}>{STATUS_LABELS[sub.status].label}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditingId(sub.id)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700">
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => confirm("Remover este vínculo?") && deleteMutation.mutate(sub.id)}
                        className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Novo vínculo">
        <SubscriptionForm services={services ?? []} clients={clients ?? []} onSubmit={handleCreate} saving={saveMutation.isPending} error={error} />
      </Modal>

      <Modal open={editingId !== null} onClose={() => setEditingId(null)} title="Editar vínculo">
        {editingSub && (
          <SubscriptionForm
            services={services ?? []}
            clients={clients ?? []}
            subscription={editingSub}
            onSubmit={(e) => handleUpdate(e, editingSub.id)}
            saving={saveMutation.isPending}
            error={error}
          />
        )}
      </Modal>
    </div>
  );
}

function SubscriptionForm({
  services,
  clients,
  subscription,
  onSubmit,
  saving,
  error,
}: {
  services: Service[];
  clients: Client[];
  subscription?: ClientService;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  error: string | null;
}) {
  const [serviceId, setServiceId] = useState(subscription?.serviceId ?? services[0]?.id ?? "");
  const selectedService = services.find((s) => s.id === serviceId) ?? subscription?.service;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label>Cliente</Label>
        <Select name="clientId" defaultValue={subscription?.clientId ?? ""} required>
          <option value="">Selecione um cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.phone}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Serviço</Label>
        <Select name="serviceId" value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
          <option value="">Selecione um serviço</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Valor (R$)</Label>
          <Input
            name="value"
            type="number"
            step="0.01"
            min={0}
            defaultValue={subscription?.value ?? selectedService?.price ?? ""}
            required
          />
        </div>
        <div>
          <Label>Dia de vencimento</Label>
          <Input name="dueDay" type="number" min={1} max={31} defaultValue={subscription?.dueDay ?? 10} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Data de pagamento</Label>
          <Input
            name="paymentDate"
            type="date"
            defaultValue={subscription?.paymentDate ? subscription.paymentDate.slice(0, 10) : ""}
          />
        </div>
        <div>
          <Label>Início do plano</Label>
          <Input name="startDate" type="date" defaultValue={subscription?.startDate ? subscription.startDate.slice(0, 10) : ""} />
        </div>
      </div>
      <div>
        <Label>Status</Label>
        <Select name="status" defaultValue={subscription?.status ?? "ATIVO"}>
          <option value="ATIVO">Ativo</option>
          <option value="INADIMPLENTE">Inadimplente</option>
          <option value="VENCIDO">Vencido</option>
          <option value="CANCELADO">Cancelado</option>
        </Select>
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea name="notes" rows={2} defaultValue={subscription?.notes ?? ""} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" loading={saving}>
        Salvar vínculo
      </Button>
    </form>
  );
}
