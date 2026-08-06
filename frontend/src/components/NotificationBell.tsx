import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { api } from "../api/client";

interface StaleLead {
  id: string;
  client: { id: string; name: string; phone: string } | null;
  lastMessageAt: string | null;
  hoursSinceLastMessage: number | null;
}

const STALE_HOURS = 24;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: staleLeads } = useQuery({
    queryKey: ["stale-leads"],
    queryFn: async () => (await api.get<StaleLead[]>("/conversations/stale", { params: { hours: STALE_HOURS } })).data,
    refetchInterval: 60000,
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const count = staleLeads?.length ?? 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100"
        title="Leads sem resposta"
      >
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-ink-100 bg-white shadow-xl">
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink-950">Leads sem resposta</p>
            <p className="text-xs text-ink-400">Conversas aguardando retorno do cliente ha mais de {STALE_HOURS}h</p>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {count === 0 && <p className="px-4 py-6 text-center text-sm text-ink-400">Nenhum lead parado no momento.</p>}
            {staleLeads?.map((lead) => (
              <button
                key={lead.id}
                onClick={() => {
                  setOpen(false);
                  navigate(`/inbox?open=${lead.id}`);
                }}
                className="flex w-full items-center justify-between border-b border-ink-50 px-4 py-2.5 text-left last:border-0 hover:bg-ink-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">{lead.client?.name ?? lead.client?.phone}</p>
                  <p className="text-xs text-ink-400">{lead.client?.phone}</p>
                </div>
                <span className="flex-shrink-0 text-xs font-medium text-gold-600">{lead.hoursSinceLastMessage}h</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
