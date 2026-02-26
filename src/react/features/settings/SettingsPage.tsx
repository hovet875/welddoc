import { useEffect, useRef, useState } from "react";
import { openConfirm } from "../../../ui/confirm";
import { toast } from "../../../ui/toast";
import { supabase } from "../../../services/supabaseClient";
import { useAuth } from "../../auth/AuthProvider";
import { AppFooter } from "../../layout/AppFooter";
import { AppHeader } from "../../layout/AppHeader";
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
  const modalMountRef = useRef<HTMLDivElement | null>(null);
  const confirmControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    confirmControllerRef.current = controller;
    return () => {
      controller.abort();
      confirmControllerRef.current = null;
    };
  }, []);

  const handleResetPassword = () => {
    if (!email) return;
    const signal = confirmControllerRef.current?.signal;
    const modalMount = modalMountRef.current;
    if (!signal || !modalMount) return;

    void openConfirm(modalMount, signal, {
      title: "Send nytt passord",
      messageHtml: "Dette sender en e-post med lenke for å bytte passord.",
      confirmLabel: "Send",
      onConfirm: async () => {
        setResettingPassword(true);
        try {
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}/#/settings`,
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
    <div className="shell page-settings">
      <AppHeader displayName={displayName} email={email} />

      <main className="main">
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

        <div ref={modalMountRef}></div>
      </main>

      <AppFooter />
    </div>
  );
}
