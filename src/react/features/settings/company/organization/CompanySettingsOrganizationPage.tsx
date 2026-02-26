import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { openConfirmDelete } from "../../../../../ui/confirm";
import { modalSaveButton, openModal, renderModal } from "../../../../../ui/modal";
import { toast } from "../../../../../ui/toast";
import { esc } from "../../../../../utils/dom";
import { useAuth } from "../../../../auth/AuthProvider";
import { AppFooter } from "../../../../layout/AppFooter";
import { AppHeader } from "../../../../layout/AppHeader";
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

export function CompanySettingsOrganizationPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;

  const { jobTitles, customers, suppliers, ndtSuppliers, ndtInspectors, reloadAll, reloadJobTitles, reloadCustomers, reloadSuppliers, reloadNdt } =
    useOrganizationData({ enabled: isAdmin });

  const modalMountRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => {
      controller.abort();
      controllerRef.current = null;
    };
  }, []);

  const openNameEditModal = useCallback(
    ({ title, fieldLabel, initialValue, onSave, successMessage = "Oppdatert." }: OpenNameEditModalArgs) => {
      const mount = modalMountRef.current;
      const signal = controllerRef.current?.signal;
      if (!mount || !signal) return;

      const modalHtml = renderModal(
        title,
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>${esc(fieldLabel)}</label>
              <input data-f="value" class="input" type="text" value="${esc(initialValue)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const handle = openModal(mount, modalHtml, signal);
      const save = modalSaveButton(handle.root);

      save.addEventListener(
        "click",
        async () => {
          try {
            save.disabled = true;
            save.textContent = "Lagrer...";

            const input = handle.root.querySelector<HTMLInputElement>("[data-f=value]");
            const nextValue = (input?.value ?? "").trim();
            if (!nextValue) {
              toast("Feltet kan ikke være tomt.");
              return;
            }

            await onSave(nextValue);
            handle.close();
            toast(successMessage);
          } catch (err) {
            console.error(err);
            toast(readErrorMessage(err, "Kunne ikke oppdatere."));
          } finally {
            save.disabled = false;
            save.textContent = "Lagre";
          }
        },
        { signal }
      );
    },
    []
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
      const mount = modalMountRef.current;
      const signal = controllerRef.current?.signal;
      if (!mount || !signal) return;

      const supplierOptions = [
        `<option value="">Velg leverandør...</option>`,
        ...ndtSuppliers.rows.map((supplier) => {
          const selected = supplier.id === row.supplier_id ? "selected" : "";
          return `<option value="${esc(supplier.id)}" ${selected}>${esc(supplier.name)}</option>`;
        }),
      ].join("");

      const modalHtml = renderModal(
        "Endre kontrollør",
        `
          <div class="modalgrid">
            <div class="field" style="grid-column:1 / -1;">
              <label>Leverandør</label>
              <select data-f="supplier_id" class="select">${supplierOptions}</select>
            </div>
            <div class="field" style="grid-column:1 / -1;">
              <label>Kontrollør</label>
              <input data-f="name" class="input" type="text" value="${esc(row.name)}" />
            </div>
          </div>
        `,
        "Lagre"
      );

      const handle = openModal(mount, modalHtml, signal);
      const save = modalSaveButton(handle.root);

      save.addEventListener(
        "click",
        async () => {
          try {
            save.disabled = true;
            save.textContent = "Lagrer...";

            const supplierId =
              (handle.root.querySelector<HTMLSelectElement>("[data-f=supplier_id]")?.value ?? "").trim();
            const name = (handle.root.querySelector<HTMLInputElement>("[data-f=name]")?.value ?? "").trim();

            if (!supplierId) {
              toast("Velg leverandør.");
              return;
            }
            if (!name) {
              toast("Skriv inn kontrollør.");
              return;
            }

            await updateNdtInspectorRecord(row.id, { supplier_id: supplierId, name });
            await reloadNdt();
            handle.close();
            toast("Oppdatert.");
          } catch (err) {
            console.error(err);
            toast(readErrorMessage(err, "Kunne ikke oppdatere kontrollør."));
          } finally {
            save.disabled = false;
            save.textContent = "Lagre";
          }
        },
        { signal }
      );
    },
    [ndtSuppliers.rows, reloadNdt]
  );

  const confirmDelete = useCallback(
    (title: string, messageHtml: string, onConfirm: () => Promise<void>, onDone: () => Promise<void>) => {
      const mount = modalMountRef.current;
      const signal = controllerRef.current?.signal;
      if (!mount || !signal) return;

      void openConfirmDelete(mount, signal, { title, messageHtml, onConfirm, onDone });
    },
    []
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
      <div className="shell page-company-settings">
        <AppHeader displayName={displayName} email={email} />
        <main className="main">
          <CompanySettingsHeader
            title="App-parametere - Organisasjon"
            subtitle="Kun admin har tilgang."
            backTo="/settings/company"
            backLabel="← App-parametere"
          />
          <div className="muted" style={{ padding: 16 }}>
            Kun admin har tilgang.
          </div>
        </main>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="shell page-company-settings">
      <AppHeader displayName={displayName} email={email} />

      <main className="main">
        <CompanySettingsHeader
          title="App-parametere - Organisasjon"
          subtitle="Stillinger, kunder, leverandører og NDT-kontrollører."
          backTo="/settings/company"
          backLabel="← App-parametere"
          actions={
            <button className="btn small" type="button" disabled={isRefreshing} onClick={() => void reloadAll()}>
              Oppdater
            </button>
          }
        />

        <section className="section-grid">
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
        </section>

        <div ref={modalMountRef}></div>
      </main>

      <AppFooter />
    </div>
  );
}
