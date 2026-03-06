import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Group, SimpleGrid, Text } from "@mantine/core";
import { createCustomer } from "@/repo/customerRepo";
import { createProject, updateProject } from "@/repo/projectRepo";
import { AppButton } from "@react/ui/AppButton";
import { AppModal } from "@react/ui/AppModal";
import { AppModalActions } from "@react/ui/AppModalActions";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";
import { toast } from "@react/ui/notify";
import { validateProjectForm } from "../lib/projectValidation";
import type { CustomerRow, ProjectFormValues, ProjectRow, ProjectsModalMode } from "../projects.types";

type ProjectFormModalProps = {
  opened: boolean;
  mode: ProjectsModalMode;
  row: ProjectRow | null;
  customers: CustomerRow[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onCustomersRefresh: () => Promise<void>;
};

const EMPTY_FORM: ProjectFormValues = {
  projectNo: "",
  workOrder: "",
  customer: "",
  name: "",
  isActive: true,
};

function toFormValues(row: ProjectRow | null): ProjectFormValues {
  if (!row) return EMPTY_FORM;
  return {
    projectNo: String(row.project_no ?? ""),
    workOrder: row.work_order ?? "",
    customer: row.customer ?? "",
    name: row.name ?? "",
    isActive: row.is_active,
  };
}

export function ProjectFormModal({
  opened,
  mode,
  row,
  customers,
  onClose,
  onSaved,
  onCustomersRefresh,
}: ProjectFormModalProps) {
  const [form, setForm] = useState<ProjectFormValues>(EMPTY_FORM);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setForm(toFormValues(row));
    setNewCustomerName("");
    setCreatingCustomer(false);
    setSubmitting(false);
  }, [opened, row]);

  const customerOptions = useMemo(() => {
    const options = customers
      .map((customer) => customer.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: name }));

    if (form.customer && form.customer !== "__new__" && !options.some((option) => option.value === form.customer)) {
      options.push({ value: form.customer, label: form.customer });
    }

    options.push({ value: "__new__", label: "Ny kunde…" });
    return options;
  }, [customers, form.customer]);

  const setField = <K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const createNewCustomer = () => {
    if (creatingCustomer) return;

    const name = newCustomerName.trim();
    if (!name) {
      toast("Skriv inn kundenavn.");
      return;
    }

    void (async () => {
      try {
        setCreatingCustomer(true);
        await createCustomer(name);
        await onCustomersRefresh();
        setField("customer", name);
        setNewCustomerName("");
        toast("Kunde opprettet.");
      } catch (err: any) {
        console.error(err);
        toast(String(err?.message ?? "Kunne ikke opprette kunde."));
      } finally {
        setCreatingCustomer(false);
      }
    })();
  };

  const submit = () => {
    if (submitting) return;

    void (async () => {
      try {
        setSubmitting(true);
        const payload = validateProjectForm(form);

        if (mode === "new") {
          await createProject(payload);
        } else if (row) {
          await updateProject(row.id, payload);
        }

        onClose();
        await onSaved();
        toast(mode === "new" ? "Prosjekt opprettet." : "Prosjekt oppdatert.");
      } catch (err: any) {
        console.error(err);
        toast(String(err?.message ?? "Kunne ikke lagre prosjekt."));
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={mode === "new" ? "Nytt prosjekt" : "Endre prosjekt"}
      size="lg"
      busy={submitting || creatingCustomer}
    >
      <form onSubmit={onSubmit}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <AppTextInput
            label="Prosjektnr"
            type="number"
            min={1}
            max={10000}
            step={1}
            value={form.projectNo}
            onChange={(value) => setField("projectNo", value)}
            placeholder="1"
            required
          />

          <AppTextInput
            label="Arbeidsordre"
            value={form.workOrder}
            onChange={(value) => setField("workOrder", value)}
            placeholder="AO-nummer"
            required
          />

          <AppTextInput
            label="Navn"
            value={form.name}
            onChange={(value) => setField("name", value)}
            placeholder="Prosjektnavn"
            required
          />

          <AppSelect
            label="Kunde"
            value={form.customer}
            data={customerOptions}
            onChange={(value) => setField("customer", value)}
            searchable
            nothingFoundMessage="Ingen treff"
            required
          />

          <AppSelect
            label="Status"
            value={form.isActive ? "true" : "false"}
            data={[
              { value: "true", label: "Aktiv" },
              { value: "false", label: "Inaktiv" },
            ]}
            onChange={(value) => setField("isActive", value !== "false")}
            allowDeselect={false}
          />
        </SimpleGrid>

        {form.customer === "__new__" ? (
          <Group mt="sm" align="end" wrap="nowrap">
            <AppTextInput
              label="Ny kunde"
              value={newCustomerName}
              onChange={setNewCustomerName}
              placeholder="Kundenavn"
            />
            <AppButton onClick={createNewCustomer} loading={creatingCustomer} disabled={submitting}>
              Opprett kunde
            </AppButton>
          </Group>
        ) : null}

        {form.customer === "__new__" ? (
          <Text c="dimmed" size="xs" mt="xs">
            Opprett kunde først, og velg den deretter i feltet.
          </Text>
        ) : null}

        <AppModalActions
          cancelLabel="Avbryt"
          confirmLabel={mode === "new" ? "Lagre" : "Oppdater"}
          onCancel={onClose}
          onConfirm={submit}
          cancelDisabled={submitting || creatingCustomer}
          confirmLoading={submitting}
        />
      </form>
    </AppModal>
  );
}
