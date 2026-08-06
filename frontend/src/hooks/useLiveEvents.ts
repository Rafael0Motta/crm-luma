import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TOKEN_KEY } from "../api/client";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

interface CrmEvent {
  type: "message" | "conversation_updated";
  conversationId: string;
}

/**
 * Mantem uma conexao SSE aberta com o backend para refletir mensagens novas
 * (recebidas via WhatsApp, enviadas por automacao/IA/follow-up/agendamento)
 * sem depender apenas do polling.
 */
export function useLiveEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const source = new EventSource(`${API_URL}/events/stream?token=${encodeURIComponent(token)}`);

    source.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as CrmEvent;
        if (data.type === "message" || data.type === "conversation_updated") {
          queryClient.invalidateQueries({ queryKey: ["messages", data.conversationId] });
          queryClient.invalidateQueries({ queryKey: ["conversations"] });
          queryClient.invalidateQueries({ queryKey: ["stale-leads"] });
        }
      } catch {
        // linhas de comentario/heartbeat nao chegam aqui, mas ignoramos qualquer parse invalido
      }
    };

    return () => source.close();
  }, [queryClient]);
}
