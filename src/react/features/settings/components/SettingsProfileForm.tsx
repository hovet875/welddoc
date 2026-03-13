import { useEffect, useMemo } from "react";
import { Alert, Group, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import type { JobTitleRow } from "../../../../repo/jobTitleRepo";
import type { SettingsFormState } from "../settings.types";
import { AppButton } from "@react/ui/AppButton";
import { AppPanel } from "@react/ui/AppPanel";
import { AppSelect } from "@react/ui/AppSelect";
import { AppTextInput } from "@react/ui/AppTextInput";

type SettingsProfileFormProps = {
  isAdmin: boolean;
  email: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
  canSave: boolean;
  resettingPassword: boolean;
  jobTitles: JobTitleRow[];
  form: SettingsFormState;
  onDisplayNameChange: (value: string) => void;
  onJobTitleChange: (value: string) => void;
  onWelderNoChange: (value: string) => void;
  onRetry: () => void;
  onSave: () => void;
  onResetPassword: () => void;
};

export function SettingsProfileForm({
  isAdmin,
  email,
  loading,
  saving,
  error,
  saveError,
  canSave,
  resettingPassword,
  jobTitles,
  form,
  onDisplayNameChange,
  onJobTitleChange,
  onWelderNoChange,
  onRetry,
  onSave,
  onResetPassword,
}: SettingsProfileFormProps) {
  const disabled = !isAdmin || loading || saving || !canSave;

  const profileForm = useForm<SettingsFormState>({
    initialValues: form,
  });

  useEffect(() => {
    profileForm.setValues(form);
  }, [form.displayName, form.jobTitle, form.welderNo]);

  const jobTitleOptions = useMemo(
    () =>
      jobTitles.map((jobTitle) => ({
        value: jobTitle.title,
        label: jobTitle.is_active ? jobTitle.title : `${jobTitle.title} (inaktiv)`,
        disabled: !jobTitle.is_active,
      })),
    [jobTitles]
  );

  return (
    <AppPanel title="Brukerinfo" meta={isAdmin ? "Admin" : "Les"}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isAdmin) return;
          onSave();
        }}
      >
        <Stack gap="md">
          {error ? (
            <Alert color="red" variant="light" title="Kunne ikke laste brukerprofil">
              <Stack gap="sm">
                <span>{error}</span>
                <Group>
                  <AppButton size="xs" onClick={onRetry} disabled={loading || saving}>
                    Prøv igjen
                  </AppButton>
                </Group>
              </Stack>
            </Alert>
          ) : null}

          {saveError && !error ? (
            <Alert color="red" variant="light" title="Kunne ikke lagre profil">
              <Stack gap="sm">
                <span>{saveError}</span>
                <Group>
                  <AppButton size="xs" onClick={onSave} disabled={loading || saving || !canSave}>
                    Prøv å lagre igjen
                  </AppButton>
                </Group>
              </Stack>
            </Alert>
          ) : null}

          <AppTextInput
            label="Visningsnavn"
            value={profileForm.values.displayName}
            disabled={disabled}
            onChange={(value) => {
              profileForm.setFieldValue("displayName", value);
              onDisplayNameChange(value);
            }}
          />

          <AppTextInput label="E-post" type="email" value={email} disabled />

          <AppSelect
            label="Stilling"
            value={profileForm.values.jobTitle}
            data={jobTitleOptions}
            placeholder="Velg stilling..."
            disabled={disabled}
            clearable
            onChange={(value) => {
              profileForm.setFieldValue("jobTitle", value);
              onJobTitleChange(value);
            }}
          />

          <AppTextInput
            label="Sveiser ID"
            inputMode="numeric"
            value={profileForm.values.welderNo}
            disabled={disabled}
            onChange={(value) => {
              profileForm.setFieldValue("welderNo", value);
              onWelderNoChange(value);
            }}
          />

          <Group justify="space-between" align="center" wrap="wrap">
            <AppButton size="sm" disabled={resettingPassword} onClick={onResetPassword}>
              {resettingPassword ? "Sender..." : "Bytt passord"}
            </AppButton>
            {isAdmin ? (
              <AppButton tone="primary" type="submit" size="sm" disabled={loading || saving || !canSave}>
                {saving ? "Lagrer..." : "Lagre"}
              </AppButton>
            ) : null}
          </Group>

          {isAdmin && !canSave ? (
            <Alert color="orange" variant="light">
              Lagring er deaktivert til brukerprofilen er lastet korrekt.
            </Alert>
          ) : null}

          {!isAdmin ? (
            <Alert color="gray" variant="light">
              Kun admin kan endre.
            </Alert>
          ) : null}
        </Stack>
      </form>
    </AppPanel>
  );
}
