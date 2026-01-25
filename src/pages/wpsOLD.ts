import { supabase } from "../services/supabaseClient";
import { renderHeader, wireHeader } from "../components/header";
import { Footer } from "../components/footer";
import { PROSESSER, MATERIALER, SAMMENFOYNINGER } from "../data/wpsOptions";

type WPQRRow = {
  id: string;
  doc_no: string;
  materiale: string;
  sammenfoyning: string;
  tykkelse: string;
  process: string;
  pdf_path: string | null;
  created_at: string;
};

type WPSRow = {
  id: string;
  doc_no: string;
  materiale: string;
  sammenfoyning: string;
  tykkelse: string;
  process: string;
  pdf_path: string | null;
  created_at: string;
  wpqr_id: string | null;
  wpqr?: { id: string; doc_no: string } | null;
};

function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[c] ?? c;
  });
}

function renderOptions(list: readonly string[], placeholder = "Velg…") {
  return [
    `<option value="">${esc(placeholder)}</option>`,
    ...list.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`),
  ].join("");
}

function stripMm(s: string) {
  return (s ?? "").replace(/mm/gi, "").trim();
}

function displayThickness(s: string) {
  const v = String(s ?? "").trim();
  if (!v) return "";
  return /mm\b/i.test(v) ? v : `${v} mm`;
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("nb-NO");
  } catch {
    return iso;
  }
}

/** Grupper på prosess (bruker rekkefølgen fra DB; ingen ekstra sort) */
function groupByProcess<T extends { process: string }>(rows: T[]) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const key = (r.process || "Ukjent").trim();
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(r);
  }
  return [...m.entries()];
}

async function openPdf(path: string) {
  const { data, error } = await supabase.storage.from("docs").createSignedUrl(path, 120);
  if (error) {
    console.error(error);
    alert("Klarte ikke å åpne PDF.");
    return;
  }
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function iconPencilSvg() {
  return `
    <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
      <path fill="currentColor" d="M16.862 3.487a2.25 2.25 0 0 1 3.182 3.182L8.25 18.463 3 19.5l1.037-5.25L16.862 3.487zM5.39 17.11l2.872-.566L18.98 5.826l-2.306-2.306L5.956 14.238l-.566 2.872z"/>
    </svg>
  `;
}

function iconTrashSvg() {
  return `
    <svg viewBox="0 0 24 24" class="svgicon" aria-hidden="true">
      <path fill="currentColor" d="M9 3a1 1 0 0 0-1 1v1H5.5a1 1 0 1 0 0 2H6v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7h.5a1 1 0 1 0 0-2H16V4a1 1 0 0 0-1-1H9zm1 2h4V4h-4v1zm-1 5a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1zm6 0a1 1 0 0 1 1 1v8a1 1 0 1 1-2 0v-8a1 1 0 0 1 1-1z"/>
    </svg>
  `;
}

function renderDeleteIconButton(dataset: string, id: string, label: string) {
  const attr = dataset === "wpqr" ? "data-del-wpqr" : "data-del-wps";
  return `
    <button
      class="iconbtn danger"
      type="button"
      ${attr}="${esc(id)}"
      data-del-label="${esc(label)}"
      aria-label="Slett ${esc(label)}"
      title="Slett"
    >
      ${iconTrashSvg()}
    </button>
  `;
}

function renderEditIconButton(dataset: string, id: string, label: string) {
  const attr = dataset === "wpqr" ? "data-edit-wpqr" : "data-edit-wps";
  return `
    <button
      class="iconbtn"
      type="button"
      ${attr}="${esc(id)}"
      data-edit-label="${esc(label)}"
      aria-label="Endre ${esc(label)}"
      title="Endre"
    >
      ${iconPencilSvg()}
    </button>
  `;
}

function renderProcessTableWPQR(process: string, rows: WPQRRow[]) {
  return `
    <div class="wpsgroup">
      <div class="wpsgrouphead">
        <div class="wpsgrouptitle">Metode: ${esc(process)}</div>
        <div class="wpsgroupmeta">${rows.length} stk</div>
      </div>

      <div class="wpsscroll">
        <table class="wpstable">
          <thead>
            <tr>
              <th>WPQR nr.</th>
              <th>Materiale</th>
              <th>Sammenføyning</th>
              <th>Tykkelse</th>
              <th>Dato lagt opp</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
              <tr>
                <td data-label="WPQR nr.">
                  ${
                    r.pdf_path
                      ? `<button class="linkbtn" data-openpdf="${esc(r.pdf_path)}">${esc(r.doc_no)}</button>`
                      : `<span>${esc(r.doc_no)}</span>`
                  }
                </td>

                <td data-label="Materiale">${esc(r.materiale)}</td>
                <td data-label="Fugetype">${esc(r.sammenfoyning)}</td>
                <td data-label="Tykkelse">${esc(displayThickness(r.tykkelse))}</td>
                <td data-label="Dato" class="mutedcell">${esc(fmtDate(r.created_at))}</td>

                <td data-label="" class="actcell">
                  ${renderEditIconButton("wpqr", r.id, r.doc_no)}
                  ${renderDeleteIconButton("wpqr", r.id, r.doc_no)}
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderProcessTableWPS(process: string, rows: WPSRow[]) {
  return `
    <div class="wpsgroup">
      <div class="wpsgrouphead">
        <div class="wpsgrouptitle">Metode: ${esc(process)}</div>
        <div class="wpsgroupmeta">${rows.length} stk</div>
      </div>

      <div class="wpsscroll">
        <table class="wpstable">
          <thead>
            <tr>
              <th>WPS nr.</th>
              <th>Materiale</th>
              <th>Sammenføyning</th>
              <th>Tykkelse</th>
              <th>Knyttet WPQR</th>
              <th>Dato opprettet</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
              <tr>
                <td data-label="WPS nr.">
                  ${
                    r.pdf_path
                      ? `<button class="linkbtn" data-openpdf="${esc(r.pdf_path)}">${esc(r.doc_no)}</button>`
                      : `<span>${esc(r.doc_no)}</span>`
                  }
                </td>

                <td data-label="Materiale">${esc(r.materiale)}</td>
                <td data-label="Fugetype">${esc(r.sammenfoyning)}</td>
                <td data-label="Tykkelse">${esc(displayThickness(r.tykkelse))}</td>

                <td data-label="WPQR">
                  ${
                    r.wpqr?.doc_no
                      ? `<span class="wpqrpill" title="Koblet WPQR">${esc(r.wpqr.doc_no)}</span>`
                      : `<span class="mutedcell">Ikke koblet</span>`
                  }
                </td>

                <td data-label="Dato" class="mutedcell">${esc(fmtDate(r.created_at))}</td>

                <td data-label="" class="actcell">
                  ${renderEditIconButton("wps", r.id, r.doc_no)}
                  ${renderDeleteIconButton("wps", r.id, r.doc_no)}
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderModal(title: string, bodyHtml: string) {
  return `
    <div class="modalbackdrop" id="modalBackdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modalhead">
          <div class="modaltitle">${esc(title)}</div>
        </div>
        <div class="modalbody">${bodyHtml}</div>
        <div class="modalftr">
          <button class="btn" id="modalCancel">Avbryt</button>
          <button class="btn accent" id="modalSave">Lagre</button>
        </div>
      </div>
    </div>
  `;
}

// -------- delete helpers --------

async function deletePdfIfExists(pdf_path: string | null) {
  if (!pdf_path) return;
  const { error } = await supabase.storage.from("docs").remove([pdf_path]);
  if (error) console.warn("Klarte ikke å slette PDF fra storage:", error);
}

async function deleteWpsById(id: string) {
  const { data, error } = await supabase.from("wps").select("pdf_path").eq("id", id).single();
  if (error) throw error;

  await deletePdfIfExists(data?.pdf_path ?? null);

  const { error: delErr } = await supabase.from("wps").delete().eq("id", id);
  if (delErr) throw delErr;
}

async function deleteWpqrById(id: string) {
  // Frikoble WPS først (unngå FK-feil)
  const { error: updErr } = await supabase.from("wps").update({ wpqr_id: null }).eq("wpqr_id", id);
  if (updErr) throw updErr;

  const { data, error } = await supabase.from("wpqr").select("pdf_path").eq("id", id).single();
  if (error) throw error;

  await deletePdfIfExists(data?.pdf_path ?? null);

  const { error: delErr } = await supabase.from("wpqr").delete().eq("id", id);
  if (delErr) throw delErr;
}

// -------- page --------

export async function renderWps(app: HTMLElement) {
  app.innerHTML = `
    <div class="shell page-wps">
      ${renderHeader()}

      <main class="main">
        <section class="wpsheader">
          <div>
            <h1 class="wpsh1">Sveiseprosedyrer</h1>
            <p class="wpsp">Bibliotek for gyldige WPS og WPQR.</p>
          </div>
          <div class="wpsactions">
            <button id="newWps" class="btn accent small">Ny WPS</button>
            <button id="newWpqr" class="btn accent small">Ny WPQR</button>
            <button id="refresh" class="btn small">Oppdater</button>
          </div>
        </section>

        <section class="wpsgrid">
          <div class="wpspanel">
            <div class="wpspanelhead">
              <div class="wpspaneltitle">WPS</div>
              <div id="wpsCount" class="wpspanelmeta">—</div>
            </div>
            <div class="wpspanelbody">
              <div id="wpsBody" class="listmount"><div class="muted">Laster…</div></div>
            </div>
          </div>

          <div class="wpspanel">
            <div class="wpspanelhead">
              <div class="wpspaneltitle">WPQR</div>
              <div id="wpqrCount" class="wpspanelmeta">—</div>
            </div>
            <div class="wpspanelbody">
              <div id="wpqrBody" class="listmount"><div class="muted">Laster…</div></div>
            </div>
          </div>
        </section>

        <div id="modalMount"></div>
      </main>
      ${Footer()}
    </div>
  `;

  wireHeader(app);

  const wpqrBody = app.querySelector<HTMLDivElement>("#wpqrBody")!;
  const wpsBody = app.querySelector<HTMLDivElement>("#wpsBody")!;
  const wpqrCount = app.querySelector<HTMLDivElement>("#wpqrCount")!;
  const wpsCount = app.querySelector<HTMLDivElement>("#wpsCount")!;
  const refreshBtn = app.querySelector<HTMLButtonElement>("#refresh")!;
  const modalMount = app.querySelector<HTMLDivElement>("#modalMount")!;

  const newWpqrBtn = app.querySelector<HTMLButtonElement>("#newWpqr")!;
  const newWpsBtn = app.querySelector<HTMLButtonElement>("#newWps")!;

  let wpqrAll: WPQRRow[] = [];
  let wpsAll: WPSRow[] = [];

  function closeModal() {
    modalMount.innerHTML = "";
  }

  // --- modal scoped query helpers (hindrer null + feil modal) ---
  function modalRoot(): HTMLElement | null {
    return modalMount.querySelector<HTMLElement>(".modal");
  }

  function mqs<T extends Element>(sel: string): T {
    const root = modalRoot();
    const el = root?.querySelector(sel) as T | null;
    if (!el) throw new Error(`Fant ikke element i modal: ${sel}`);
    return el;
  }

  function mqsa<T extends Element>(sel: string): T | null {
    const root = modalRoot();
    return (root?.querySelector(sel) as T | null) ?? null;
  }

  function wireModalCommon() {
    const backdrop = modalMount.querySelector<HTMLDivElement>("#modalBackdrop");
    const cancel = modalMount.querySelector<HTMLButtonElement>("#modalCancel");

    cancel?.addEventListener("click", closeModal);

    backdrop?.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });

    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") closeModal();
      },
      { once: true }
    );
  }

  function openConfirmDelete(opts: { title: string; messageHtml: string; onConfirm: () => Promise<void> }) {
    modalMount.innerHTML = renderModal(
      opts.title,
      `
        <div style="display:grid; gap:10px;">
          <div>${opts.messageHtml}</div>
          <div class="muted" style="font-size:13px;">Dette kan ikke angres.</div>
        </div>
      `
    );

    wireModalCommon();

    const save = modalMount.querySelector<HTMLButtonElement>("#modalSave")!;
    save.textContent = "Slett";
    save.classList.add("danger");

    save.addEventListener("click", async () => {
      save.disabled = true;
      save.textContent = "Sletter…";
      try {
        await opts.onConfirm();
        closeModal();
        await load();
      } catch (e: any) {
        console.error(e);
        alert(`Feil ved sletting: ${String(e?.message ?? e)}`);
        save.disabled = false;
        save.textContent = "Slett";
      }
    });
  }

  function renderLists() {
    wpqrCount.textContent = `${wpqrAll.length} stk`;
    wpsCount.textContent = `${wpsAll.length} stk`;

    const wpqrGrouped = groupByProcess(wpqrAll);
    const wpsGrouped = groupByProcess(wpsAll);

    wpqrBody.innerHTML =
      wpqrGrouped.length === 0 ? `<div class="muted">Ingen data.</div>` : wpqrGrouped.map(([p, rows]) => renderProcessTableWPQR(p, rows)).join("");

    wpsBody.innerHTML =
      wpsGrouped.length === 0 ? `<div class="muted">Ingen data.</div>` : wpsGrouped.map(([p, rows]) => renderProcessTableWPS(p, rows)).join("");
  }

  async function load() {
    wpqrBody.innerHTML = `<div class="muted">Laster…</div>`;
    wpsBody.innerHTML = `<div class="muted">Laster…</div>`;

    const [wpqrRes, wpsRes] = await Promise.all([
      supabase
        .from("wpqr")
        .select("id, doc_no, materiale, sammenfoyning, tykkelse, process, pdf_path, created_at")
        .order("process", { ascending: true })
        .order("created_at", { ascending: false }),

      supabase
        .from("wps")
        .select(`
          id,
          doc_no,
          materiale,
          sammenfoyning,
          tykkelse,
          process,
          pdf_path,
          created_at,
          wpqr_id,
          wpqr:wpqr_id (
            id,
            doc_no
          )
        `)
        .order("process", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);

    if (wpqrRes.error) throw wpqrRes.error;
    if (wpsRes.error) throw wpsRes.error;

    wpqrAll = (wpqrRes.data ?? []) as WPQRRow[];
    wpsAll = (wpsRes.data ?? []) as WPSRow[];

    renderLists();
  }

  async function uploadPdf(kind: "wpqr" | "wps", docNo: string, file: File) {
    const safeNo = docNo.replace(/[^\w\-\.]+/g, "_");
    const path = `${kind}/${safeNo}.pdf`;

    const { error: upErr } = await supabase.storage.from("docs").upload(path, file, {
      upsert: true,
      contentType: "application/pdf",
    });

    if (upErr) throw upErr;
    return path;
  }

  // -------- EDIT MODALS --------

  function openEditWpqrModal(id: string) {
    const row = wpqrAll.find((x) => x.id === id);
    if (!row) {
      alert("Fant ikke WPQR.");
      return;
    }

    modalMount.innerHTML = renderModal(
      "Endre WPQR",
      `
      <div class="modalgrid">
        <div class="field">
          <label>WPQR nr.</label>
          <input id="doc_no" class="input" value="${esc(row.doc_no)}" />
        </div>
        <div class="field">
          <label>Sveisemetode (process)</label>
          <select id="process" class="select">${renderOptions(PROSESSER, "Velg metode…")}</select>
        </div>
        <div class="field">
          <label>Materiale</label>
          <select id="materiale" class="select">${renderOptions(MATERIALER, "Velg materiale…")}</select>
        </div>
        <div class="field">
          <label>Sammenføyning</label>
          <select id="sammenfoyning" class="select">${renderOptions(SAMMENFOYNINGER, "Velg sammenføyning…")}</select>
        </div>
        <div class="field">
          <label>Tykkelse</label>
          <div class="inputgroup join">
            <input id="tykkelse" class="input" value="${esc(stripMm(row.tykkelse))}" />
            <span class="suffix">mm</span>
          </div>
        </div>

        <div class="field">
          <label>PDF (erstatt / last opp ny)</label>
          <input id="pdf" class="input" type="file" accept="application/pdf" />
          ${
            row.pdf_path
              ? `<label style="display:flex;gap:8px;align-items:center;margin-top:8px;">
                   <input id="remove_pdf" type="checkbox" />
                   <span>Fjern eksisterende PDF</span>
                 </label>`
              : `<div class="muted" style="margin-top:8px;">Ingen PDF koblet.</div>`
          }
        </div>
      </div>
      `
    );

    wireModalCommon();

    const processSel = mqs<HTMLSelectElement>("#process");
    const matSel = mqs<HTMLSelectElement>("#materiale");
    const joinSel = mqs<HTMLSelectElement>("#sammenfoyning");

    processSel.value = row.process || "";
    matSel.value = row.materiale || "";
    joinSel.value = row.sammenfoyning || "";

    const save = mqs<HTMLButtonElement>("#modalSave");
    save.textContent = "Oppdater";

    save.addEventListener("click", async () => {
      save.disabled = true;
      save.textContent = "Oppdaterer…";

      try {
        const doc_no = (mqs<HTMLInputElement>("#doc_no").value || "").trim();
        const process = (processSel.value || "").trim();
        const materiale = (matSel.value || "").trim();
        const sammenfoyning = (joinSel.value || "").trim();
        const tykkelse = stripMm(mqs<HTMLInputElement>("#tykkelse").value || "");

        const pdfFile = mqs<HTMLInputElement>("#pdf").files?.[0] ?? null;
        const removePdf = (mqsa<HTMLInputElement>("#remove_pdf")?.checked ?? false) === true;

        if (!doc_no || !process || !materiale || !sammenfoyning || !tykkelse) {
          alert("Fyll ut alle felter (PDF er valgfri).");
          return;
        }

        let pdf_path: string | null = row.pdf_path ?? null;

        if (removePdf && pdf_path) {
          await deletePdfIfExists(pdf_path);
          pdf_path = null;
        }

        if (pdfFile) {
          if (pdf_path) await deletePdfIfExists(pdf_path);
          pdf_path = await uploadPdf("wpqr", doc_no, pdfFile);
        }

        const { error } = await supabase
          .from("wpqr")
          .update({ doc_no, process, materiale, sammenfoyning, tykkelse, pdf_path })
          .eq("id", id);

        if (error) throw error;

        closeModal();
        await load();
      } catch (e: any) {
        console.error(e);
        alert(`Feil ved oppdatering: ${String(e?.message ?? e)}`);
      } finally {
        save.disabled = false;
        save.textContent = "Oppdater";
      }
    });
  }

  function openEditWpsModal(id: string) {
    const row = wpsAll.find((x) => x.id === id);
    if (!row) {
      alert("Fant ikke WPS.");
      return;
    }

    modalMount.innerHTML = renderModal(
      "Endre WPS",
      `
      <div class="modalgrid">
        <div class="field">
          <label>WPS nr.</label>
          <input id="doc_no" class="input" value="${esc(row.doc_no)}" />
        </div>
        <div class="field">
          <label>Sveisemetode (process)</label>
          <select id="process" class="select">${renderOptions(PROSESSER, "Velg metode…")}</select>
        </div>
        <div class="field">
          <label>Materiale</label>
          <select id="materiale" class="select">${renderOptions(MATERIALER, "Velg materiale…")}</select>
        </div>
        <div class="field">
          <label>Sammenføyning</label>
          <select id="sammenfoyning" class="select">${renderOptions(SAMMENFOYNINGER, "Velg sammenføyning…")}</select>
        </div>
        <div class="field">
          <label>Tykkelse</label>
          <div class="inputgroup join">
            <input id="tykkelse" class="input" value="${esc(stripMm(row.tykkelse))}" />
            <span class="suffix">mm</span>
          </div>
        </div>

        <div class="field">
          <label>Koble til WPQR (valgfritt)</label>
          <select id="wpqr_id" class="select">
            <option value="">Ikke koblet</option>
          </select>
        </div>

        <div class="field" style="grid-column: 1 / -1;">
          <label>PDF (erstatt / last opp ny)</label>
          <input id="pdf" class="input" type="file" accept="application/pdf" />
          ${
            row.pdf_path
              ? `<label style="display:flex;gap:8px;align-items:center;margin-top:8px;">
                   <input id="remove_pdf" type="checkbox" />
                   <span>Fjern eksisterende PDF</span>
                 </label>`
              : `<div class="muted" style="margin-top:8px;">Ingen PDF koblet.</div>`
          }
        </div>
      </div>
      `
    );

    wireModalCommon();

    const processSel = mqs<HTMLSelectElement>("#process");
    const matSel = mqs<HTMLSelectElement>("#materiale");
    const joinSel = mqs<HTMLSelectElement>("#sammenfoyning");
    const wpqrSel = mqs<HTMLSelectElement>("#wpqr_id");

    processSel.value = row.process || "";
    matSel.value = row.materiale || "";
    joinSel.value = row.sammenfoyning || "";

    function fillWpqrDropdown(proc: string) {
      const p = proc.trim();
      if (!p) {
        wpqrSel.innerHTML = `<option value="">Velg metode først…</option>`;
        wpqrSel.disabled = true;
        return;
      }

      wpqrSel.disabled = false;

      const list = wpqrAll
        .filter((w) => w.process === p)
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

      wpqrSel.innerHTML =
        `<option value="">Ikke koblet</option>` +
        list
          .map(
            (w) =>
              `<option value="${esc(w.id)}">${esc(w.doc_no)} • ${esc(w.materiale)} • ${esc(
                displayThickness(w.tykkelse)
              )}</option>`
          )
          .join("");
    }

    processSel.addEventListener("change", () => {
      fillWpqrDropdown(processSel.value);
      // beholder valg hvis mulig
      wpqrSel.value = row.wpqr_id ?? "";
    });

    fillWpqrDropdown(processSel.value);
    wpqrSel.value = row.wpqr_id ?? "";

    const save = mqs<HTMLButtonElement>("#modalSave");
    save.textContent = "Oppdater";

    save.addEventListener("click", async () => {
      save.disabled = true;
      save.textContent = "Oppdaterer…";

      try {
        const doc_no = (mqs<HTMLInputElement>("#doc_no").value || "").trim();
        const process = (processSel.value || "").trim();
        const materiale = (matSel.value || "").trim();
        const sammenfoyning = (joinSel.value || "").trim();
        const tykkelse = stripMm(mqs<HTMLInputElement>("#tykkelse").value || "");

        const wpqr_id = (wpqrSel.value || "").trim() || null;
        const pdfFile = mqs<HTMLInputElement>("#pdf").files?.[0] ?? null;
        const removePdf = (mqsa<HTMLInputElement>("#remove_pdf")?.checked ?? false) === true;

        if (!doc_no || !process || !materiale || !sammenfoyning || !tykkelse) {
          alert("Fyll ut alle felter (WPQR/PDF er valgfritt).");
          return;
        }

        let pdf_path: string | null = row.pdf_path ?? null;

        if (removePdf && pdf_path) {
          await deletePdfIfExists(pdf_path);
          pdf_path = null;
        }

        if (pdfFile) {
          if (pdf_path) await deletePdfIfExists(pdf_path);
          pdf_path = await uploadPdf("wps", doc_no, pdfFile);
        }

        const { error } = await supabase
          .from("wps")
          .update({ doc_no, process, materiale, sammenfoyning, tykkelse, wpqr_id, pdf_path })
          .eq("id", id);

        if (error) throw error;

        closeModal();
        await load();
      } catch (e: any) {
        console.error(e);
        alert(`Feil ved oppdatering: ${String(e?.message ?? e)}`);
      } finally {
        save.disabled = false;
        save.textContent = "Oppdater";
      }
    });
  }

  // Event delegation: PDF + edit + delete
  app.addEventListener("click", async (e) => {
    const t = e.target as HTMLElement | null;
    if (!t) return;

    // Åpne PDF
    const pdfBtn = t.closest?.("button[data-openpdf]") as HTMLButtonElement | null;
    if (pdfBtn) {
      const path = pdfBtn.getAttribute("data-openpdf");
      if (path) await openPdf(path);
      return;
    }

    // Endre WPQR
    const editWpqrBtn = t.closest?.("button[data-edit-wpqr]") as HTMLButtonElement | null;
    if (editWpqrBtn) {
      const id = editWpqrBtn.getAttribute("data-edit-wpqr") || "";
      if (!id) return;
      openEditWpqrModal(id);
      return;
    }

    // Endre WPS
    const editWpsBtn = t.closest?.("button[data-edit-wps]") as HTMLButtonElement | null;
    if (editWpsBtn) {
      const id = editWpsBtn.getAttribute("data-edit-wps") || "";
      if (!id) return;
      openEditWpsModal(id);
      return;
    }

    // Slett WPQR
    const delWpqrBtn = t.closest?.("button[data-del-wpqr]") as HTMLButtonElement | null;
    if (delWpqrBtn) {
      const id = delWpqrBtn.getAttribute("data-del-wpqr") || "";
      const label = delWpqrBtn.getAttribute("data-del-label") || "WPQR";
      if (!id) return;

      openConfirmDelete({
        title: "Slett WPQR",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?<br/>WPS som er koblet til denne blir automatisk frakoblet.`,
        onConfirm: async () => deleteWpqrById(id),
      });
      return;
    }

    // Slett WPS
    const delWpsBtn = t.closest?.("button[data-del-wps]") as HTMLButtonElement | null;
    if (delWpsBtn) {
      const id = delWpsBtn.getAttribute("data-del-wps") || "";
      const label = delWpsBtn.getAttribute("data-del-label") || "WPS";
      if (!id) return;

      openConfirmDelete({
        title: "Slett WPS",
        messageHtml: `Er du sikker på at du vil slette <b>${esc(label)}</b>?`,
        onConfirm: async () => deleteWpsById(id),
      });
      return;
    }
  });

  function openNewWpqrModal() {
    modalMount.innerHTML = renderModal(
      "Ny WPQR",
      `
      <div class="modalgrid">
        <div class="field">
          <label>WPQR nr.</label>
          <input id="doc_no" class="input" placeholder="WPQR-001" />
        </div>
        <div class="field">
          <label>Sveisemetode (process)</label>
          <select id="process" class="select">${renderOptions(PROSESSER, "Velg metode…")}</select>
        </div>
        <div class="field">
          <label>Materiale</label>
          <select id="materiale" class="select">${renderOptions(MATERIALER, "Velg materiale…")}</select>
        </div>
        <div class="field">
          <label>Sammenføyning</label>
          <select id="sammenfoyning" class="select">${renderOptions(SAMMENFOYNINGER, "Velg sammenføyning…")}</select>
        </div>
        <div class="field">
          <label>Tykkelse</label>
          <div class="inputgroup join">
            <input id="tykkelse" class="input" placeholder="6"/>
            <span class="suffix">mm</span>
          </div>
        </div>

        <div class="field">
          <label>PDF</label>
          <input id="pdf" class="input" type="file" accept="application/pdf" />
        </div>
      </div>
    `
    );

    wireModalCommon();

    const save = mqs<HTMLButtonElement>("#modalSave");
    save.addEventListener("click", async () => {
      save.disabled = true;
      save.textContent = "Lagrer…";

      try {
        const doc_no = (mqs<HTMLInputElement>("#doc_no").value || "").trim();
        const process = (mqs<HTMLSelectElement>("#process").value || "").trim();
        const materiale = (mqs<HTMLSelectElement>("#materiale").value || "").trim();
        const sammenfoyning = (mqs<HTMLSelectElement>("#sammenfoyning").value || "").trim();
        const tykkelse = stripMm(mqs<HTMLInputElement>("#tykkelse").value || "");
        const pdfFile = mqs<HTMLInputElement>("#pdf").files?.[0] ?? null;

        if (!doc_no || !process || !materiale || !sammenfoyning || !tykkelse) {
          alert("Fyll ut alle felter (unntatt PDF som er valgfri).");
          return;
        }

        let pdf_path: string | null = null;
        if (pdfFile) pdf_path = await uploadPdf("wpqr", doc_no, pdfFile);

        const { error } = await supabase.from("wpqr").insert({
          doc_no,
          process,
          materiale,
          sammenfoyning,
          tykkelse,
          pdf_path,
        });

        if (error) throw error;

        closeModal();
        await load();
      } catch (e: any) {
        console.error(e);
        alert(`Feil ved lagring: ${String(e?.message ?? e)}`);
      } finally {
        save.disabled = false;
        save.textContent = "Lagre";
      }
    });
  }

  function openNewWpsModal() {
    modalMount.innerHTML = renderModal(
      "Ny WPS",
      `
      <div class="modalgrid">
        <div class="field">
          <label>WPS nr.</label>
          <input id="doc_no" class="input" placeholder="WPS-141-001" />
        </div>
        <div class="field">
          <label>Sveisemetode (process)</label>
          <select id="process" class="select">${renderOptions(PROSESSER, "Velg metode…")}</select>
        </div>
        <div class="field">
          <label>Materiale</label>
          <select id="materiale" class="select">${renderOptions(MATERIALER, "Velg materiale…")}</select>
        </div>
        <div class="field">
          <label>Sammenføyning</label>
          <select id="sammenfoyning" class="select">${renderOptions(SAMMENFOYNINGER, "Velg sammenføyning…")}</select>
        </div>
        <div class="field">
          <label>Tykkelse</label>
          <div class="inputgroup join">
            <input id="tykkelse" class="input" placeholder="3-6" />
            <span class="suffix">mm</span>
          </div>
        </div>

        <div class="field">
          <label>Koble til WPQR (valgfritt)</label>
          <select id="wpqr_id" class="select">
            <option value="">Ikke koblet</option>
          </select>
        </div>

        <div class="field" style="grid-column: 1 / -1;">
          <label>PDF</label>
          <input id="pdf" class="input" type="file" accept="application/pdf" />
        </div>
      </div>
    `
    );

    wireModalCommon();

    const processSel = mqs<HTMLSelectElement>("#process");
    const wpqrSel = mqs<HTMLSelectElement>("#wpqr_id");

    function fillWpqrDropdown(proc: string) {
      const p = proc.trim();
      if (!p) {
        wpqrSel.innerHTML = `<option value="">Velg metode først…</option>`;
        wpqrSel.disabled = true;
        return;
      }

      wpqrSel.disabled = false;

      const list = wpqrAll
        .filter((w) => w.process === p)
        .slice()
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

      wpqrSel.innerHTML =
        `<option value="">Ikke koblet</option>` +
        list
          .map(
            (w) =>
              `<option value="${esc(w.id)}">${esc(w.doc_no)} • ${esc(w.materiale)} • ${esc(
                displayThickness(w.tykkelse)
              )}</option>`
          )
          .join("");
    }

    processSel.addEventListener("change", () => fillWpqrDropdown(processSel.value));
    fillWpqrDropdown(processSel.value);

    const save = mqs<HTMLButtonElement>("#modalSave");
    save.addEventListener("click", async () => {
      save.disabled = true;
      save.textContent = "Lagrer…";

      try {
        const doc_no = (mqs<HTMLInputElement>("#doc_no").value || "").trim();
        const process = (processSel.value || "").trim();
        const materiale = (mqs<HTMLSelectElement>("#materiale").value || "").trim();
        const sammenfoyning = (mqs<HTMLSelectElement>("#sammenfoyning").value || "").trim();
        const tykkelse = stripMm(mqs<HTMLInputElement>("#tykkelse").value || "");

        const wpqr_id = (wpqrSel.value || "").trim() || null;
        const pdfFile = mqs<HTMLInputElement>("#pdf").files?.[0] ?? null;

        if (!doc_no || !process || !materiale || !sammenfoyning || !tykkelse) {
          alert("Fyll ut alle felter (unntatt WPQR/PDF som er valgfritt).");
          return;
        }

        let pdf_path: string | null = null;
        if (pdfFile) pdf_path = await uploadPdf("wps", doc_no, pdfFile);

        const { error } = await supabase.from("wps").insert({
          doc_no,
          process,
          materiale,
          sammenfoyning,
          tykkelse,
          wpqr_id,
          pdf_path,
        });

        if (error) throw error;

        closeModal();
        await load();
      } catch (e: any) {
        console.error(e);
        alert(`Feil ved lagring: ${String(e?.message ?? e)}`);
      } finally {
        save.disabled = false;
        save.textContent = "Lagre";
      }
    });
  }

  refreshBtn.addEventListener("click", () => load());
  newWpqrBtn.addEventListener("click", openNewWpqrModal);
  newWpsBtn.addEventListener("click", openNewWpsModal);

  try {
    await load();
  } catch (e: any) {
    console.error(e);
    wpqrBody.innerHTML = `<div class="err">Feil: ${esc(String(e?.message ?? e))}</div>`;
    wpsBody.innerHTML = `<div class="err">Feil: ${esc(String(e?.message ?? e))}</div>`;
  }
}
