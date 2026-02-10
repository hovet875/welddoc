import type { ProjectRow } from "../../../repo/projectRepo";
import type { MaterialCertificateRow } from "../../../repo/materialCertificateRepo";
import type { MaterialRow } from "../../../repo/materialRepo";
import type { TraceabilityOptionRow, TraceabilityTypeRow, ProjectTraceabilityRow } from "../../../repo/traceabilityRepo";

import { esc, qs } from "../../../utils/dom";
import { openConfirmDelete } from "../../../ui/confirm";
import { toast } from "../../../ui/toast";
import { iconSvg, renderIconButton } from "../../../ui/iconButton";
import { openTraceabilityEditModal } from "./traceabilityModal";
import { printTraceabilityTable, renderTraceabilityRows } from "./traceabilityView";
import {
  deleteProjectTraceability,
  fetchProjectTraceability,
  fetchTraceabilityOptions,
  fetchTraceabilityTypes,
} from "../../../repo/traceabilityRepo";
import { fetchMaterialCertificates } from "../../../repo/materialCertificateRepo";
import { fetchMaterials } from "../../../repo/materialRepo";
import { createSignedUrlForFileRef } from "../../../repo/fileRepo";
import { openPdfPreview } from "../../../ui/pdfPreview";

export async function renderProjectTraceabilitySection(opts: {
  app: HTMLElement;
  mount: HTMLElement;
  modalMount: HTMLElement;
  project: ProjectRow;
  isAdmin: boolean;
  signal: AbortSignal;
}) {
  const { app, mount, modalMount, project, isAdmin, signal } = opts;

  mount.innerHTML = `
    <section class="panel">
      <div class="panel-head">
        <div class="panel-title">Materialsporbarhet</div>
        <div class="panel-actions">
          ${renderIconButton({ dataKey: "trace-print", id: "trace-print", title: "Skriv ut", icon: iconSvg("print") })}
        </div>
      </div>
      <div class="panel-body">
        <div class="table-scroll">
          <table class="data-table trace-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Komponent</th>
                <th>Material/type</th>
                <th>Dimensjon</th>
                <th>Heat</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody data-trace-body>
              <tr><td colspan="7" class="muted">Laster…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  const traceBody = qs<HTMLTableSectionElement>(mount, "[data-trace-body]");
  const openAddBtn = app.querySelector<HTMLButtonElement>("[data-open-trace-add]");
  const printBtn = mount.querySelector<HTMLButtonElement>("[data-trace-print]");

  let types: TraceabilityTypeRow[] = [];
  let optionsDn: TraceabilityOptionRow[] = [];
  let optionsSch: TraceabilityOptionRow[] = [];
  let optionsPn: TraceabilityOptionRow[] = [];
  let optionsFiller: TraceabilityOptionRow[] = [];
  let certs: MaterialCertificateRow[] = [];
  let rows: ProjectTraceabilityRow[] = [];
  let materials: MaterialRow[] = [];

  const renderRows = () => {
    renderTraceabilityRows({ rows, types, isAdmin, traceBody });
  };

  const printTable = async () => {
    await printTraceabilityTable({ rows, types, project });
  };

  const refreshRows = async () => {
    rows = await fetchProjectTraceability(project.id);
    renderRows();
  };

  const openEditModal = (row?: ProjectTraceabilityRow) => {
    openTraceabilityEditModal({
      modalMount,
      signal,
      isAdmin,
      projectId: project.id,
      types,
      optionsDn,
      optionsSch,
      optionsPn,
      optionsFiller,
      materials,
      certs,
      row,
      onSaved: refreshRows,
    });
  };

  traceBody.addEventListener(
    "click",
    async (e) => {
      const target = e.target as HTMLElement;
      const openCert = target.closest("[data-open-cert]")?.getAttribute("data-open-cert");
      if (openCert) {
        const url = await createSignedUrlForFileRef(openCert, { expiresSeconds: 120 });
        openPdfPreview({ url, title: "Materialsertifikat" });
        return;
      }
      const editId = target.closest("[data-trace-edit]")?.getAttribute("data-trace-edit");
      if (editId) {
        const row = rows.find((r) => r.id === editId);
        if (row) openEditModal(row);
        return;
      }
      const delId = target.closest("[data-trace-del]")?.getAttribute("data-trace-del");
      if (delId) {
        const row = rows.find((r) => r.id === delId);
        if (!row) return;
        await openConfirmDelete(modalMount, signal, {
          title: "Slett sporbarhet",
          messageHtml: `Slett ${esc(row.type_code)}?`,
          onConfirm: async () => deleteProjectTraceability(row.id),
          onDone: async () => {
            rows = await fetchProjectTraceability(project.id);
            renderRows();
          },
        });
      }
    },
    { signal }
  );

  if (openAddBtn) {
    openAddBtn.addEventListener(
      "click",
      () => {
        if (!isAdmin) {
          toast("Du må være admin for å gjøre dette.");
          return;
        }
        openEditModal();
      },
      { signal }
    );
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => printTable(), { signal });
  }

  const load = async () => {
    traceBody.innerHTML = `<tr><td colspan="7" class="muted">Laster…</td></tr>`;
    try {
      const [t, dn, sch, pn, filler, certRows, traceRows, materialRows] = await Promise.all([
        fetchTraceabilityTypes(),
        fetchTraceabilityOptions("dn"),
        fetchTraceabilityOptions("sch"),
        fetchTraceabilityOptions("pn"),
        fetchTraceabilityOptions("filler_type"),
        fetchMaterialCertificates(),
        fetchProjectTraceability(project.id),
        fetchMaterials(),
      ]);
      types = t;
      optionsDn = dn;
      optionsSch = sch;
      optionsPn = pn;
      optionsFiller = filler;
      certs = certRows;
      rows = traceRows;
      materials = materialRows;
      renderRows();
    } catch (e: any) {
      console.error(e);
      traceBody.innerHTML = `<tr><td colspan="6" class="err">Feil: ${esc(String(e?.message ?? e))}</td></tr>`;
    }
  };

  await load();
}
