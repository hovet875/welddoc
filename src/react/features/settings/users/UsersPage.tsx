import { useEffect, useMemo, useRef } from "react";
import { openModal, modalSaveButton, renderModal } from "../../../../ui/modal";
import { toast } from "../../../../ui/toast";
import { supabase } from "../../../../services/supabaseClient";
import { esc } from "../../../../utils/dom";
import { useAuth } from "../../../auth/AuthProvider";
import { AppFooter } from "../../../layout/AppFooter";
import { AppHeader } from "../../../layout/AppHeader";
import { UsersHeader } from "./components/UsersHeader";
import { UsersTable } from "./components/UsersTable";
import { useUsersData } from "./hooks/useUsersData";
import { normalizeEmail, readFunctionError, renderJobTitleOptions, sanitizeWelderNo } from "./lib/userModalHelpers";
import type { UserRow } from "./users.types";

function renderAddUserBody(jobTitleOptions: string) {
  return `
    <div class="modalgrid">
      <div class="field" style="grid-column:1 / -1;">
        <label>E-post</label>
        <input data-f="email" class="input" type="email" placeholder="navn@firma.no" />
      </div>
      <div class="field">
        <label>Visningsnavn</label>
        <input data-f="display_name" class="input" placeholder="Navn" />
      </div>
      <div class="field">
        <label>Stilling</label>
        <select data-f="job_title" class="select">
          ${jobTitleOptions}
        </select>
      </div>
      <div class="field">
        <label>Sveiser ID (tom for ikke-sveisere)</label>
        <input data-f="welder_no" class="input" placeholder="004" />
      </div>
      <div class="field">
        <label>Rolle</label>
        <select data-f="role" class="select">
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <div class="field">
        <label>Passord</label>
        <input data-f="password" class="input" type="password" autocomplete="new-password" />
      </div>
      <div class="field">
        <label>Gjenta passord</label>
        <input data-f="password2" class="input" type="password" autocomplete="new-password" />
      </div>
    </div>
  `;
}

function renderEditUserBody(user: UserRow, jobTitleOptions: string) {
  return `
    <div class="modalgrid">
      <div class="field" style="grid-column:1 / -1;">
        <label>E-post</label>
        <input data-f="email" class="input" type="email" value="${esc(user.email ?? "")}" />
        <div class="muted" style="font-size:12px;">Bruker må logge inn på nytt.</div>
      </div>
      <div class="field">
        <label>Visningsnavn</label>
        <input data-f="display_name" class="input" value="${esc(user.display_name ?? "")}" />
      </div>
      <div class="field">
        <label>Stilling</label>
        <select data-f="job_title" class="select">
          ${jobTitleOptions}
        </select>
      </div>
      <div class="field">
        <label>Sveiser ID</label>
        <input data-f="welder_no" class="input" value="${esc(user.welder_no ?? "")}" />
      </div>
      <div class="field">
        <label>Rolle</label>
        <select data-f="role" class="select">
          <option value="user" ${user.role === "user" ? "selected" : ""}>user</option>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
        </select>
      </div>
      <div class="field">
        <label>Nytt passord</label>
        <input data-f="password" class="input" type="password" autocomplete="new-password" />
      </div>
      <div class="field">
        <label>Gjenta passord</label>
        <input data-f="password2" class="input" type="password" autocomplete="new-password" />
      </div>
    </div>
  `;
}

export function UsersPage() {
  const { access, session } = useAuth();
  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;
  const currentUserId = session?.user?.id ?? null;
  const { loading, error, rows, jobTitles, reload } = useUsersData({ enabled: isAdmin });
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

  const userCountLabel = useMemo(() => `${rows.length} stk`, [rows.length]);
  const jobTitleOptions = useMemo(() => renderJobTitleOptions(jobTitles, null), [jobTitles]);

  const openAddUserModal = () => {
    const mount = modalMountRef.current;
    const signal = controllerRef.current?.signal;
    if (!mount || !signal) return;

    const modalHtml = renderModal("Legg til bruker", renderAddUserBody(jobTitleOptions), "Opprett bruker");
    const handle = openModal(mount, modalHtml, signal);
    const save = modalSaveButton(handle.root);

    save.addEventListener(
      "click",
      async () => {
        try {
          save.disabled = true;
          save.textContent = "Oppretter...";

          const emailEl = handle.root.querySelector<HTMLInputElement>("[data-f=email]");
          const displayNameEl = handle.root.querySelector<HTMLInputElement>("[data-f=display_name]");
          const jobTitleEl = handle.root.querySelector<HTMLSelectElement>("[data-f=job_title]");
          const welderNoEl = handle.root.querySelector<HTMLInputElement>("[data-f=welder_no]");
          const roleEl = handle.root.querySelector<HTMLSelectElement>("[data-f=role]");
          const passwordEl = handle.root.querySelector<HTMLInputElement>("[data-f=password]");
          const password2El = handle.root.querySelector<HTMLInputElement>("[data-f=password2]");

          const nextEmail = normalizeEmail(emailEl?.value ?? "");
          if (!nextEmail) {
            toast("E-post er påkrevd.");
            return;
          }

          const password = passwordEl?.value ?? "";
          const password2 = password2El?.value ?? "";
          if (!password || password.length < 6) {
            toast("Passord må være minst 6 tegn.");
            return;
          }
          if (password !== password2) {
            toast("Passordene er ikke like.");
            return;
          }

          const payload = {
            email: nextEmail,
            display_name: displayNameEl?.value.trim() || null,
            job_title: jobTitleEl?.value.trim() || null,
            welder_no: sanitizeWelderNo(welderNoEl?.value ?? ""),
            role: roleEl?.value ?? "user",
            password,
          };

          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (!token) throw new Error("Mangler tilgangstoken. Logg inn på nytt.");

          const { data, error: invokeError } = await supabase.functions.invoke("insert-user", {
            body: payload,
            headers: { Authorization: `Bearer ${token}` },
          });

          if (invokeError) {
            const msg = await readFunctionError(invokeError);
            throw new Error(msg);
          }
          if (data?.error) throw new Error(data.error);

          handle.close();
          await reload();
          toast("Bruker opprettet.");
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? err));
        } finally {
          save.disabled = false;
          save.textContent = "Opprett bruker";
        }
      },
      { signal }
    );
  };

  const openEditUserModal = (user: UserRow) => {
    const mount = modalMountRef.current;
    const signal = controllerRef.current?.signal;
    if (!mount || !signal) return;

    const modalHtml = renderModal(
      "Endre bruker",
      renderEditUserBody(user, renderJobTitleOptions(jobTitles, user.job_title ?? null)),
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

          const emailEl = handle.root.querySelector<HTMLInputElement>("[data-f=email]");
          const displayNameEl = handle.root.querySelector<HTMLInputElement>("[data-f=display_name]");
          const passwordEl = handle.root.querySelector<HTMLInputElement>("[data-f=password]");
          const password2El = handle.root.querySelector<HTMLInputElement>("[data-f=password2]");
          const jobTitleEl = handle.root.querySelector<HTMLSelectElement>("[data-f=job_title]");
          const welderNoEl = handle.root.querySelector<HTMLInputElement>("[data-f=welder_no]");
          const roleEl = handle.root.querySelector<HTMLSelectElement>("[data-f=role]");

          const nextEmail = normalizeEmail(emailEl?.value ?? "");
          const prevEmail = normalizeEmail(user.email ?? "");

          if (!nextEmail) {
            toast("E-post er påkrevd.");
            return;
          }
          if (!nextEmail.includes("@")) {
            toast("Ugyldig e-post.");
            return;
          }

          const newPassword = (passwordEl?.value ?? "").trim();
          const newPassword2 = (password2El?.value ?? "").trim();
          if (newPassword || newPassword2) {
            if (newPassword.length < 6) {
              toast("Passord må være minst 6 tegn.");
              return;
            }
            if (newPassword !== newPassword2) {
              toast("Passordene er ikke like.");
              return;
            }
          }

          const profilePayload = {
            display_name: displayNameEl?.value.trim() || null,
            job_title: jobTitleEl?.value.trim() || null,
            welder_no: sanitizeWelderNo(welderNoEl?.value ?? ""),
            role: roleEl?.value ?? "user",
          };

          if (newPassword || nextEmail !== prevEmail) {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData.session?.access_token;
            if (!token) throw new Error("Mangler tilgangstoken. Logg inn på nytt.");

            const { data, error: invokeError } = await supabase.functions.invoke("update-user", {
              body: {
                userId: user.id,
                password: newPassword || undefined,
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

          const { error: updateError } = await supabase.from("profiles").update(profilePayload).eq("id", user.id);
          if (updateError) throw updateError;

          handle.close();
          await reload();
          toast("Oppdatert.");
        } catch (err: any) {
          console.error(err);
          toast(String(err?.message ?? "Kunne ikke lagre."));
        } finally {
          save.disabled = false;
          save.textContent = "Lagre";
        }
      },
      { signal }
    );
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
      <div className="shell page-users">
        <AppHeader displayName={displayName} email={email} />
        <main className="main">
          <div className="muted" style={{ padding: 16 }}>Kun admin har tilgang.</div>
        </main>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="shell page-users">
      <AppHeader displayName={displayName} email={email} />

      <main className="main">
        <UsersHeader onRefresh={() => void reload()} onAddUser={openAddUserModal} />

        <section className="section-grid">
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Brukere</div>
              <div className="panel-meta">{userCountLabel}</div>
            </div>
            <div className="panel-body">
              <UsersTable
                rows={rows}
                loading={loading}
                error={error}
                currentUserId={currentUserId}
                onEdit={openEditUserModal}
                onToggle={toggleUser}
              />
            </div>
          </div>
        </section>

        <div ref={modalMountRef}></div>
      </main>

      <AppFooter />
    </div>
  );
}
