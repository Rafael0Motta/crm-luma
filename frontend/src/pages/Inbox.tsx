import { useEffect, useRef, useState, FormEvent } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  FileText,
  X,
  Search,
  Bot,
  CalendarClock,
  Image as ImageIcon,
  Mic,
} from "lucide-react";
import { api, getApiErrorMessage } from "../api/client";
import { Conversation, ConversationStatus, Message, User } from "../types";
import { Badge, LoadingState, EmptyState, Select, Modal, Label, Input, Textarea, Button } from "../components/ui";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

const AVATAR_COLORS = ["#1B4B4A", "#2A6F6D", "#A8822E", "#1B7A4C", "#3B5BA5", "#7B4FA5", "#8A2B2B"];

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ backgroundColor: avatarColor(name), width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </div>
  );
}

function mediaSrc(mediaUrl: string) {
  return mediaUrl.startsWith("http") ? mediaUrl : `${API_URL}${mediaUrl}`;
}

function MessageMedia({ message }: { message: Message }) {
  if (!message.mediaUrl) return null;
  const src = mediaSrc(message.mediaUrl);

  if (message.type === "IMAGE") {
    return <img src={src} alt="Imagem enviada" className="mb-1.5 max-h-64 rounded-lg object-cover" />;
  }
  if (message.type === "VIDEO") {
    return <video src={src} controls className="mb-1.5 max-h-64 rounded-lg" />;
  }
  if (message.type === "AUDIO") {
    return <audio src={src} controls className="mb-1.5 w-64" />;
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="mb-1.5 flex items-center gap-2 rounded-lg border border-current/20 px-3 py-2 text-sm underline"
    >
      <FileText size={16} />
      Abrir documento
    </a>
  );
}

function previewText(preview: Conversation["lastMessagePreview"]): string {
  if (!preview) return "Nenhuma mensagem ainda";
  const prefix = preview.direction === "OUTBOUND" ? (preview.sender === "AI" ? "IA: " : preview.sender === "AUTOMATION" ? "Automação: " : "Você: ") : "";
  if (preview.type === "IMAGE") return `${prefix}📷 Imagem`;
  if (preview.type === "AUDIO") return `${prefix}🎤 Áudio`;
  if (preview.type === "VIDEO") return `${prefix}🎬 Vídeo`;
  if (preview.type === "DOCUMENT") return `${prefix}📄 Documento`;
  return `${prefix}${preview.content || "..."}`;
}

const STATUS_TABS: { label: string; value: ConversationStatus | "TODAS" }[] = [
  { label: "Todas", value: "TODAS" },
  { label: "Abertas", value: "ABERTA" },
  { label: "Pendentes", value: "PENDENTE" },
  { label: "Resolvidas", value: "RESOLVIDA" },
];

function formatTime(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatListTime(date: string | null) {
  if (!date) return "";
  const d = new Date(date);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return formatTime(date);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function dateSeparatorLabel(date: string): string {
  const d = new Date(date);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Hoje";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function Inbox() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ConversationStatus | "TODAS">("TODAS");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", statusFilter, search, visibleCount],
    queryFn: async () =>
      (
        await api.get<Conversation[]>("/conversations", {
          params: {
            ...(statusFilter === "TODAS" ? {} : { status: statusFilter }),
            ...(search ? { search } : {}),
            page: 1,
            pageSize: visibleCount,
          },
        })
      ).data,
    refetchInterval: 8000,
  });

  const { data: users } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => (await api.get<User[]>("/users")).data,
    retry: false,
  });

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedId],
    queryFn: async () => (await api.get<Message[]>(`/conversations/${selectedId}/messages`)).data,
    enabled: Boolean(selectedId),
    refetchInterval: 5000,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async (content: string) => api.post(`/conversations/${selectedId}/messages`, { content }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    meta: { skipGlobalErrorToast: true },
  });

  const statusMutation = useMutation({
    mutationFn: async (status: ConversationStatus) => api.put(`/conversations/${selectedId}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });

  const assignMutation = useMutation({
    mutationFn: async (userId: string | null) => api.put(`/conversations/${selectedId}/assign`, { userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });

  const aiToggleMutation = useMutation({
    mutationFn: async (aiEnabled: boolean) => api.put(`/conversations/${selectedId}/ai-toggle`, { aiEnabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });

  const sendMediaMutation = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (caption) formData.append("caption", caption);
      return api.post(`/conversations/${selectedId}/messages/media`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      setDraft("");
      setPendingFile(null);
      queryClient.invalidateQueries({ queryKey: ["messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    meta: { skipGlobalErrorToast: true },
  });

  const scheduleMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => api.post("/scheduled-messages", payload),
    onSuccess: () => {
      setScheduleOpen(false);
      queryClient.invalidateQueries({ queryKey: ["scheduled-messages"] });
    },
  });

  function handleSend() {
    if (!selectedId) return;
    if (pendingFile) {
      sendMediaMutation.mutate({ file: pendingFile, caption: draft.trim() });
      return;
    }
    if (!draft.trim()) return;
    sendMutation.mutate(draft.trim());
  }

  function handleScheduleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const form = new FormData(e.currentTarget);
    scheduleMutation.mutate({
      name: `Mensagem para ${selected.client?.name ?? selected.whatsappNumber}`,
      content: form.get("content"),
      scheduledFor: new Date(String(form.get("scheduledFor"))).toISOString(),
      targetType: "SINGLE",
      targetConfig: { clientId: selected.clientId },
    });
  }

  // Agrupa mensagens por dia para exibir separadores de data no fio da conversa
  const groupedMessages: { dateLabel: string; items: Message[] }[] = [];
  for (const msg of messages ?? []) {
    const label = dateSeparatorLabel(msg.createdAt);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup?.dateLabel === label) {
      lastGroup.items.push(msg);
    } else {
      groupedMessages.push({ dateLabel: label, items: [msg] });
    }
  }

  return (
    <div className="flex h-screen">
      <div className="flex w-80 flex-shrink-0 flex-col border-r border-ink-100 bg-white">
        <div className="border-b border-ink-100 px-5 py-4">
          <h1 className="text-base font-semibold text-ink-950">Conversas</h1>
          <div className="relative mt-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="w-full rounded-lg border border-ink-200 bg-ink-50 py-1.5 pl-8 pr-3 text-xs focus:border-ink-400 focus:bg-white focus:outline-none"
            />
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === tab.value ? "bg-ink-800 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && <LoadingState />}
          {conversations?.length === 0 && <EmptyState title="Nenhuma conversa" subtitle="As conversas do WhatsApp aparecerão aqui." />}
          {conversations?.map((conv) => {
            const name = conv.client?.name ?? conv.whatsappNumber;
            return (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                className={`flex w-full items-start gap-3 border-b border-ink-50 px-4 py-3 text-left transition-colors hover:bg-ink-50 ${
                  selectedId === conv.id ? "bg-ink-100" : ""
                }`}
              >
                <Avatar name={name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-ink-950">{name}</span>
                    <span className="flex-shrink-0 text-[11px] text-ink-400">{formatListTime(conv.lastMessageAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className={`truncate text-xs ${conv.unreadCount > 0 ? "font-medium text-ink-700" : "text-ink-400"}`}>
                      {previewText(conv.lastMessagePreview)}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-gold-500 px-1 text-[11px] font-semibold text-ink-950">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                  {conv.client?.tags && conv.client.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {conv.client.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag.id} color={tag.color}>
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          {conversations && conversations.length >= visibleCount && (
            <button
              onClick={() => setVisibleCount((v) => v + 50)}
              className="w-full py-3 text-center text-xs font-medium text-ink-500 hover:bg-ink-50"
            >
              Carregar mais
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col bg-ink-50">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState title="Selecione uma conversa" subtitle="Escolha uma conversa na lista ao lado para visualizar as mensagens." />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-ink-100 bg-white px-6 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={selected.client?.name ?? selected.whatsappNumber} size={38} />
                <div>
                  <p className="text-sm font-semibold text-ink-950">{selected.client?.name ?? selected.whatsappNumber}</p>
                  <p className="text-xs text-ink-500">{selected.whatsappNumber}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => aiToggleMutation.mutate(!selected.aiEnabled)}
                  title={selected.aiEnabled ? "IA ativada nesta conversa — clique para desativar" : "IA desativada nesta conversa — clique para ativar"}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    selected.aiEnabled
                      ? "border-ink-700 bg-ink-800 text-white hover:bg-ink-700"
                      : "border-ink-200 text-ink-500 hover:bg-ink-50"
                  }`}
                >
                  <Bot size={14} />
                  IA {selected.aiEnabled ? "ativa" : "inativa"}
                </button>
                <button
                  onClick={() => setScheduleOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50"
                  title="Agendar mensagem para este cliente"
                >
                  <CalendarClock size={14} />
                  Agendar
                </button>
                <Select
                  value={selected.assignedUserId ?? ""}
                  onChange={(e) => assignMutation.mutate(e.target.value || null)}
                  className="!w-40 text-xs"
                >
                  <option value="">Sem atendente</option>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
                <button
                  onClick={() => statusMutation.mutate("RESOLVIDA")}
                  disabled={selected.status === "RESOLVIDA"}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-40"
                >
                  <CheckCircle2 size={14} />
                  Resolver
                </button>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-6 py-6">
              {groupedMessages.map((group) => (
                <div key={group.dateLabel}>
                  <div className="my-4 flex items-center justify-center">
                    <span className="rounded-full bg-ink-100 px-3 py-1 text-[11px] font-medium text-ink-500">{group.dateLabel}</span>
                  </div>
                  <div className="space-y-3">
                    {group.items.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-md rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                            msg.direction === "OUTBOUND" ? "bg-ink-800 text-white" : "bg-white text-ink-900"
                          }`}
                        >
                          <MessageMedia message={msg} />
                          {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] opacity-70">
                            <span>{formatTime(msg.createdAt)}</span>
                            {msg.sender !== "HUMAN" && (
                              <span className="flex items-center gap-0.5">
                                · {msg.sender === "AI" ? <Bot size={10} /> : null}
                                {msg.sender === "AI" ? "IA" : msg.sender === "AUTOMATION" ? "Automação" : ""}
                              </span>
                            )}
                            {msg.status === "FAILED" && (
                              <span className="flex items-center gap-1 text-red-300">
                                <AlertCircle size={10} /> falha
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {messages?.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-ink-400">Nenhuma mensagem nesta conversa ainda.</p>
                </div>
              )}
            </div>

            <div className="border-t border-ink-100 bg-white px-6 py-4">
              {sendMutation.isError && (
                <p className="mb-2 text-xs text-red-600">{getApiErrorMessage(sendMutation.error)}</p>
              )}
              {sendMediaMutation.isError && (
                <p className="mb-2 text-xs text-red-600">{getApiErrorMessage(sendMediaMutation.error)}</p>
              )}
              {pendingFile && (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-ink-100 px-3 py-1.5 text-xs text-ink-700">
                  {pendingFile.type.startsWith("image/") ? <ImageIcon size={12} /> : pendingFile.type.startsWith("audio/") ? <Mic size={12} /> : <Paperclip size={12} />}
                  <span className="truncate">{pendingFile.name}</span>
                  <button onClick={() => setPendingFile(null)} className="ml-auto text-ink-400 hover:text-ink-700">
                    <X size={12} />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPendingFile(file);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-ink-200 text-ink-500 hover:bg-ink-50"
                  title="Anexar arquivo"
                >
                  <Paperclip size={16} />
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder={pendingFile ? "Legenda (opcional)..." : "Digite uma mensagem..."}
                  className="max-h-32 flex-1 resize-none rounded-lg border border-ink-200 px-3 py-2.5 text-sm focus:border-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-100"
                />
                <button
                  onClick={handleSend}
                  disabled={sendMutation.isPending || sendMediaMutation.isPending || (!draft.trim() && !pendingFile)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-ink-800 text-white hover:bg-ink-700 disabled:bg-ink-300"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selected && (
        <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title={`Agendar mensagem · ${selected.client?.name ?? selected.whatsappNumber}`}>
          <form onSubmit={handleScheduleSubmit} className="space-y-4">
            <div>
              <Label>Mensagem</Label>
              <Textarea name="content" rows={4} required placeholder="Escreva a mensagem a ser enviada..." />
            </div>
            <div>
              <Label>Data e hora do envio</Label>
              <Input name="scheduledFor" type="datetime-local" required />
            </div>
            {scheduleMutation.isError && <p className="text-sm text-red-600">{getApiErrorMessage(scheduleMutation.error)}</p>}
            <Button type="submit" className="w-full" loading={scheduleMutation.isPending}>
              <CalendarClock size={16} />
              Agendar mensagem
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
