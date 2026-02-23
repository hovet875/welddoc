import type { ProjectRow } from "../../../repo/projectRepo";
import { fetchProjectWelds } from "../../../repo/weldLogRepo";
import { fetchProjectTraceability } from "../../../repo/traceabilityRepo";
import { createSignedUrlForFileRef } from "../../../repo/fileRepo";
import { supabase } from "../../../services/supabaseClient";
import { openPdfPreview } from "../../../ui/pdfPreview";
import { esc, qs } from "../../../utils/dom";
import { fmtDate } from "../../../utils/format";

type LinkedWpsRow = {
  id: string;
  doc_no: string | null;
  process: string | null;
  file_id: string | null;
  standard: { label: string } | null;
  file: { label: string | null } | null;
  wpqr: {
    id: string;
    doc_no: string | null;
    file_id: string | null;
    file: { label: string | null } | null;
  } | null;
};

type LinkedWelderCertRow = {
  id: string;
  certificate_no: string;
  standard: string;
  welding_process_code: string | null;
  expires_at: string | null;
  file_id: string | null;
  profile: { display_name: string | null; welder_no: string | null } | null;
  file: { label: string | null } | null;
};

type LinkedNdtRow = {
  id: string;
  file_id: string | null;
  title: string | null;
  report_date: string | null;
  created_at: string;
  method: { code: string | null; label: string | null } | null;
  file: { label: string | null } | null;
};

type LinkedMaterialCertRow = {
  id: string;
  certificate_type: "material" | "filler" | string;
  cert_type: string | null;
  supplier: string | null;
  heat_numbers: string[] | null;
  file_id: string | null;
  created_at: string;
  file: { label: string | null } | null;
  use_count: number;
};

const pickOne = <T>(value: T | T[] | null | undefined): T | null => {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
};

const uniq = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));

async function fetchLinkedWps(ids: string[]): Promise<LinkedWpsRow[]> {
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("wps")
    .select(
      `
      id,
      doc_no,
      process,
      file_id,
      standard:standard_id (
        label
      ),
      wpqr:wpqr_id (
        id,
        doc_no,
        file_id,
        file:file_id (
          label
        )
      ),
      file:file_id (
        label
      )
    `
    )
    .in("id", ids)
    .order("doc_no", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const wpqrRow = pickOne(row.wpqr);
    const wpqrFile = pickOne(wpqrRow?.file);
    return {
      id: String(row.id),
      doc_no: row.doc_no ?? null,
      process: row.process ?? null,
      file_id: row.file_id ?? null,
      standard: pickOne(row.standard),
      file: pickOne(row.file),
      wpqr: wpqrRow
        ? {
            id: String(wpqrRow.id),
            doc_no: wpqrRow.doc_no ?? null,
            file_id: wpqrRow.file_id ?? null,
            file: wpqrFile ? { label: wpqrFile.label ?? null } : null,
          }
        : null,
    };
  }) as LinkedWpsRow[];
}

async function fetchLinkedWelderCerts(ids: string[]): Promise<LinkedWelderCertRow[]> {
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("welder_certificates")
    .select(
      `
      id,
      certificate_no,
      standard,
      welding_process_code,
      expires_at,
      file_id,
      profile:profile_id (
        display_name,
        welder_no
      ),
      file:file_id (
        label
      )
    `
    )
    .in("id", ids)
    .order("certificate_no", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    certificate_no: String(row.certificate_no ?? ""),
    standard: String(row.standard ?? ""),
    welding_process_code: row.welding_process_code ?? null,
    expires_at: row.expires_at ?? null,
    file_id: row.file_id ?? null,
    profile: pickOne(row.profile),
    file: pickOne(row.file),
  })) as LinkedWelderCertRow[];
}

async function fetchLinkedNdtByIds(ids: string[]): Promise<LinkedNdtRow[]> {
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("ndt_reports")
    .select(
      `
      id,
      file_id,
      title,
      report_date,
      created_at,
      method:method_id (
        code,
        label
      ),
      file:file_id (
        label
      )
    `
    )
    .in("id", ids)
    .order("report_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    file_id: row.file_id ?? null,
    title: row.title ?? null,
    report_date: row.report_date ?? null,
    created_at: row.created_at ?? "",
    method: pickOne(row.method),
    file: pickOne(row.file),
  })) as LinkedNdtRow[];
}

async function fetchLinkedNdtByProjectNo(projectNo: string): Promise<LinkedNdtRow[]> {
  const normalized = String(projectNo ?? "").trim();
  if (!normalized) return [];

  const { data, error } = await supabase
    .from("ndt_reports")
    .select(
      `
      id,
      file_id,
      title,
      report_date,
      created_at,
      method:method_id (
        code,
        label
      ),
      file:file_id (
        label
      )
    `
    )
    .eq("title", normalized)
    .order("report_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    file_id: row.file_id ?? null,
    title: row.title ?? null,
    report_date: row.report_date ?? null,
    created_at: row.created_at ?? "",
    method: pickOne(row.method),
    file: pickOne(row.file),
  })) as LinkedNdtRow[];
}

const openButton = (fileId: string | null, label: string, title: string) => {
  if (!fileId) return `<span class="muted">Mangler PDF</span>`;
  return `<button type="button" class="btn small" data-doc-open="${esc(fileId)}" data-doc-title="${esc(title)}">${esc(label)}</button>`;
};

const standardLabel = (row: LinkedWpsRow) => {
  const label = String(row.standard?.label ?? "").trim();
  return label || "-";
};

const welderLabel = (row: LinkedWelderCertRow) => {
  const no = String(row.profile?.welder_no ?? "").trim();
  const name = String(row.profile?.display_name ?? "").trim();
  return [no, name].filter(Boolean).join(" - ") || "-";
};

const ndtDateSort = (row: LinkedNdtRow) => Date.parse(String(row.report_date ?? row.created_at ?? "")) || 0;

const materialCertTypeLabel = (value: string | null | undefined) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "filler") return "Tilsett";
  if (normalized === "material") return "Materiale";
  return normalized || "-";
};

const sortByDateDesc = (value: string | null | undefined) => Date.parse(String(value ?? "")) || 0;

const renderWpqrCell = (row: LinkedWpsRow) => {
  if (!row.wpqr) return `<span class="muted">-</span>`;

  const docNo = String(row.wpqr.doc_no ?? "").trim() || row.wpqr.id;
  const title = String(row.wpqr.file?.label ?? "").trim() || `WPQR ${docNo}`;

  return `
    <div class="project-linked-doccell">
      <span>${esc(docNo)}</span>
      ${openButton(row.wpqr.file_id, "Åpne WPQR", title)}
    </div>
  `;
};

export async function renderProjectLinkedDocumentsSection(opts: {
  mount: HTMLElement;
  project: ProjectRow;
  signal: AbortSignal;
}) {
  const { mount, project, signal } = opts;

  mount.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">Koblede dokumenter</div>
        <div class="panel-meta" data-linked-docs-meta>Laster...</div>
      </div>
      <div class="panel-body">
        <div data-linked-docs-body class="listmount"><div class="muted">Laster...</div></div>
      </div>
    </section>
  `;

  const body = qs<HTMLDivElement>(mount, "[data-linked-docs-body]");
  const meta = qs<HTMLDivElement>(mount, "[data-linked-docs-meta]");

  const load = async () => {
    try {
      const [{ welds }, traceRows] = await Promise.all([fetchProjectWelds(project.id), fetchProjectTraceability(project.id)]);

      const wpsIds = uniq(welds.map((row) => row.wps_id));
      const certIds = uniq(welds.map((row) => row.welder_cert_id));
      const ndtIds = uniq([
        ...welds.map((row) => row.crack_report_id),
        ...welds.map((row) => row.volumetric_report_id),
      ]);
      const projectNo = String(project.project_no ?? "").trim();

      const [wpsRows, certRows, ndtByIds, ndtByProject] = await Promise.all([
        fetchLinkedWps(wpsIds),
        fetchLinkedWelderCerts(certIds),
        fetchLinkedNdtByIds(ndtIds),
        fetchLinkedNdtByProjectNo(projectNo),
      ]);

      const ndtMap = new Map<string, LinkedNdtRow>();
      [...ndtByIds, ...ndtByProject].forEach((row) => ndtMap.set(row.id, row));
      const ndtRows = Array.from(ndtMap.values()).sort((a, b) => ndtDateSort(b) - ndtDateSort(a));

      const wpqrCount = new Set(
        wpsRows
          .map((row) => String(row.wpqr?.id ?? "").trim())
          .filter(Boolean)
      ).size;

      const ndtUseCount = new Map<string, number>();
      welds.forEach((row) => {
        const ids = uniq([row.crack_report_id, row.volumetric_report_id]);
        ids.forEach((id) => ndtUseCount.set(id, (ndtUseCount.get(id) ?? 0) + 1));
      });

      const materialCertMap = new Map<string, LinkedMaterialCertRow>();
      traceRows.forEach((row) => {
        const cert = row.cert;
        if (!cert?.id) return;

        const id = String(cert.id);
        const existing = materialCertMap.get(id);
        if (existing) {
          existing.use_count += 1;
          return;
        }

        materialCertMap.set(id, {
          id,
          certificate_type: cert.certificate_type,
          cert_type: cert.cert_type ?? null,
          supplier: cert.supplier ?? null,
          heat_numbers: cert.heat_numbers ?? null,
          file_id: cert.file_id ?? null,
          created_at: cert.created_at,
          file: cert.file ? { label: cert.file.label ?? null } : null,
          use_count: 1,
        });
      });

      const materialCertRows = Array.from(materialCertMap.values()).sort((a, b) => {
        if (b.use_count !== a.use_count) return b.use_count - a.use_count;
        return sortByDateDesc(b.created_at) - sortByDateDesc(a.created_at);
      });

      const total = wpsRows.length + wpqrCount + certRows.length + ndtRows.length + materialCertRows.length;
      meta.textContent = `${total} dokumenter`;

      if (total === 0) {
        body.innerHTML = `<div class="muted">Ingen koblede dokumenter funnet for prosjektet.</div>`;
        return;
      }

      body.innerHTML = `
        <div class="project-linked-summary">
          <div class="project-linked-pill"><span>WPS</span><strong>${wpsRows.length}</strong></div>
          <div class="project-linked-pill"><span>WPQR</span><strong>${wpqrCount}</strong></div>
          <div class="project-linked-pill"><span>Sveisesertifikater</span><strong>${certRows.length}</strong></div>
          <div class="project-linked-pill"><span>Materialsertifikater</span><strong>${materialCertRows.length}</strong></div>
          <div class="project-linked-pill"><span>NDT-rapporter</span><strong>${ndtRows.length}</strong></div>
        </div>

        <div class="project-linked-grid">
          <article class="project-linked-card">
            <div class="project-linked-card-head">
              <h3>WPS</h3>
              <span class="muted">${wpsRows.length} stk</span>
            </div>
            ${
              !wpsRows.length
                ? `<div class="muted">Ingen WPS er koblet i sveiseloggen.</div>`
                : `
                  <div class="table-scroll">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Dok.nr</th>
                          <th>Prosess</th>
                          <th>Standard</th>
                          <th>WPQR</th>
                          <th>PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${wpsRows
                          .map((row) => {
                            const docNo = String(row.doc_no ?? "").trim() || row.id;
                            const fileName = String(row.file?.label ?? "").trim() || `WPS ${docNo}`;
                            return `
                              <tr>
                                <td>${esc(docNo)}</td>
                                <td>${esc(String(row.process ?? "").trim() || "-")}</td>
                                <td>${esc(standardLabel(row))}</td>
                                <td>${renderWpqrCell(row)}</td>
                                <td>${openButton(row.file_id, "Åpne WPS", fileName)}</td>
                              </tr>
                            `;
                          })
                          .join("")}
                      </tbody>
                    </table>
                  </div>
                `
            }
          </article>

          <article class="project-linked-card">
            <div class="project-linked-card-head">
              <h3>Sveisesertifikater</h3>
              <span class="muted">${certRows.length} stk</span>
            </div>
            ${
              !certRows.length
                ? `<div class="muted">Ingen sveisesertifikater er koblet i sveiseloggen.</div>`
                : `
                  <div class="table-scroll">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Sertifikat</th>
                          <th>Sveiser</th>
                          <th>Gyldig til</th>
                          <th>PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${certRows
                          .map((row) => {
                            const certNo = String(row.certificate_no ?? "").trim() || row.id;
                            const fileName = String(row.file?.label ?? "").trim() || `Sveisesertifikat ${certNo}`;
                            return `
                              <tr>
                                <td>${esc(certNo)}</td>
                                <td>${esc(welderLabel(row))}</td>
                                <td>${esc(row.expires_at ? fmtDate(row.expires_at) : "-")}</td>
                                <td>${openButton(row.file_id, "Åpne", fileName)}</td>
                              </tr>
                            `;
                          })
                          .join("")}
                      </tbody>
                    </table>
                  </div>
                `
            }
          </article>

          <article class="project-linked-card">
            <div class="project-linked-card-head">
              <h3>Materialsertifikater</h3>
              <span class="muted">${materialCertRows.length} stk</span>
            </div>
            ${
              !materialCertRows.length
                ? `<div class="muted">Ingen materialsertifikater er koblet i sporbarheten.</div>`
                : `
                  <div class="table-scroll">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Sertifikat</th>
                          <th>Type</th>
                          <th>Leverandør</th>
                          <th>Heat nr.</th>
                          <th>Brukt i antall sporbarhet</th>
                          <th>PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${materialCertRows
                          .map((row) => {
                            const title = String(row.file?.label ?? row.cert_type ?? row.id).trim();
                            const heatList = (row.heat_numbers ?? []).map((v) => String(v ?? "").trim()).filter(Boolean).join(", ");
                            return `
                              <tr>
                                <td>${esc(title || row.id)}</td>
                                <td>${esc(materialCertTypeLabel(row.certificate_type))}</td>
                                <td>${esc(String(row.supplier ?? "").trim() || "-")}</td>
                                <td>${esc(heatList || "-")}</td>
                                <td>${esc(String(row.use_count))}</td>
                                <td>${openButton(row.file_id, "Åpne", title || row.id)}</td>
                              </tr>
                            `;
                          })
                          .join("")}
                      </tbody>
                    </table>
                  </div>
                `
            }
          </article>

          <article class="project-linked-card">
            <div class="project-linked-card-head">
              <h3>NDT-rapporter</h3>
              <span class="muted">${ndtRows.length} stk</span>
            </div>
            ${
              !ndtRows.length
                ? `<div class="muted">Ingen NDT-rapporter funnet for prosjektet.</div>`
                : `
                  <div class="table-scroll">
                    <table class="data-table">
                      <thead>
                        <tr>
                          <th>Rapport</th>
                          <th>Metode</th>
                          <th>Dato</th>
                          <th>Brukt i antall sveis</th>
                          <th>PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${ndtRows
                          .map((row) => {
                            const method = String(row.method?.code ?? row.method?.label ?? "").trim() || "-";
                            const title = String(row.file?.label ?? row.title ?? row.id).trim();
                            const date = row.report_date ? fmtDate(row.report_date) : fmtDate(row.created_at);
                            const usedCount = ndtUseCount.get(row.id) ?? 0;
                            return `
                              <tr>
                                <td>${esc(title)}</td>
                                <td>${esc(method)}</td>
                                <td>${esc(date)}</td>
                                <td>${esc(String(usedCount))}</td>
                                <td>${openButton(row.file_id, "Åpne", title)}</td>
                              </tr>
                            `;
                          })
                          .join("")}
                      </tbody>
                    </table>
                  </div>
                `
            }
          </article>
        </div>
      `;
    } catch (error: any) {
      console.error(error);
      meta.textContent = "Feil";
      body.innerHTML = `<div class="err">Feil: ${esc(String(error?.message ?? error ?? "Ukjent feil"))}</div>`;
    }
  };

  body.addEventListener(
    "click",
    async (event) => {
      const target = event.target as HTMLElement;
      const button = target.closest<HTMLElement>("[data-doc-open]");
      if (!button) return;

      const fileId = String(button.getAttribute("data-doc-open") ?? "").trim();
      if (!fileId) return;

      const title = String(button.getAttribute("data-doc-title") ?? "Dokument").trim() || "Dokument";

      try {
        const url = await createSignedUrlForFileRef(fileId, { expiresSeconds: 120 });
        openPdfPreview({ url, title });
      } catch (error) {
        console.error(error);
        alert("Klarte ikke å åpne PDF.");
      }
    },
    { signal }
  );

  await load();
}
