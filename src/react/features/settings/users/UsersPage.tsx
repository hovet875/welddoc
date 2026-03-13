import { useMemo, useState, type FormEvent } from "react";
import { SimpleGrid, Text } from "@mantine/core";
import { getAccessToken } from "@/auth/authClient";
import { toast } from "@react/ui/notify";
import { supabase } from "../../../../services/supabaseClient";
import { useAuth } from "../../../auth/AuthProvider";
import { AppPageLayout } from "../../../layout/AppPageLayout";
import { AppModalActions } from "../../../ui/AppModalActions";
import { AppModal } from "../../../ui/AppModal";
import { AppPanel } from "../../../ui/AppPanel";
import { AppPasswordInput } from "../../../ui/AppPasswordInput";
import { AppSelect } from "../../../ui/AppSelect";
import { AppTextInput } from "../../../ui/AppTextInput";
import { UsersHeader } from "./components/UsersHeader";
import { UsersTable } from "./components/UsersTable";
import { useUsersData } from "./hooks/useUsersData";
import { normalizeEmail, readFunctionError, sanitizeWelderNo } from "./lib/userModalHelpers";
import type { UserRow } from "./users.types";

type UserModalMode = "create" | "edit";
type UserRole = "user" | "admin";

type UserFormState = {
  email: string;
  displayName: string;
  jobTitle: string;
  welderNo: string;
  role: UserRole;
  password: string;
  password2: string;
};

const EMPTY_USER_FORM: UserFormState = {
  email: "",
  displayName: "",
  jobTitle: "",
  welderNo: "",
  role: "user",
  password: "",
  password2: "",
};

const ROLE_OPTIONS = [
  { value: "user", label: "user" },
  { value: "admin", label: "admin" },
];

function toEditForm(user: UserRow): UserFormState {
  return {
    email: user.email ?? "",
    displayName: user.display_name ?? "",
    jobTitle: user.job_title ?? "",
    welderNo: user.welder_no ?? "",
    role: user.role === "admin" ? "admin" : "user",
    password: "",
    password2: "",
  };
}

export function UsersPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;
  const currentUserId = session?.user?.id ?? null;
  const { loading, error, rows, jobTitles, reload } = useUsersData({ enabled: isAdmin });

  const [modalOpened, setModalOpened] = useState(false);
  const [modalMode, setModalMode] = useState<UserModalMode>("create");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<UserFormState>(EMPTY_USER_FORM);

  const userCountLabel = useMemo(() => `${rows.length} stk`, [rows.length]);

  const jobTitleOptions = useMemo(() => {
    const options = jobTitles.map((jobTitle) => ({
      value: jobTitle.title,
      label: jobTitle.is_active ? jobTitle.title : `${jobTitle.title} (inaktiv)`,
      disabled: !jobTitle.is_active,
    }));

    if (form.jobTitle && !options.some((option) => option.value === form.jobTitle)) {
      options.push({ value: form.jobTitle, label: `${form.jobTitle} (ukjent)`, disabled: false });
    }

    return options;
  }, [form.jobTitle, jobTitles]);

  const closeModal = () => {
    if (submitting) return;
    setModalOpened(false);
    setModalMode("create");
    setEditingUser(null);
    setForm(EMPTY_USER_FORM);
  };

  const openAddUserModal = () => {
    setModalMode("create");
    setEditingUser(null);
    setForm(EMPTY_USER_FORM);
    setModalOpened(true);
  };

  const openEditUserModal = (user: UserRow) => {
    setModalMode("edit");
    setEditingUser(user);
    setForm(toEditForm(user));
    setModalOpened(true);
  };

  const setFormField = <K extends keyof UserFormState>(field: K, value: UserFormState[K]) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const submitModal = () => {
    if (submitting) return;

    const nextEmail = normalizeEmail(form.email);
    if (!nextEmail) {
      toast("E-post er påkrevd.");
      return;
    }
    if (!nextEmail.includes("@")) {
      toast("Ugyldig e-post.");
      return;
    }

    const password = form.password.trim();
    const password2 = form.password2.trim();

    if (modalMode === "create") {
      if (!password || password.length < 6) {
        toast("Passord må være minst 6 tegn.");
        return;
      }
      if (password !== password2) {
        toast("Passordene er ikke like.");
        return;
      }
    }

    if (modalMode === "edit" && (password || password2)) {
      if (password.length < 6) {
        toast("Passord må være minst 6 tegn.");
        return;
      }
      if (password !== password2) {
        toast("Passordene er ikke like.");
        return;
      }
    }

    void (async () => {
      try {
        setSubmitting(true);

        if (modalMode === "create") {
          const token = await getAccessToken();
          const { data, error: invokeError } = await supabase.functions.invoke("insert-user", {
            body: {
              email: nextEmail,
              display_name: form.displayName.trim() || null,
              job_title: form.jobTitle.trim() || null,
              welder_no: sanitizeWelderNo(form.welderNo),
              role: form.role,
              password,
            },
            headers: { Authorization: `Bearer ${token}` },
          });

          if (invokeError) {
            const msg = await readFunctionError(invokeError);
            throw new Error(msg);
          }
          if (data?.error) throw new Error(data.error);

          setModalOpened(false);
          setModalMode("create");
          setEditingUser(null);
          setForm(EMPTY_USER_FORM);
          await reload();
          toast("Bruker opprettet.");
          return;
        }

        if (!editingUser) return;

        const prevEmail = normalizeEmail(editingUser.email ?? "");
        if (password || nextEmail !== prevEmail) {
          const token = await getAccessToken();
          const { data, error: invokeError } = await supabase.functions.invoke("update-user", {
            body: {
              userId: editingUser.id,
              password: password || undefined,
              email: nextEmail !== prevEmail ? nextEmail : undefined,
            },
            headers: { Authorization: `Bearer ${token}` },
          });

          if (invokeError) {
            const msg = await readFunctionError(invokeError);
            throw new Error(msg);
          }
          if (data?.error) throw new Error(data.error);
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            display_name: form.displayName.trim() || null,
            job_title: form.jobTitle.trim() || null,
            welder_no: sanitizeWelderNo(form.welderNo),
            role: form.role,
          })
          .eq("id", editingUser.id);
        if (updateError) throw updateError;

        setModalOpened(false);
        setModalMode("create");
        setEditingUser(null);
        setForm(EMPTY_USER_FORM);
        await reload();
        toast("Oppdatert.");
      } catch (err: any) {
        console.error(err);
        toast(String(err?.message ?? (modalMode === "create" ? "Kunne ikke opprette bruker." : "Kunne ikke lagre.")));
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const onModalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitModal();
  };

  const toggleUser = (user: UserRow) => {
    if (!user.id) return;
    if (currentUserId === user.id) {
      toast("Du kan ikke deaktivere din egen bruker.");
      return;
    }

    void (async () => {
      try {
        const next = !(user.login_enabled ?? true);
        const { error: updateError } = await supabase.from("profiles").update({ login_enabled: next }).eq("id", user.id);
        if (updateError) throw updateError;
        await reload();
      } catch (err) {
        console.error(err);
        toast("Kunne ikke oppdatere.");
      }
    })();
  };

  if (!isAdmin) {
    return (
      <AppPageLayout pageClassName="page-users" displayName={displayName} email={email}>
        <div className="muted app-muted-block">Kun admin har tilgang.</div>
      </AppPageLayout>
    );
  }

  return (
    <AppPageLayout pageClassName="page-users" displayName={displayName} email={email}>
      <UsersHeader onRefresh={() => void reload()} onAddUser={openAddUserModal} refreshing={loading} />

      <section className="section-grid">
        <AppPanel title="Brukere" meta={userCountLabel}>
          <UsersTable
            rows={rows}
            loading={loading}
            error={error}
            currentUserId={currentUserId}
            onEdit={openEditUserModal}
            onToggle={toggleUser}
          />
        </AppPanel>
      </section>

      <AppModal
        opened={modalOpened}
        onClose={closeModal}
        title={modalMode === "create" ? "Legg til bruker" : "Endre bruker"}
        size="lg"
        busy={submitting}
      >
        <form onSubmit={onModalSubmit}>
          <AppTextInput
            label="E-post"
            type="email"
            value={form.email}
            onChange={(value) => setFormField("email", value)}
            placeholder="navn@firma.no"
            required
          />

          {modalMode === "edit" ? (
            <Text c="dimmed" size="xs" mt={4}>
              Bruker må logge inn på nytt hvis e-post endres.
            </Text>
          ) : null}

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" mt="sm">
            <AppTextInput
              label="Visningsnavn"
              value={form.displayName}
              onChange={(value) => setFormField("displayName", value)}
              placeholder="Navn"
            />

            <AppSelect
              label="Stilling"
              placeholder={jobTitleOptions.length > 0 ? "Velg stilling..." : "Ingen stillinger"}
              data={jobTitleOptions}
              value={form.jobTitle}
              clearable
              searchable
              nothingFoundMessage="Ingen treff"
              onChange={(value) => setFormField("jobTitle", value)}
            />

            <AppTextInput
              label={modalMode === "create" ? "Sveiser ID (tom for ikke-sveisere)" : "Sveiser ID"}
              value={form.welderNo}
              onChange={(value) => setFormField("welderNo", value)}
              placeholder="004"
            />

            <AppSelect
              label="Rolle"
              data={ROLE_OPTIONS}
              value={form.role}
              allowDeselect={false}
              onChange={(value) => setFormField("role", value === "admin" ? "admin" : "user")}
            />

            <AppPasswordInput
              label={modalMode === "create" ? "Passord" : "Nytt passord"}
              value={form.password}
              onChange={(value) => setFormField("password", value)}
              autoComplete="new-password"
            />

            <AppPasswordInput
              label="Gjenta passord"
              value={form.password2}
              onChange={(value) => setFormField("password2", value)}
              autoComplete="new-password"
            />
          </SimpleGrid>

          <AppModalActions
            onCancel={closeModal}
            cancelDisabled={submitting}
            confirmLabel={modalMode === "create" ? "Opprett bruker" : "Lagre"}
            confirmType="submit"
            confirmLoading={submitting}
          />
        </form>
      </AppModal>
    </AppPageLayout>
  );
}
