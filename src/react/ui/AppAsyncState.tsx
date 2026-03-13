import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Alert, Center, Group, Loader, Stack, Text } from "@mantine/core";
import { AppButton } from "./AppButton";

type AppAsyncStateProps = {
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  loadingMessage?: ReactNode;
  showLoadingState?: boolean;
  emptyMessage?: ReactNode;
  errorTitle?: ReactNode;
  onRetry?: () => void;
  retryLabel?: ReactNode;
  children?: ReactNode;
};

export function AppAsyncState({
  loading,
  error,
  isEmpty,
  emptyMessage,
  loadingMessage = "Laster data...",
  showLoadingState = true,
  errorTitle = "Feil",
  onRetry,
  retryLabel = "Prøv igjen",
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
        <Stack gap="sm">
          <Text>{error}</Text>
          {onRetry ? (
            <Group>
              <AppButton tone="neutral" size="xs" onClick={onRetry}>
                {retryLabel}
              </AppButton>
            </Group>
          ) : null}
        </Stack>
      </Alert>
    );
  }

  if (loading && showLoading) {
    if (!showLoadingState) return null;
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
