import { useState } from "react";
import { Group, Stack, Text } from "@mantine/core";
import { toast } from "@react/ui/notify";
import type { OrganizationListState } from "../organization.types";
import { OrganizationCollapsiblePanel } from "./OrganizationCollapsiblePanel";
import { OrganizationListItem } from "./OrganizationListItem";
import { AppActionsMenu, createDeleteAction, createEditAction } from "@react/ui/AppActionsMenu";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppButton } from "@react/ui/AppButton";
import { AppTextInput } from "@react/ui/AppTextInput";

type OrganizationSimplePanelProps<T extends { id: string }> = {
  title: string;
  inputPlaceholder: string;
  addLabel: string;
  helperText?: string;
  emptyText: string;
  listState: OrganizationListState<T>;
  getRowTitle: (row: T) => string;
  onAdd: (value: string) => Promise<void>;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
};

export function OrganizationSimplePanel<T extends { id: string }>({
  title,
  inputPlaceholder,
  addLabel,
  helperText,
  emptyText,
  listState,
  getRowTitle,
  onAdd,
  onEdit,
  onDelete,
}: OrganizationSimplePanelProps<T>) {
  const [inputValue, setInputValue] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    const value = inputValue.trim();
    if (!value) {
      toast("Skriv inn navn.");
      return;
    }

    setAdding(true);
    try {
      await onAdd(value);
      setInputValue("");
    } catch {
      // onAdd handles user-facing errors.
    } finally {
      setAdding(false);
    }
  };

  return (
    <OrganizationCollapsiblePanel title={title} meta="Admin">
      <Stack gap="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <AppTextInput
            style={{ flex: 1, minWidth: "16rem" }}
            placeholder={inputPlaceholder}
            value={inputValue}
            onChange={setInputValue}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void handleAdd();
            }}
          />
          <AppButton tone="primary" size="sm" disabled={adding} onClick={() => void handleAdd()}>
            {addLabel}
          </AppButton>
        </Group>

        {helperText ? (
          <Text c="dimmed" size="sm">
            {helperText}
          </Text>
        ) : null}

        <AppAsyncState
          loading={listState.loading}
          error={listState.error}
          isEmpty={listState.rows.length === 0}
          emptyMessage={emptyText}
        >
          <Stack gap="sm">
            {listState.rows.map((row) => (
              <OrganizationListItem
                key={row.id}
                title={getRowTitle(row)}
                actions={
                  <AppActionsMenu
                    items={[
                      createEditAction({
                        onClick: () => onEdit(row),
                      }),
                      createDeleteAction({
                        onClick: () => onDelete(row),
                      }),
                    ]}
                  />
                }
              />
            ))}
          </Stack>
        </AppAsyncState>
      </Stack>
    </OrganizationCollapsiblePanel>
  );
}
