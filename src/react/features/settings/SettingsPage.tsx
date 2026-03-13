import { useState } from "react";
import { supabase } from "../../../services/supabaseClient";
import { formatErrorMessage } from "../../../utils/error";
import { toast } from "@react/ui/notify";
import { useConfirmModal } from "@react/ui/useConfirmModal";
import { useAuth } from "../../auth/AuthProvider";
import { AppPageLayout } from "../../layout/AppPageLayout";
import { SettingsHeader } from "./components/SettingsHeader";
import { SettingsProfileForm } from "./components/SettingsProfileForm";
import { useSettingsData } from "./hooks/useSettingsData";
import { ROUTES } from "@react/router/routes";

function readSaveErrorMessage(err: unknown): string {
  const message = formatErrorMessage(err, "Kunne ikke lagre profil.");
  if (message === "Failed to fetch" || message === "TypeError: Failed to fetch") {
    return "Ingen kontakt med serveren. Sjekk nettverket og prøv igjen.";
  }
  return message;
}

export function SettingsPage() {
  const { access, session, refresh } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const userId = session?.user?.id ?? null;
  const isAdmin = access?.isAdmin ?? false;

  const { loading, saving, error, canSave, jobTitles, form, setDisplayName, setJobTitle, setWelderNo, reload, save } = useSettingsData({
    userId,
    fallbackDisplayName: displayName,
  });

  const [resettingPassword, setResettingPassword] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { openConfirmModal, confirmModal } = useConfirmModal();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const settingsRedirectPath = `${basePath}${ROUTES.settings}`;

  const handleResetPassword = () => {
    if (!email) return;

    openConfirmModal({
      title: "Send nytt passord",
      messageHtml: "Dette sender en e-post med lenke for å bytte passord.",
      confirmLabel: "Send",
      onConfirm: async () => {
        setResettingPassword(true);
        try {
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}${settingsRedirectPath}`,
          });
          toast("Sendt e-post for passordbytte.");
        } finally {
          setResettingPassword(false);
        }
      },
    });
  };

  const handleSave = () => {
    if (!isAdmin) return;
    void (async () => {
      setSaveError(null);
      try {
        await save();
        await refresh();
        setSaveError(null);
        toast("Lagring fullført.");
      } catch (err) {
        console.error(err);
        const message = readSaveErrorMessage(err);
        setSaveError(message);
        toast(message);
      }
    })();
  };

  return (
    <AppPageLayout pageClassName="page-settings" displayName={displayName} email={email}>
      <SettingsHeader isAdmin={isAdmin} />
      <SettingsProfileForm
        isAdmin={isAdmin}
        email={email}
        loading={loading}
        saving={saving}
        error={error}
        saveError={saveError}
        canSave={canSave}
        resettingPassword={resettingPassword}
        jobTitles={jobTitles}
        form={form}
        onDisplayNameChange={(value) => {
          if (saveError) setSaveError(null);
          setDisplayName(value);
        }}
        onJobTitleChange={(value) => {
          if (saveError) setSaveError(null);
          setJobTitle(value);
        }}
        onWelderNoChange={(value) => {
          if (saveError) setSaveError(null);
          setWelderNo(value);
        }}
        onRetry={() => {
          setSaveError(null);
          void reload();
        }}
        onSave={handleSave}
        onResetPassword={handleResetPassword}
      />

      {confirmModal}
    </AppPageLayout>
  );
}
