import { renderHeader, wireHeader } from "../../components/header";
import { getSession, getProfileAccess } from "../../app/auth";
import { supabase } from "../../services/supabaseClient";
import { Footer } from "../../components/footer";
import { qs, esc } from "../../utils/dom";
import { toast } from "../../ui/toast";
import { openModal, modalSaveButton, renderModal } from "../../ui/modal";
import { fetchJobTitles } from "../../repo/jobTitleRepo";

import "../../styles/pages/users.css";

type UserRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  welder_no: string | null;
  job_title: string | null;
  role: string | null;
  login_enabled: boolean | null;
};

function icon(name: "pencil" | "toggle") {
  if (name === "pencil") {
    return `
      <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
        <path fill="currentColor" d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182L8.25 18.463 3 19.5l1.037-5.25L16.862 3.487zM5.39 17.11l2.872-.566L18.98 5.826l-2.306-2.306L5.956 14.238l-.566 2.872z"/>
      </svg>
    `;
  }
  return `
    <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
      <path fill="currentColor" d="M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V4zm1 0h7v7h-2V7.41l-7.29 7.3-1.42-1.42L16.59 6H13V4z"/>
    </svg>
  `;
}

function actionBtn(kind: "edit" | "toggle", id: string, label: string, disabled = false) {
  const svg = kind === "edit" ? icon("pencil") : icon("toggle");
  const cls = disabled ? "iconbtn is-disabled" : "iconbtn";
  const dataAttr =
    kind === "edit"
      ? `data-edit-user="${esc(id)}"`
      : disabled
        ? `data-toggle-user="${esc(id)}" data-self="true"`
        : `data-toggle-user="${esc(id)}"`;
  const title = kind === "edit" ? "Endre" : "Aktiver/Deaktiver";
  const aria = `${title} ${esc(label)}`;
  return `
    <button class="${cls}" type="button" ${dataAttr} aria-label="${aria}" title="${title}">
      ${svg}
    </button>
  `;
}

export async function renderUsersPage(app: HTMLElement) {
  const session = await getSession();
  let displayName = "Bruker";
  const email = session?.user?.email ?? "";
  let isAdmin = false;

  if (session?.user) {
    const access = await getProfileAccess(session.user);
    displayName = access.displayName;
    isAdmin = access.isAdmin;
  }

  if (!isAdmin) {
    app.innerHTML = `
      <div class="shell page-users">
        ${renderHeader(displayName, email)}
        <main class="main">
          <div class="muted" style="padding:16px;">Kun admin har tilgang.</div>
        </main>
        ${Footer()}
      </div>
    `;
    wireHeader(app);
    return;
  }

  app.innerHTML = `
    <div class="shell page-users">
      ${renderHeader(displayName, email)}

      <main class="main">
        <section class="section-header">
          <div>
            <h1 class="section-title">Administrer brukere</h1>
            <p class="section-subtitle">Oversikt over brukere i systemet.</p>
          </div>
          <div class="section-actions">
            <a class="btn small" href="#/settings">← Tilbake</a>
            <button data-add-user class="btn accent small">Legg til bruker</button>
            <button data-refresh class="btn small">Oppdater</button>
          </div>
        </section>

        <section class="section-grid">
          <div class="panel">
            <div class="panel-head">
              <div class="panel-title">Brukere</div>
              <div data-user-count class="panel-meta">—</div>
            </div>
            <div class="panel-body">
              <div data-user-body class="listmount"><div class="muted">Laster…</div></div>
            </div>
          </div>
        </section>

        <div data-modal-mount></div>
      </main>

      ${Footer()}
    </div>
  `;

  wireHeader(app);

  const body = qs<HTMLDivElement>(app, "[data-user-body]");
  const count = qs<HTMLDivElement>(app, "[data-user-count]");
  const refreshBtn = qs<HTMLButtonElement>(app, "[data-refresh]");
  const addBtn = qs<HTMLButtonElement>(app, "[data-add-user]");
  const modalMount = qs<HTMLDivElement>(app, "[data-modal-mount]");

  const controller = new AbortController();
  const { signal } = controller;

  const readFunctionError = async (err: any) => {
    try {
      const ctx = err?.context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.error) return body.error as string;
      }
      if (ctx?.status) return `Feil ${ctx.status}: ${err?.message ?? ""}`.trim();
    } catch (e) {
      console.warn("Kunne ikke lese feilbody", e);
    }
    return err?.message ?? "Kunne ikke invitere.";
  };

  let jobTitles: { title: string; is_active: boolean }[] = [];

  const renderJobTitleOptions = (selected: string | null) => {
    if (jobTitles.length === 0) return `<option value="">Ingen stillinger</option>`;
    return [
      `<option value="">Velg stilling…</option>`,
      ...jobTitles.map((j) => {
        const sel = j.title === selected ? "selected" : "";
        const inactive = j.is_active ? "" : "disabled";
        const label = j.is_active ? j.title : `${j.title} (inaktiv)`;
        return `<option value="${esc(j.title)}" ${sel} ${inactive}>${esc(label)}</option>`;
      }),
    ].join("");
  };

  async function load() {
    body.innerHTML = `<div class="muted">Laster…</div>`;
    try {
      jobTitles = await fetchJobTitles();
    } catch (err) {
      console.warn("Feilet å hente stillinger", err);
      jobTitles = [];
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, email, welder_no, job_title, role, login_enabled")
      .order("display_name", { ascending: true });

    if (error) {
      body.innerHTML = `<div class="err">Feil: ${esc(error.message)}</div>`;
      return;
    }

    const rows = (data ?? []) as UserRow[];
    count.textContent = `${rows.length} stk`;

    if (rows.length === 0) {
      body.innerHTML = `<div class="muted">Ingen brukere.</div>`;
      return;
    }

    body.innerHTML = `
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Visningsnavn</th>
              <th>E-post</th>
              <th>Stilling</th>
              <th>Sveiser ID</th>
              <th>Rolle</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((r) => {
                const isInactive = r.login_enabled === false;
                const statusLabel = isInactive ? "Inaktiv" : "Aktiv";
                const rowClass = isInactive ? "user-inactive" : "";
                const statusClass = isInactive ? "status-pill fault" : "status-pill ok";
                const isSelf = session?.user?.id === r.id;
                return `
                  <tr class="${rowClass}">
                    <td data-label="Visningsnavn">${esc(r.display_name ?? "")}</td>
                    <td data-label="E-post">${esc(r.email ?? "")}</td>
                    <td data-label="Stilling">${esc(r.job_title ?? "")}</td>
                    <td data-label="Sveiser ID">${esc(r.welder_no ?? "")}</td>
                    <td data-label="Rolle">${esc(r.role ?? "")}</td>
                    <td data-label="Status"><span class="${statusClass}">${esc(statusLabel)}</span></td>
                    <td class="actcell">
                      ${actionBtn("edit", r.id, r.display_name ?? r.email ?? "Bruker")}
                      ${actionBtn("toggle", r.id, r.display_name ?? r.email ?? "Bruker", isSelf)}
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  refreshBtn.addEventListener("click", load);

  addBtn.addEventListener("click", () => {
    const modalHtml = renderModal(
      "Legg til bruker",
      `
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
              ${renderJobTitleOptions(null)}
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
      `,
      "Opprett bruker"
    );

    const h = openModal(modalMount, modalHtml, signal);
    const save = modalSaveButton(h.root);

    save.addEventListener(
      "click",
      async () => {
        try {
          save.disabled = true;
          save.textContent = "Oppretter…";

          const emailEl = h.root.querySelector<HTMLInputElement>("[data-f=email]");
          const displayNameEl = h.root.querySelector<HTMLInputElement>("[data-f=display_name]");
          const jobTitleEl = h.root.querySelector<HTMLSelectElement>("[data-f=job_title]");
          const welderNoEl = h.root.querySelector<HTMLInputElement>("[data-f=welder_no]");
          const roleEl = h.root.querySelector<HTMLSelectElement>("[data-f=role]");
          const passwordEl = h.root.querySelector<HTMLInputElement>("[data-f=password]");
          const password2El = h.root.querySelector<HTMLInputElement>("[data-f=password2]");

          const email = (emailEl?.value ?? "").trim();
          if (!email) {
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

          const rawWelderNo = (welderNoEl?.value ?? "").replace(/\D/g, "").trim();

          const payload = {
            email,
            display_name: displayNameEl?.value.trim() || null,
            job_title: jobTitleEl?.value.trim() || null,
            welder_no: rawWelderNo ? rawWelderNo.padStart(3, "0") : null,
            role: roleEl?.value ?? "user",
            password,
          };

          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (!token) {
            throw new Error("Mangler tilgangstoken. Logg inn på nytt.");
          }

          const { data, error } = await supabase.functions.invoke("insert-user", {
            body: payload,
            headers: { Authorization: `Bearer ${token}` },
          });

          if (error) {
            const msg = await readFunctionError(error);
            throw new Error(msg);
          }
          if (data?.error) {
            throw new Error(data.error);
          }

          h.close();
          await load();
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
  });

  body.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const editBtn = target.closest("[data-edit-user]") as HTMLElement | null;
      if (editBtn) {
        const id = editBtn.getAttribute("data-edit-user") || "";
        const { data } = await supabase
          .from("profiles")
          .select("display_name, email, welder_no, job_title, role, login_enabled")
          .eq("id", id)
          .maybeSingle();

        const modalHtml = renderModal(
          "Endre bruker",
          `
            <div class="modalgrid">
              <div class="field" style="grid-column:1 / -1;">
                <label>E-post</label>
                <input data-f="email" class="input" type="email" value="${esc(data?.email ?? "")}" />
                <div class="muted" style="font-size:12px;">Bruker må logge inn på nytt.</div>
              </div>
              <div class="field">
                <label>Visningsnavn</label>
                <input data-f="display_name" class="input" value="${esc(data?.display_name ?? "")}" />
              </div>
              <div class="field">
                <label>Stilling</label>
                <select data-f="job_title" class="select">
                  ${renderJobTitleOptions(data?.job_title ?? null)}
                </select>
              </div>
              <div class="field">
                <label>Sveiser ID</label>
                <input data-f="welder_no" class="input" value="${esc(data?.welder_no ?? "")}" />
              </div>
              <div class="field">
                <label>Rolle</label>
                <select data-f="role" class="select">
                  <option value="user" ${data?.role === "user" ? "selected" : ""}>user</option>
                  <option value="admin" ${data?.role === "admin" ? "selected" : ""}>admin</option>
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
          `,
          "Lagre"
        );

        const h = openModal(modalMount, modalHtml, signal);
        const save = modalSaveButton(h.root);

        save.addEventListener(
          "click",
          async () => {
            try {
              save.disabled = true;
              save.textContent = "Lagrer…";

              const emailEl = h.root.querySelector<HTMLInputElement>("[data-f=email]");
              const displayNameEl = h.root.querySelector<HTMLInputElement>("[data-f=display_name]");
              const passwordEl = h.root.querySelector<HTMLInputElement>("[data-f=password]");
              const password2El = h.root.querySelector<HTMLInputElement>("[data-f=password2]");
              const jobTitleEl = h.root.querySelector<HTMLSelectElement>("[data-f=job_title]");
              const welderNoEl = h.root.querySelector<HTMLInputElement>("[data-f=welder_no]");
              const roleEl = h.root.querySelector<HTMLSelectElement>("[data-f=role]");

              const nextEmail = (emailEl?.value ?? "").trim().toLowerCase();
              const prevEmail = (data?.email ?? "").trim().toLowerCase();
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

              const rawWelderNo = (welderNoEl?.value ?? "").replace(/\D/g, "").trim();
              const payload = {
                display_name: displayNameEl?.value.trim() || null,
                job_title: jobTitleEl?.value.trim() || null,
                welder_no: rawWelderNo ? rawWelderNo.padStart(3, "0") : null,
                role: roleEl?.value ?? "user",
              };

              if (newPassword || nextEmail !== prevEmail) {
                const { data: sessionData } = await supabase.auth.getSession();
                const token = sessionData.session?.access_token;
                if (!token) throw new Error("Mangler tilgangstoken. Logg inn på nytt.");

                const { data: pwData, error: pwError } = await supabase.functions.invoke("update-user", {
                  body: { userId: id, password: newPassword || undefined, email: nextEmail !== prevEmail ? nextEmail : undefined },
                  headers: { Authorization: `Bearer ${token}` },
                });

                if (pwError) {
                  const msg = await readFunctionError(pwError);
                  throw new Error(msg);
                }
                if (pwData?.error) throw new Error(pwData.error);
              }

              const { error } = await supabase.from("profiles").update(payload).eq("id", id);
              if (error) throw error;

              h.close();
              await load();
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

        return;
      }

      const toggleBtn = target.closest("[data-toggle-user]") as HTMLElement | null;
      if (toggleBtn) {
        if (toggleBtn.getAttribute("data-self") === "true") {
          toast("Du kan ikke deaktivere din egen bruker.");
          return;
        }
        const id = toggleBtn.getAttribute("data-toggle-user") || "";
        if (!id) return;
        if (session?.user?.id === id) {
          toast("Du kan ikke deaktivere din egen bruker.");
          return;
        }

        const { data } = await supabase
          .from("profiles")
          .select("login_enabled")
          .eq("id", id)
          .maybeSingle();

        const next = !(data?.login_enabled ?? true);
        const { error } = await supabase
          .from("profiles")
          .update({ login_enabled: next })
          .eq("id", id);

        if (error) {
          console.error(error);
          toast("Kunne ikke oppdatere.");
          return;
        }

        await load();
      }
    },
    { signal }
  );
  await load();
}
