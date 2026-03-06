import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Alert, Text, Center, Stack, Loader } from "@mantine/core";

type AppAsyncStateProps = {
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  loadingMessage?: ReactNode;
  emptyMessage?: ReactNode;
  errorTitle?: ReactNode;
  children?: ReactNode;
};

export function AppAsyncState({
  loading,
  error,
  isEmpty,
  emptyMessage,
  loadingMessage = "Laster data...",
  errorTitle = "Feil",
  children,
}: AppAsyncStateProps) {
  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShowLoading(false);
      return;
    }
    const t = window.setTimeout(() => setShowLoading(true), 250);
    return () => window.clearTimeout(t);
  }, [loading]);

  if (error) {
    return (
      <Alert color="red" variant="light" title={errorTitle}>
        {error}
      </Alert>
    );
  }

  if (loading && showLoading) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs">
        <Loader size="sm" />
        <Text c="dimmed">{loadingMessage}</Text>
      </Stack>
    </Center>
  );
}
 if (loading) return null;

  if (isEmpty) {
    return emptyMessage ? <Text c="dimmed">{emptyMessage}</Text> : null;
  }

  return <>{children}</>;
}
