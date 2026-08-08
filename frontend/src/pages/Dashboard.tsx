import { useQuery } from "@tanstack/react-query";
import {
  MessageCircle,
  Clock,
  UserPlus,
  TrendingUp,
  AlertTriangle,
  Wallet,
  Package,
  CalendarClock,
  CheckCircle2,
  Users,
  Repeat,
  Send,
} from "lucide-react";
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

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: async () => (await api.get<DashboardMetrics>("/dashboard/metrics")).data,
  });

  if (isLoading || !data) return <LoadingState />;

  const maxStageCount = Math.max(1, ...data.clientsByStage.map((s) => s.count));
  const maxServiceCount = Math.max(1, ...data.topServices.map((s) => s.count));

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

        <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ink-500">Cobrança</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={Wallet}
            label="Receita mensal recorrente"
            value={formatCurrency(data.monthlyRecurringRevenue)}
            tone="bg-ink-100 text-ink-700"
          />
          <StatTile icon={Package} label="Assinaturas ativas" value={data.activeSubscriptions} tone="bg-ink-100 text-ink-700" />
          <StatTile
            icon={CalendarClock}
            label="Vencendo em 7 dias"
            value={data.upcomingDuesNext7Days}
            tone="bg-gold-200 text-gold-700"
          />
          <StatTile
            icon={AlertTriangle}
            label="Inadimplentes / vencidos"
            value={data.overdueSubscriptions}
            tone="bg-red-100 text-red-700"
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

          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-ink-500" />
                <h2 className="text-sm font-semibold text-ink-950">Clientes cadastrados</h2>
              </div>
              <p className="mt-4 text-3xl font-semibold text-ink-950">{data.totalClients}</p>
              <p className="mt-1 text-sm text-ink-500">Total de clientes na base.</p>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-ink-700" />
                  <h2 className="text-sm font-semibold text-ink-950">Lembretes de cobrança (mês)</h2>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-6">
                <div>
                  <p className="text-2xl font-semibold text-ink-950">{data.billingRemindersSentThisMonth}</p>
                  <p className="text-xs text-ink-500">enviados</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-red-600">{data.billingRemindersFailedThisMonth}</p>
                  <p className="text-xs text-ink-500">falharam</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold text-ink-950">Top serviços por assinaturas ativas</h2>
            <div className="mt-5 space-y-4">
              {data.topServices.length === 0 && <p className="text-sm text-ink-400">Nenhum serviço com vínculos ainda.</p>}
              {data.topServices.map((service) => (
                <div key={service.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink-800">{service.name}</span>
                    <span className="text-ink-500">{service.count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-gold-500" style={{ width: `${(service.count / maxServiceCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-6">
            <StatTile icon={Repeat} label="Follow-ups em andamento" value={data.pendingFollowUps} tone="bg-ink-100 text-ink-700" />
            <StatTile icon={Send} label="Mensagens agendadas pendentes" value={data.pendingScheduledMessages} tone="bg-ink-100 text-ink-700" />
          </div>
        </div>
      </div>
    </div>
  );
}
