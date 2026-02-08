import { renderHeader, wireHeader } from "../../components/header";
import { getSession, getProfileAccess } from "../../app/auth";
import { supabase } from "../../services/supabaseClient";
import { toast } from "../../ui/toast";
import { Footer } from "../../components/footer";
import { fetchJobTitles } from "../../repo/jobTitleRepo";
import { openConfirm } from "../../ui/confirm";

import "../../styles/pages/settings.css";

export async function renderSettingsPage(app: HTMLElement) {
  const session = await getSession();
  let displayName = "Bruker";
  const email = session?.user?.email ?? "";
  let isAdmin = false;

  if (session?.user) {
    try {
      const access = await getProfileAccess(session.user);
      displayName = access.displayName;
      isAdmin = access.isAdmin;
    } catch (err) {
      console.warn("Feilet å hente profil", err);
    }
  }

  let profile: { display_name: string | null; welder_no: string | null; job_title: string | null } = {
    display_name: null,
    welder_no: null,
    job_title: null,
  };

  let jobTitles: { id: string; title: string; is_active: boolean }[] = [];

  if (session?.user) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, welder_no, job_title, email")
      .eq("id", session.user.id)
      .maybeSingle();
    if (data) profile = data;
  }

  try {
    jobTitles = await fetchJobTitles();
  } catch (err) {
    console.warn("Feilet å hente stillinger", err);
  }

  const formatWelderNo = (n: string | null) => {
    if (!n) return "";
    return String(n).padStart(3, "0");
  };

  app.innerHTML = `
    <div class="shell page-settings">
      ${renderHeader(displayName, email)}

      <main class="main">
        <section class="section-header">
          <div>
            <h1 class="section-title">Innstillinger</h1>
            <p class="section-subtitle">Administrer app- og brukerinnstillinger.</p>
          </div>
          <div class="section-actions">
            ${isAdmin ? `<a class=\"btn small\" href=\"#/company-settings\">App-parametere</a>` : ""}
            ${isAdmin ? `<a class=\"btn small\" href=\"#/users\">Administrer brukere</a>` : ""}
          </div>
        </section>

        <section class="section-grid">
          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">Brukerinfo</div>
              <div class="panel-meta">${isAdmin ? "Admin" : "Les"}</div>
            </div>
            <div class="panel-body">
              <div class="settings-form">
                <div class="settings-row">
                  <label>Visningsnavn</label>
                  <input id="display_name" class="input" type="text" value="${profile.display_name ?? displayName}" ${!isAdmin ? "disabled" : ""} />
                </div>

                <div class="settings-row">
                  <label>E-post</label>
                  <input class="input" type="email" value="${email}" disabled />
                </div>

                <div class="settings-row">
                  <label>Stilling</label>
                  <select id="job_title" class="select" ${!isAdmin ? "disabled" : ""}>
                    <option value="">Velg stilling…</option>
                    ${jobTitles
                      .map((j) => {
                        const selected = j.title === profile.job_title ? "selected" : "";
                        const inactive = j.is_active ? "" : "disabled";
                        const label = j.is_active ? j.title : `${j.title} (inaktiv)`;
                        return `<option value="${j.title}" ${selected} ${inactive}>${label}</option>`;
                      })
                      .join("")}
                  </select>
                </div>

                <div class="settings-row">
                  <label>Sveiser ID</label>
                  <input id="welder_no" class="input" type="text" inputmode="numeric" value="${formatWelderNo(profile.welder_no)}" ${!isAdmin ? "disabled" : ""} />
                </div>

                <div class="settings-actions">
                  <button id="btnResetPassword" class="btn" type="button">Bytt passord</button>
                    ${isAdmin ? `<button id="btnSave" class="btn primary" type="button">Lagre</button>` : ""}
                </div>
              </div>
                ${isAdmin ? "" : `<div class=\"muted\" style=\"margin-top:10px;\">Kun admin kan endre.</div>`}
            </div>
          </div>
        </section>

        <div data-modal-mount></div>
      </main>

      ${Footer()}
    </div>
  `;

  wireHeader(app);

  const controller = new AbortController();
  const { signal } = controller;
  const modalMount = app.querySelector<HTMLDivElement>("[data-modal-mount]");

  const resetBtn = app.querySelector<HTMLButtonElement>("#btnResetPassword");
  resetBtn?.addEventListener("click", async () => {
    if (!email || !modalMount || !resetBtn) return;

    const originalText = resetBtn.textContent || "Bytt passord";

    await openConfirm(modalMount, signal, {
      title: "Send nytt passord",
      messageHtml: "Dette sender en e-post med lenke for å bytte passord.",
      confirmLabel: "Send",
      onConfirm: async () => {
        resetBtn.disabled = true;
        resetBtn.textContent = "Sender…";
        try {
          await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}/#/settings`,
          });
          toast("Sendt e-post for passordbytte.");
        } finally {
          resetBtn.disabled = false;
          resetBtn.textContent = originalText;
        }
      },
    });
  });

  const saveBtn = app.querySelector<HTMLButtonElement>("#btnSave");
  saveBtn?.addEventListener("click", async () => {
    if (!session?.user) return;
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Lagrer…";

      const displayNameEl = app.querySelector<HTMLInputElement>("#display_name");
      const welderNoEl = app.querySelector<HTMLInputElement>("#welder_no");
      const jobTitleEl = app.querySelector<HTMLSelectElement>("#job_title");

      const rawWelderNo = (welderNoEl?.value ?? "").replace(/\D/g, "").trim();
      const payload = {
        display_name: displayNameEl?.value.trim() || null,
        welder_no: rawWelderNo ? rawWelderNo.padStart(3, "0") : null,
        job_title: jobTitleEl?.value.trim() || null,
      };

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", session.user.id);

      if (error) throw error;
      toast("Lagring fullført.");
    } catch (err: any) {
      console.error(err);
      toast("Kunne ikke lagre.");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Lagre";
      }
    }
  });
}
