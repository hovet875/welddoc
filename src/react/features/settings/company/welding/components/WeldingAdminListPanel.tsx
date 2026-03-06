import type { ReactNode } from "react";
import { Stack, Text } from "@mantine/core";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { WeldingCollapsiblePanel } from "./WeldingCollapsiblePanel";

type WeldingAdminListPanelProps<T extends { id: string }> = {
  title: string;
  meta?: string;
  helperText?: ReactNode;
  form: ReactNode;
  listState: {
    loading: boolean;
    error: string | null;
    rows: T[];
  };
  emptyMessage: ReactNode;
  renderItem: (row: T) => ReactNode;
};

export function WeldingAdminListPanel<T extends { id: string }>({
  title,
  meta = "Admin",
  helperText,
  form,
  listState,
  emptyMessage,
  renderItem,
}: WeldingAdminListPanelProps<T>) {
  return (
    <WeldingCollapsiblePanel title={title} meta={meta}>
      <Stack gap="md">
        {form}
        {helperText ? (
          <Text c="dimmed" size="sm">
            {helperText}
          </Text>
        ) : null}
        <AppAsyncState
          loading={listState.loading}
          error={listState.error}
          isEmpty={listState.rows.length === 0}
          emptyMessage={emptyMessage}
        >
          <Stack gap="sm">{listState.rows.map((row) => renderItem(row))}</Stack>
        </AppAsyncState>
      </Stack>
    </WeldingCollapsiblePanel>
  );
}
