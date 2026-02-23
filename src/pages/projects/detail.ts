import { renderHeader, wireHeader } from "../../components/header";
import { getSession, getProfileAccess } from "../../app/auth";
import { Footer } from "../../components/footer";
import { fetchProjectById } from "../../repo/projectRepo";
import { esc, qs } from "../../utils/dom";
import { renderProjectDrawingsSection } from "./sections/drawings";
import { renderProjectWorkOrderSection } from "./sections/work-order";
import { renderProjectTraceabilitySection } from "./sections/traceability";
import { renderProjectWeldLogSection } from "./sections/weld-log";
import { renderProjectDocumentationPackageSection } from "./sections/documentation-pack";
import { renderProjectPressureTestSection } from "./sections/pressure-test";
import { renderProjectLinkedDocumentsSection } from "./sections/linked-documents";

import "../../styles/pages/projects.css";

const sections = [
  { key: "arbeidsordre", label: "Arbeidsordre" },
  { key: "tegninger", label: "Tegninger" },
  { key: "sporbarhet", label: "Materialsporbarhet" },
  { key: "sveiselogg", label: "Sveiselogg" },
  { key: "dokumenter", label: "Koblede dokumenter" },
  { key: "trykktest", label: "Trykktest" },
  { key: "dokumentasjonspakke", label: "Generer dokumentasjonspakke" },
];

export async function renderProjectDetail(app: HTMLElement, projectId: string, section?: string | null) {
  const prev = (app as any).__project_detail_unmount as undefined | (() => void);
  if (prev) prev();

  const controller = new AbortController();
  const { signal } = controller;

  (app as any).__project_detail_unmount = () => {
    controller.abort();
    (app as any).__project_detail_unmount = undefined;
  };

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

  const project = await fetchProjectById(projectId);
  if (!project) {
    app.innerHTML = `
      <div class="shell page-projects">
        ${renderHeader(displayName, email)}
        <main class="main">
          <section class="panel">
            <div class="panel-body">
              <div class="err">Fant ikke prosjekt.</div>
            </div>
          </section>
        </main>
        ${Footer()}
      </div>
    `;
    wireHeader(app);
    return;
  }

  const requestedSection = section || "";
  const currentSection =
    requestedSection === "wps" || requestedSection === "sveisesertifikat" || requestedSection === "ndt"
      ? "dokumenter"
      : requestedSection;

  app.innerHTML = `
    <div class="shell page-projects">
      ${renderHeader(displayName, email)}

      <main class="main">
        <section class="section-header">
          <div>
            <h1 class="section-title">${esc(String(project.project_no))} – ${esc(project.name)}</h1>
            <p class="section-subtitle">${esc(project.customer)} · AO ${esc(project.work_order)}</p>
          </div>
          <div class="section-actions">
            ${currentSection === "tegninger" && isAdmin ? `<button data-open-drawing-upload class="btn accent small" type="button">Last opp tegninger</button>` : ""}
            ${currentSection === "arbeidsordre" && isAdmin ? `<button data-open-workorder-upload class="btn accent small" type="button">Last opp arbeidsordre</button>` : ""}
            ${currentSection === "sporbarhet" && isAdmin ? `<button data-open-trace-add class="btn accent small" type="button">Ny sporbarhet</button>` : ""}
            ${currentSection === "sveiselogg" ? `<button data-open-weld-add class="btn accent small" type="button">Ny sveis</button>` : ""}
            <a class="btn small" href="#/prosjekter">Tilbake</a>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <div class="panel-title">Prosjektmeny</div>
            <div class="panel-meta">Velg område</div>
          </div>
          <div class="panel-body">
            <div class="project-menu">
              ${sections
                .map((s) => {
                  const isActive = s.key === currentSection;
                  const isDocPack = s.key === "dokumentasjonspakke";
                  const cls = `project-card${isActive ? " is-active" : ""}${isDocPack ? " is-docpack" : ""}`;
                  return `
                    <a class="${cls}" href="#/prosjekter/${project.id}/${s.key}">
                      <div class="project-card-title">${s.label}</div>
                    </a>
                  `;
                })
                .join("")}
            </div>
          </div>
        </section>

        <div data-project-section></div>
        <div data-modal-mount></div>
      </main>

      ${Footer()}
    </div>
  `;

  wireHeader(app);

  const sectionMount = qs<HTMLDivElement>(app, "[data-project-section]");
  const modalMount = qs<HTMLDivElement>(app, "[data-modal-mount]");

  if (currentSection === "tegninger") {
    await renderProjectDrawingsSection({ app, mount: sectionMount, modalMount, project, isAdmin, signal });
    return;
  }

  if (currentSection === "arbeidsordre") {
    await renderProjectWorkOrderSection({ app, mount: sectionMount, modalMount, project, isAdmin, signal });
    return;
  }

  if (currentSection === "sporbarhet") {
    await renderProjectTraceabilitySection({ app, mount: sectionMount, modalMount, project, isAdmin, signal });
    return;
  }

  if (currentSection === "dokumenter") {
    await renderProjectLinkedDocumentsSection({ mount: sectionMount, project, signal });
    return;
  }

  if (currentSection === "sveiselogg") {
    await renderProjectWeldLogSection({ app, mount: sectionMount, modalMount, project, isAdmin, signal });
    return;
  }

  if (currentSection === "trykktest") {
    await renderProjectPressureTestSection({ mount: sectionMount, modalMount, project, isAdmin, signal });
    return;
  }

  if (currentSection === "dokumentasjonspakke") {
    await renderProjectDocumentationPackageSection({ mount: sectionMount, project, signal });
    return;
  }

  if (currentSection) {
    sectionMount.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <div class="panel-title">${sections.find((s) => s.key === currentSection)?.label ?? ""}</div>
          <div class="panel-meta">Kommer</div>
        </div>
        <div class="panel-body">
          <div class="muted">Denne delen er ikke bygget enda.</div>
        </div>
      </section>
    `;
  }
}
