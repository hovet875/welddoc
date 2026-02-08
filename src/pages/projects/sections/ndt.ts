import type { ProjectRow } from "../../../repo/projectRepo";

import { esc, qs } from "../../../utils/dom";
import { fmtDate, truncateLabel } from "../../../utils/format";
import { fetchNdtReports } from "../../../repo/ndtReportRepo";
import { createSignedUrlForFileRef } from "../../../repo/fileRepo";
import { openPdfPreview } from "../../../ui/pdfPreview";

export async function renderProjectNdtSection(opts: {
  mount: HTMLElement;
  project: ProjectRow;
  signal: AbortSignal;
}) {
  const { mount, project, signal } = opts;

  mount.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">NDT-rapporter</div>
        <div class="panel-meta" data-ndt-count>—</div>
      </div>
      <div class="panel-body">
        <div data-ndt-body class="listmount"><div class="muted">Laster…</div></div>
      </div>
    </section>
  `;

  const listBody = qs<HTMLDivElement>(mount, "[data-ndt-body]");
  const count = qs<HTMLDivElement>(mount, "[data-ndt-count]");

  const projectNo = String(project.project_no ?? "").trim();

  let rows: Awaited<ReturnType<typeof fetchNdtReports>> = [];

  const renderRows = () => {
    if (rows.length === 0) {
      count.textContent = "0 stk";
      listBody.innerHTML = `<div class="muted">Ingen NDT-rapporter for dette prosjektet.</div>`;
      return;
    }

    count.textContent = `${rows.length} stk`;

    listBody.innerHTML = `
      <div class="table-scroll">
        <table class="data-table project-ndt-table">
          <thead>
            <tr>
              <th>Fil</th>
              <th>Metode</th>
              <th>Rapportdato</th>
              <th>Kunde</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((r) => {
                const fileLabel = r.file?.label || "Rapport";
                const fileBase = fileLabel.replace(/\.pdf$/i, "");
                const displayName = truncateLabel(fileBase, 20);
                const methodLabel = (r.method?.code || r.method?.label || "").trim() || "—";
                return `
                  <tr>
                    <td data-label="Fil">
                      ${r.file_id
                        ? `<button type="button" class="type-pill pill-other linkbtn" data-openpdf="${esc(r.file_id)}" title="${esc(fileBase)}">${esc(displayName)}</button>`
                        : `<span class="muted">${esc(displayName)}</span>`}
                    </td>
                    <td data-label="Metode">${esc(methodLabel)}</td>
                    <td data-label="Rapportdato">${esc(fmtDate(r.report_date ?? r.created_at))}</td>
                    <td data-label="Kunde">${esc(r.customer ?? "")}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  };

  const load = async () => {
    try {
      const all = await fetchNdtReports();
      rows = all.filter((r) => (r.title || "").trim() === projectNo);
      renderRows();
    } catch (e: any) {
      console.error(e);
      listBody.innerHTML = `<div class="err">Feil: ${esc(String(e?.message ?? e))}</div>`;
    }
  };

  listBody.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement;
      const openId = target.closest("[data-openpdf]")?.getAttribute("data-openpdf");
      if (!openId) return;
      try {
        const url = await createSignedUrlForFileRef(openId, { expiresSeconds: 120 });
        const row = rows.find((r) => r.file_id === openId);
        const label = row?.file?.label || "NDT-rapport";
        openPdfPreview({ url, title: label });
      } catch (err) {
        console.error(err);
        alert("Klarte ikke å åpne PDF.");
      }
    },
    { signal }
  );

  await load();
}
