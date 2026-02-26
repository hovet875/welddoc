import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

function LoadingScreen() {
  return <div style={{ padding: 16 }} className="muted">Laster...</div>;
}

export function RequireAuthRoute() {
  const { status } = useAuth();

  if (status === "loading") return <LoadingScreen />;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { status } = useAuth();

  if (status === "loading") return <LoadingScreen />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <Outlet />;
}
