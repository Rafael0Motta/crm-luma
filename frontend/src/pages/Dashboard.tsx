import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Clock, UserPlus, TrendingUp, AlertTriangle } from "lucide-react";
import { api } from "../api/client";
import { DashboardMetrics } from "../types";
import { PageHeader, Card, LoadingState } from "../components/ui";

function StatTile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={18} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
          <p className="text-2xl font-semibold text-ink-950">{value}</p>
        </div>
      </div>
    </Card>
  );
}

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => (await api.get<DashboardMetrics>("/dashboard/metrics")).data,
  });

  if (isLoading || !data) return <LoadingState />;

  const maxStageCount = Math.max(1, ...data.clientsByStage.map((s) => s.count));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral da operação" />
      <div className="p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile icon={MessageCircle} label="Conversas abertas" value={data.openConversations} tone="bg-ink-100 text-ink-700" />
          <StatTile icon={Clock} label="Conversas pendentes" value={data.pendingConversations} tone="bg-gold-200 text-gold-700" />
          <StatTile icon={UserPlus} label="Novos clientes no mês" value={data.newClientsThisMonth} tone="bg-ink-100 text-ink-700" />
          <StatTile
            icon={TrendingUp}
            label="Taxa de resposta"
            value={`${Math.round(data.responseRate * 100)}%`}
            tone="bg-ink-100 text-ink-700"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold text-ink-950">Clientes por etapa do funil</h2>
            <div className="mt-5 space-y-4">
              {data.clientsByStage.length === 0 && <p className="text-sm text-ink-400">Nenhuma etapa configurada ainda.</p>}
              {data.clientsByStage.map((stage) => (
                <div key={stage.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink-800">{stage.name}</span>
                    <span className="text-ink-500">{stage.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(stage.count / maxStageCount) * 100}%`, backgroundColor: stage.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600" />
              <h2 className="text-sm font-semibold text-ink-950">Cobranças com falha (mês)</h2>
            </div>
            <p className="mt-4 text-3xl font-semibold text-ink-950">{data.billingRemindersFailedThisMonth}</p>
            <p className="mt-1 text-sm text-ink-500">Lembretes de cobrança que falharam ao enviar este mês.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
