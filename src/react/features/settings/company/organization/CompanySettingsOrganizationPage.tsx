import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Text, Stack } from "@mantine/core";
import {
  createCustomer,
  deleteCustomer as removeCustomer,
  updateCustomer as renameCustomer,
  type CustomerRow,
} from "../../../../../repo/customerRepo";
import {
  createJobTitle,
  deleteJobTitle as removeJobTitle,
  updateJobTitle as renameJobTitle,
  type JobTitleRow,
} from "../../../../../repo/jobTitleRepo";
import {
  createNdtInspector,
  createNdtSupplier,
  deleteNdtInspector as removeNdtInspector,
  deleteNdtSupplier as removeNdtSupplier,
  updateNdtInspector as updateNdtInspectorRecord,
  updateNdtSupplier as renameNdtSupplier,
  type NdtInspectorRow,
  type NdtSupplierRow,
} from "../../../../../repo/ndtSupplierRepo";
import {
  createSupplier,
  deleteSupplier as removeSupplier,
  updateSupplier as renameSupplier,
  type SupplierRow,
} from "../../../../../repo/supplierRepo";
import { toast } from "@react/ui/notify";
import { esc } from "../../../../../utils/dom";
import { useAuth } from "../../../../auth/AuthProvider";
import { AppPageLayout } from "../../../../layout/AppPageLayout";
import { AppModalActions } from "../../../../ui/AppModalActions";
import { AppModal } from "../../../../ui/AppModal";
import { AppSelect } from "@react/ui/AppSelect";
import { AppRefreshIconButton } from "@react/ui/AppRefreshIconButton";
import { AppTextInput } from "@react/ui/AppTextInput";
import { useDeleteConfirmModal } from "@react/ui/useDeleteConfirmModal";
import { ROUTES } from "@react/router/routes";
import { CompanySettingsHeader } from "../components/CompanySettingsHeader";
import { OrganizationNdtPanel } from "./components/OrganizationNdtPanel";
import { OrganizationSimplePanel } from "./components/OrganizationSimplePanel";
import { useOrganizationData } from "./hooks/useOrganizationData";

function readErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

type OpenNameEditModalArgs = {
  title: string;
  fieldLabel: string;
  initialValue: string;
  onSave: (value: string) => Promise<void>;
  successMessage?: string;
};

type NameEditModalState = {
  opened: boolean;
  title: string;
  fieldLabel: string;
  value: string;
  successMessage: string;
  onSave: ((value: string) => Promise<void>) | null;
};

const NAME_EDIT_MODAL_INITIAL_STATE: NameEditModalState = {
  opened: false,
  title: "",
  fieldLabel: "",
  value: "",
  successMessage: "Oppdatert.",
  onSave: null,
};

type NdtInspectorEditModalState = {
  opened: boolean;
  rowId: string;
  supplierId: string;
  name: string;
};

const NDT_INSPECTOR_MODAL_INITIAL_STATE: NdtInspectorEditModalState = {
  opened: false,
  rowId: "",
  supplierId: "",
  name: "",
};

export function CompanySettingsOrganizationPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;

  const { jobTitles, customers, suppliers, ndtSuppliers, ndtInspectors, reloadAll, reloadJobTitles, reloadCustomers, reloadSuppliers, reloadNdt } =
    useOrganizationData({ enabled: isAdmin });

  const [nameEditModal, setNameEditModal] = useState<NameEditModalState>(NAME_EDIT_MODAL_INITIAL_STATE);
  const [nameEditSaving, setNameEditSaving] = useState(false);
  const [ndtInspectorModal, setNdtInspectorModal] = useState<NdtInspectorEditModalState>(
    NDT_INSPECTOR_MODAL_INITIAL_STATE
  );
  const [ndtInspectorSaving, setNdtInspectorSaving] = useState(false);
  const { confirmDelete: openDeleteConfirmModal, deleteConfirmModal } = useDeleteConfirmModal();

  const closeNameEditModal = useCallback(() => {
    setNameEditModal(NAME_EDIT_MODAL_INITIAL_STATE);
    setNameEditSaving(false);
  }, []);

  const openNameEditModal = useCallback(
    ({ title, fieldLabel, initialValue, onSave, successMessage = "Oppdatert." }: OpenNameEditModalArgs) => {
      setNameEditModal({
        opened: true,
        title,
        fieldLabel,
        value: initialValue,
        successMessage,
        onSave,
      });

    },
    []
  );

  const submitNameEditModal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const nextValue = nameEditModal.value.trim();
      if (!nextValue) {
        toast("Feltet kan ikke være tomt.");
        return;
      }
      if (!nameEditModal.onSave) return;

      try {
        setNameEditSaving(true);
        await nameEditModal.onSave(nextValue);
        closeNameEditModal();
        toast(nameEditModal.successMessage);
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere."));
      } finally {
        setNameEditSaving(false);
      }
    },
    [closeNameEditModal, nameEditModal]
  );

  const addJobTitle = useCallback(
    async (value: string) => {
      try {
        await createJobTitle(value);
        await reloadJobTitles();
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke legge til stilling."));
        throw err;
      }
    },
    [reloadJobTitles]
  );

  const addCustomer = useCallback(
    async (value: string) => {
      try {
        await createCustomer(value);
        await reloadCustomers();
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke legge til kunde."));
        throw err;
      }
    },
    [reloadCustomers]
  );

  const addSupplier = useCallback(
    async (value: string) => {
      try {
        await createSupplier(value);
        await reloadSuppliers();
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke legge til leverandør."));
        throw err;
      }
    },
    [reloadSuppliers]
  );

  const addNdtSupplier = useCallback(
    async (value: string) => {
      try {
        await createNdtSupplier(value);
        await reloadNdt();
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke legge til NDT-leverandør."));
        throw err;
      }
    },
    [reloadNdt]
  );

  const addNdtInspector = useCallback(
    async (supplierId: string, name: string) => {
      try {
        await createNdtInspector({ supplier_id: supplierId, name });
        await reloadNdt();
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke legge til kontrollør."));
        throw err;
      }
    },
    [reloadNdt]
  );

  const editJobTitle = useCallback(
    (row: JobTitleRow) => {
      openNameEditModal({
        title: "Endre stilling",
        fieldLabel: "Stilling",
        initialValue: row.title,
        onSave: async (value) => {
          await renameJobTitle(row.id, value);
          await reloadJobTitles();
        },
      });
    },
    [openNameEditModal, reloadJobTitles]
  );

  const editCustomer = useCallback(
    (row: CustomerRow) => {
      openNameEditModal({
        title: "Endre kunde",
        fieldLabel: "Kunde",
        initialValue: row.name,
        onSave: async (value) => {
          await renameCustomer(row.id, value);
          await reloadCustomers();
        },
      });
    },
    [openNameEditModal, reloadCustomers]
  );

  const editSupplier = useCallback(
    (row: SupplierRow) => {
      openNameEditModal({
        title: "Endre leverandør",
        fieldLabel: "Leverandør",
        initialValue: row.name,
        onSave: async (value) => {
          await renameSupplier(row.id, value);
          await reloadSuppliers();
        },
      });
    },
    [openNameEditModal, reloadSuppliers]
  );

  const editNdtSupplier = useCallback(
    (row: NdtSupplierRow) => {
      openNameEditModal({
        title: "Endre NDT-leverandør",
        fieldLabel: "NDT-leverandør",
        initialValue: row.name,
        onSave: async (value) => {
          await renameNdtSupplier(row.id, value);
          await reloadNdt();
        },
      });
    },
    [openNameEditModal, reloadNdt]
  );

  const editNdtInspector = useCallback(
    (row: NdtInspectorRow) => {
      setNdtInspectorModal({
        opened: true,
        rowId: row.id,
        supplierId: row.supplier_id ?? "",
        name: row.name,
      });

    },
    []
  );

  const closeNdtInspectorModal = useCallback(() => {
    setNdtInspectorModal(NDT_INSPECTOR_MODAL_INITIAL_STATE);
    setNdtInspectorSaving(false);
  }, []);

  const submitNdtInspectorModal = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const supplierId = ndtInspectorModal.supplierId.trim();
      const name = ndtInspectorModal.name.trim();

      if (!supplierId) {
        toast("Velg leverandør.");
        return;
      }
      if (!name) {
        toast("Skriv inn kontrollør.");
        return;
      }
      if (!ndtInspectorModal.rowId) return;

      try {
        setNdtInspectorSaving(true);
        await updateNdtInspectorRecord(ndtInspectorModal.rowId, { supplier_id: supplierId, name });
        await reloadNdt();
        closeNdtInspectorModal();
        toast("Oppdatert.");
      } catch (err) {
        console.error(err);
        toast(readErrorMessage(err, "Kunne ikke oppdatere kontrollør."));
      } finally {
        setNdtInspectorSaving(false);
      }
    },
    [closeNdtInspectorModal, ndtInspectorModal, reloadNdt]
  );

  const confirmDelete = useCallback(
    (title: string, messageHtml: string, onConfirm: () => Promise<void>, onDone: () => Promise<void>) => {
      openDeleteConfirmModal({
        title,
        messageHtml,
        onConfirm,
        onDone,
      });
    },
    [openDeleteConfirmModal]
  );

  const deleteJobTitle = useCallback(
    (row: JobTitleRow) => {
      confirmDelete(
        "Slett stilling",
        `Er du sikker på at du vil slette <b>${esc(row.title)}</b>?`,
        async () => {
          await removeJobTitle(row.id);
        },
        async () => {
          await reloadJobTitles();
          toast("Stilling slettet.");
        }
      );
    },
    [confirmDelete, reloadJobTitles]
  );

  const deleteCustomer = useCallback(
    (row: CustomerRow) => {
      confirmDelete(
        "Slett kunde",
        `Er du sikker på at du vil slette <b>${esc(row.name)}</b>?`,
        async () => {
          await removeCustomer(row.id);
        },
        async () => {
          await reloadCustomers();
          toast("Kunde slettet.");
        }
      );
    },
    [confirmDelete, reloadCustomers]
  );

  const deleteSupplier = useCallback(
    (row: SupplierRow) => {
      confirmDelete(
        "Slett leverandør",
        `Er du sikker på at du vil slette <b>${esc(row.name)}</b>?`,
        async () => {
          await removeSupplier(row.id);
        },
        async () => {
          await reloadSuppliers();
          toast("Leverandør slettet.");
        }
      );
    },
    [confirmDelete, reloadSuppliers]
  );

  const deleteNdtSupplier = useCallback(
    (row: NdtSupplierRow) => {
      confirmDelete(
        "Slett NDT-leverandør",
        `Er du sikker på at du vil slette <b>${esc(row.name)}</b>? Kontrollører blir også slettet.`,
        async () => {
          await removeNdtSupplier(row.id);
        },
        async () => {
          await reloadNdt();
          toast("NDT-leverandør slettet.");
        }
      );
    },
    [confirmDelete, reloadNdt]
  );

  const deleteNdtInspector = useCallback(
    (row: NdtInspectorRow) => {
      confirmDelete(
        "Slett kontrollør",
        `Er du sikker på at du vil slette <b>${esc(row.name)}</b>?`,
        async () => {
          await removeNdtInspector(row.id);
        },
        async () => {
          await reloadNdt();
          toast("Kontrollør slettet.");
        }
      );
    },
    [confirmDelete, reloadNdt]
  );

  const ndtSupplierOptions = useMemo(
    () =>
      ndtSuppliers.rows.map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
      })),
    [ndtSuppliers.rows]
  );

  const isRefreshing = useMemo(
    () =>
      jobTitles.loading ||
      customers.loading ||
      suppliers.loading ||
      ndtSuppliers.loading ||
      ndtInspectors.loading,
    [customers.loading, jobTitles.loading, ndtInspectors.loading, ndtSuppliers.loading, suppliers.loading]
  );

  if (!isAdmin) {
    return (
      <AppPageLayout pageClassName="page-company-settings" displayName={displayName} email={email}>
          <CompanySettingsHeader
            title="App-parametere - Organisasjon"
            subtitle="Kun admin har tilgang."
            backTo={ROUTES.settingsCompany}
            backLabel="← App-parametere"
          />
          <div className="muted app-muted-block">
            Kun admin har tilgang.
          </div>
      </AppPageLayout>
    );
  }

  return (
    <AppPageLayout pageClassName="page-company-settings" displayName={displayName} email={email}>
      <CompanySettingsHeader
          title="App-parametere - Organisasjon"
          subtitle="Stillinger, kunder, leverandører og NDT-kontrollører."
          backTo={ROUTES.settingsCompany}
          backLabel="← App-parametere"
          actions={
            <AppRefreshIconButton
              onClick={() => void reloadAll()}
              disabled={isRefreshing}
              loading={isRefreshing}
            />
          }
        />

        <Stack gap="md">
          <OrganizationSimplePanel
            title="Stillinger"
            inputPlaceholder="Ny stilling..."
            addLabel="Legg til"
            helperText="Stillinger brukes i brukerprofil."
            emptyText="Ingen stillinger."
            listState={jobTitles}
            getRowTitle={(row) => row.title}
            onAdd={addJobTitle}
            onEdit={editJobTitle}
            onDelete={deleteJobTitle}
          />

          <OrganizationSimplePanel
            title="Kunder"
            inputPlaceholder="Ny kunde..."
            addLabel="Legg til"
            emptyText="Ingen kunder."
            listState={customers}
            getRowTitle={(row) => row.name}
            onAdd={addCustomer}
            onEdit={editCustomer}
            onDelete={deleteCustomer}
          />

          <OrganizationSimplePanel
            title="Leverandører"
            inputPlaceholder="Ny leverandør..."
            addLabel="Legg til"
            emptyText="Ingen leverandører."
            listState={suppliers}
            getRowTitle={(row) => row.name}
            onAdd={addSupplier}
            onEdit={editSupplier}
            onDelete={deleteSupplier}
          />

          <OrganizationNdtPanel
            suppliersState={ndtSuppliers}
            inspectorsState={ndtInspectors}
            onAddSupplier={addNdtSupplier}
            onAddInspector={addNdtInspector}
            onEditSupplier={editNdtSupplier}
            onDeleteSupplier={deleteNdtSupplier}
            onEditInspector={editNdtInspector}
            onDeleteInspector={deleteNdtInspector}
          />
        </Stack>

        <AppModal
          opened={nameEditModal.opened}
          onClose={closeNameEditModal}
          title={nameEditModal.title}
          busy={nameEditSaving}
        >
          <form onSubmit={submitNameEditModal}>
            <AppTextInput
              label={nameEditModal.fieldLabel}
              value={nameEditModal.value}
              onChange={(nextValue) => {
                setNameEditModal((current) => ({
                  ...current,
                  value: nextValue,
                }));
              }}
              autoFocus
            />
            <AppModalActions
              onCancel={closeNameEditModal}
              cancelDisabled={nameEditSaving}
              confirmLabel="Lagre"
              confirmType="submit"
              confirmLoading={nameEditSaving}
            />
          </form>
        </AppModal>

        <AppModal
          opened={ndtInspectorModal.opened}
          onClose={closeNdtInspectorModal}
          title="Endre kontrollør"
          busy={ndtInspectorSaving}
        >
          <form onSubmit={submitNdtInspectorModal}>
            <AppSelect
              label="Leverandør"
              placeholder={ndtSupplierOptions.length > 0 ? "Velg leverandør..." : "Ingen leverandører"}
              data={ndtSupplierOptions}
              value={ndtInspectorModal.supplierId}
              onChange={(value) =>
                setNdtInspectorModal((current) => ({
                  ...current,
                  supplierId: value,
                }))
              }
              allowDeselect={false}
              searchable={ndtSupplierOptions.length > 8}
              nothingFoundMessage="Ingen treff"
            />

            <AppTextInput
              mt="sm"
              label="Kontrollør"
              value={ndtInspectorModal.name}
              onChange={(nextValue) => {
                setNdtInspectorModal((current) => ({
                  ...current,
                  name: nextValue,
                }));
              }}
            />

            {ndtSupplierOptions.length === 0 ? (
              <Text c="dimmed" size="sm" mt="xs">
                Legg til minst én leverandør før du redigerer kontrollør.
              </Text>
            ) : null}

            <AppModalActions
              onCancel={closeNdtInspectorModal}
              cancelDisabled={ndtInspectorSaving}
              confirmLabel="Lagre"
              confirmType="submit"
              confirmLoading={ndtInspectorSaving}
            />
          </form>
        </AppModal>

        {deleteConfirmModal}
    </AppPageLayout>
  );
}
