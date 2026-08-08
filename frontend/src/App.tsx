import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Inbox } from "./pages/Inbox";
import { Funil } from "./pages/Funil";
import { Clientes } from "./pages/Clientes";
import { Automacoes } from "./pages/Automacoes";
import { FollowUps } from "./pages/FollowUps";
import { MensagensAgendadas } from "./pages/MensagensAgendadas";
import { Etiquetas } from "./pages/Etiquetas";
import { Cobranca } from "./pages/Cobranca";
import { Servicos } from "./pages/Servicos";
import { Usuarios } from "./pages/Usuarios";
import { Configuracoes } from "./pages/Configuracoes";
import { Documentacao } from "./pages/Documentacao";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/funil" element={<Funil />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/automacoes" element={<Automacoes />} />
        <Route path="/followups" element={<FollowUps />} />
        <Route path="/agendadas" element={<MensagensAgendadas />} />
        <Route path="/etiquetas" element={<Etiquetas />} />
        <Route path="/cobranca" element={<Cobranca />} />
        <Route path="/servicos" element={<Servicos />} />
        <Route path="/documentacao" element={<Documentacao />} />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute adminOnly>
              <Usuarios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <ProtectedRoute adminOnly>
              <Configuracoes />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
