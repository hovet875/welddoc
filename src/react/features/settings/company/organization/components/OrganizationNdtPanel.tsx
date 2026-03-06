import { useEffect, useMemo, useState } from "react";
import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { NdtInspectorRow, NdtSupplierRow } from "../../../../../../repo/ndtSupplierRepo";
import { toast } from "@react/ui/notify";
import { AppActionsMenu, createDeleteAction, createEditAction } from "@react/ui/AppActionsMenu";
import { AppAsyncState } from "@react/ui/AppAsyncState";
import { AppButton } from "@react/ui/AppButton";
import { AppNativeSelect } from "@react/ui/AppNativeSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import type { OrganizationListState } from "../organization.types";
import { OrganizationCollapsiblePanel } from "./OrganizationCollapsiblePanel";
import { OrganizationListItem } from "./OrganizationListItem";

type OrganizationNdtPanelProps = {
  suppliersState: OrganizationListState<NdtSupplierRow>;
  inspectorsState: OrganizationListState<NdtInspectorRow>;
  onAddSupplier: (name: string) => Promise<void>;
  onAddInspector: (supplierId: string, name: string) => Promise<void>;
  onEditSupplier: (supplier: NdtSupplierRow) => void;
  onDeleteSupplier: (supplier: NdtSupplierRow) => void;
  onEditInspector: (inspector: NdtInspectorRow) => void;
  onDeleteInspector: (inspector: NdtInspectorRow) => void;
};

export function OrganizationNdtPanel({
  suppliersState,
  inspectorsState,
  onAddSupplier,
  onAddInspector,
  onEditSupplier,
  onDeleteSupplier,
  onEditInspector,
  onDeleteInspector,
}: OrganizationNdtPanelProps) {
  const [supplierInput, setSupplierInput] = useState("");
  const [inspectorInput, setInspectorInput] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [addingInspector, setAddingInspector] = useState(false);

  const suppliers = suppliersState.rows;
  const inspectors = inspectorsState.rows;

  useEffect(() => {
    if (suppliers.length === 0) {
      setSelectedSupplierId("");
      return;
    }

    if (!suppliers.some((supplier) => supplier.id === selectedSupplierId)) {
      setSelectedSupplierId(suppliers[0].id);
    }
  }, [selectedSupplierId, suppliers]);

  const inspectorsBySupplier = useMemo(() => {
    const map = new Map<string, NdtInspectorRow[]>();
    for (const supplier of suppliers) map.set(supplier.id, []);
    for (const inspector of inspectors) {
      const rows = map.get(inspector.supplier_id);
      if (!rows) continue;
      rows.push(inspector);
    }
    return map;
  }, [inspectors, suppliers]);

  const handleAddSupplier = async () => {
    const name = supplierInput.trim();
    if (!name) {
      toast("Skriv inn NDT-leverandør.");
      return;
    }

    setAddingSupplier(true);
    try {
      await onAddSupplier(name);
      setSupplierInput("");
    } catch {
      // Parent callback handles errors/toasts.
    } finally {
      setAddingSupplier(false);
    }
  };

  const handleAddInspector = async () => {
    const supplierId = selectedSupplierId.trim();
    const name = inspectorInput.trim();

    if (!supplierId) {
      toast("Velg NDT-leverandør.");
      return;
    }
    if (!name) {
      toast("Skriv inn kontrollør.");
      return;
    }

    setAddingInspector(true);
    try {
      await onAddInspector(supplierId, name);
      setInspectorInput("");
      setSelectedSupplierId(supplierId);
    } catch {
      // Parent callback handles errors/toasts.
    } finally {
      setAddingInspector(false);
    }
  };

  const isLoading = suppliersState.loading || inspectorsState.loading;
  const error = suppliersState.error ?? inspectorsState.error;

  return (
    <OrganizationCollapsiblePanel title="NDT-leverandører og kontrollører" meta="Admin">
      <Stack gap="md">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <AppTextInput
            style={{ flex: 1, minWidth: "16rem" }}
            placeholder="Ny NDT-leverandør..."
            value={supplierInput}
            onChange={setSupplierInput}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void handleAddSupplier();
            }}
          />
          <AppButton tone="primary" size="sm" disabled={addingSupplier} onClick={() => void handleAddSupplier()}>
            Legg til leverandør
          </AppButton>
        </Group>

        <Group align="flex-end" gap="sm" wrap="wrap">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" style={{ flex: 1, minWidth: "20rem" }}>
            <AppNativeSelect value={selectedSupplierId} onChange={setSelectedSupplierId}>
              <option value="">Velg leverandør...</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </AppNativeSelect>
            <AppTextInput
              placeholder="Ny kontrollør..."
              value={inspectorInput}
              onChange={setInspectorInput}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void handleAddInspector();
              }}
            />
          </SimpleGrid>
          <AppButton tone="primary" size="sm" disabled={addingInspector} onClick={() => void handleAddInspector()}>
            Legg til kontrollør
          </AppButton>
        </Group>

        <AppAsyncState
          loading={isLoading}
          error={error}
          isEmpty={suppliers.length === 0}
          emptyMessage="Ingen NDT-leverandører."
        >
          <Stack gap="md">
            {suppliers.map((supplier) => {
              const supplierInspectors = inspectorsBySupplier.get(supplier.id) ?? [];

              return (
                <Box key={supplier.id}>
                  <Stack gap="xs">
                    <OrganizationListItem
                      title={supplier.name}
                      meta={`${supplierInspectors.length} kontrollører`}
                      actions={
                        <AppActionsMenu
                          items={[
                            createEditAction({
                              key: "edit-supplier",
                              onClick: () => onEditSupplier(supplier),
                            }),
                            createDeleteAction({
                              key: "delete-supplier",
                              onClick: () => onDeleteSupplier(supplier),
                            }),
                          ]}
                        />
                      }
                    />

                    {supplierInspectors.length === 0 ? (
                      <Text c="dimmed" size="sm" pl="md">
                        Ingen kontrollører.
                      </Text>
                    ) : (
                      <Stack gap="xs" pl="md">
                        {supplierInspectors.map((inspector) => (
                          <OrganizationListItem
                            key={inspector.id}
                            title={inspector.name}
                            meta="Kontrollør"
                            actions={
                              <AppActionsMenu
                                items={[
                                  createEditAction({
                                    key: "edit-inspector",
                                    onClick: () => onEditInspector(inspector),
                                  }),
                                  createDeleteAction({
                                    key: "delete-inspector",
                                    onClick: () => onDeleteInspector(inspector),
                                  }),
                                ]}
                              />
                            }
                          />
                        ))}
                      </Stack>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </AppAsyncState>
      </Stack>
    </OrganizationCollapsiblePanel>
  );
}
