import { Navigate, Outlet } from "react-router-dom";
import { Center, Loader, Stack, Text } from "@mantine/core";
import { useAuth } from "../auth/AuthProvider";

function LoadingScreen() {
  return (
    <Center mih="100vh">
      <Stack align="center" gap="xs">
        <Loader size="sm" />
        <Text c="dimmed">Laster...</Text>
      </Stack>
    </Center>
  );
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