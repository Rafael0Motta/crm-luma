import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { LoadingState } from "./ui";

export function ProtectedRoute({ children, adminOnly }: { children: ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "ADMIN") return <Navigate to="/" replace />;

  return <>{children}</>;
}
