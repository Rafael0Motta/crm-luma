import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Kanban,
  Users,
  Zap,
  Repeat,
  CalendarClock,
  Tag,
  UserCog,
  Receipt,
  Settings,
  Sparkles,
  LogOut,
  BookOpen,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLiveEvents } from "../hooks/useLiveEvents";
import { NotificationBell } from "./NotificationBell";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/inbox", label: "Conversas", icon: MessageSquare },
  { to: "/funil", label: "Funil", icon: Kanban },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/automacoes", label: "Automações", icon: Zap },
  { to: "/followups", label: "Follow-ups", icon: Repeat },
  { to: "/agendadas", label: "Mensagens agendadas", icon: CalendarClock },
  { to: "/etiquetas", label: "Etiquetas", icon: Tag },
  { to: "/cobranca", label: "Cobrança", icon: Receipt },
  { to: "/documentacao", label: "Documentação", icon: BookOpen },
  { to: "/usuarios", label: "Usuários", icon: UserCog, adminOnly: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
];

export function Layout() {
  const { user, logout } = useAuth();
  useLiveEvents();

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-ink-100 bg-ink-950 text-ink-50">
        <div className="flex items-center gap-2 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-500 text-ink-950">
            <Sparkles size={18} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight tracking-wide">Luma Benefícios</p>
            <p className="text-xs text-ink-300">CRM Conversacional</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "ADMIN").map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-ink-800 text-white" : "text-ink-200 hover:bg-ink-900 hover:text-white"
                }`
              }
            >
              <item.icon size={18} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-ink-800 px-4 py-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-700 text-sm font-semibold text-white">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user?.name}</p>
              <p className="truncate text-xs text-ink-300">{user?.role === "ADMIN" ? "Administrador" : "Atendente"}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-200 transition-colors hover:bg-ink-900 hover:text-white"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex flex-shrink-0 items-center justify-end border-b border-ink-100 bg-white px-6 py-2.5">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
