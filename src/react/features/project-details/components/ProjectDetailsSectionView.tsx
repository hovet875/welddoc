import type { ProjectDetailsSectionKey } from "../projectDetails.types";
import type { ProjectRow } from "@/repo/projectRepo";
import { ProjectDocumentationPackageSection } from "../sections/documentation-package/ProjectDocumentationPackageSection";
import { ProjectDocumentsSection } from "../sections/documents/ProjectDocumentsSection";
import { ProjectDrawingsSection } from "../sections/drawings/ProjectDrawingsSection";
import { ProjectOverviewSection } from "../sections/overview/ProjectOverviewSection";
import { ProjectPressureTestSection } from "../sections/pressure-test/ProjectPressureTestSection";
import { ProjectTraceabilitySection } from "../sections/traceability/ProjectTraceabilitySection";
import { ProjectWeldLogSection } from "../sections/weld-log/ProjectWeldLogSection";
import { ProjectWorkOrderSection } from "../sections/work-order/ProjectWorkOrderSection";

type ProjectDetailsSectionViewProps = {
  section: ProjectDetailsSectionKey;
  projectId: string;
  isAdmin: boolean;
  project: ProjectRow;
};

export function ProjectDetailsSectionView({ section, projectId, isAdmin, project }: ProjectDetailsSectionViewProps) {
  if (section === "oversikt") {
    return <ProjectOverviewSection projectId={projectId} />;
  }

  if (section === "arbeidsordre") {
    return <ProjectWorkOrderSection projectId={projectId} isAdmin={isAdmin} />;
  }

  if (section === "tegninger") return <ProjectDrawingsSection projectId={projectId} isAdmin={isAdmin} />;
  if (section === "sporbarhet") return <ProjectTraceabilitySection projectId={projectId} isAdmin={isAdmin} project={project} />;
  if (section === "sveiselogg") return <ProjectWeldLogSection projectId={projectId} isAdmin={isAdmin} project={project} />;
  if (section === "dokumenter") return <ProjectDocumentsSection />;
  if (section === "trykktest") return <ProjectPressureTestSection />;
  if (section === "dokumentasjonspakke") return <ProjectDocumentationPackageSection />;

  return null;
}
