import { useState } from "react";
import { supabase } from "../../../services/supabaseClient";
import { toast } from "@react/ui/notify";
import { useConfirmModal } from "@react/ui/useConfirmModal";
import { useAuth } from "../../auth/AuthProvider";
import { AppPageLayout } from "../../layout/AppPageLayout";
import { SettingsHeader } from "./components/SettingsHeader";
import { SettingsProfileForm } from "./components/SettingsProfileForm";
import { useSettingsData } from "./hooks/useSettingsData";

export function SettingsPage() {
  const { access, session, refresh } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const userId = session?.user?.id ?? null;
  const isAdmin = access?.isAdmin ?? false;

  const { loading, saving, jobTitles, form, setDisplayName, setJobTitle, setWelderNo, save } = useSettingsData({
    userId,
    fallbackDisplayName: displayName,
  });

  const [resettingPassword, setResettingPassword] = useState(false);
  const { openConfirmModal, confirmModal } = useConfirmModal();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const settingsRedirectPath = `${basePath}/settings`;

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
      try {
        await save();
        await refresh();
        toast("Lagring fullført.");
      } catch (err) {
        console.error(err);
        toast("Kunne ikke lagre.");
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
        resettingPassword={resettingPassword}
        jobTitles={jobTitles}
        form={form}
        onDisplayNameChange={setDisplayName}
        onJobTitleChange={setJobTitle}
        onWelderNoChange={setWelderNo}
        onSave={handleSave}
        onResetPassword={handleResetPassword}
      />

      {confirmModal}
    </AppPageLayout>
  );
}
