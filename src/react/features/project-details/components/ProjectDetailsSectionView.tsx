import { Suspense, lazy } from "react";
import { Text } from "@mantine/core";
import type { ProjectDetailsSectionKey } from "../projectDetails.types";
import type { ProjectRow } from "@/repo/projectRepo";

const ProjectDocumentationPackageSection = lazy(() =>
  import("../sections/documentation-package/ProjectDocumentationPackageSection").then((m) => ({
    default: m.ProjectDocumentationPackageSection,
  }))
);
const ProjectDocumentsSection = lazy(() =>
  import("../sections/documents/ProjectDocumentsSection").then((m) => ({ default: m.ProjectDocumentsSection }))
);
const ProjectDrawingsSection = lazy(() =>
  import("../sections/drawings/ProjectDrawingsSection").then((m) => ({ default: m.ProjectDrawingsSection }))
);
const ProjectOverviewSection = lazy(() =>
  import("../sections/overview/ProjectOverviewSection").then((m) => ({ default: m.ProjectOverviewSection }))
);
const ProjectPressureTestSection = lazy(() =>
  import("../sections/pressure-test/ProjectPressureTestSection").then((m) => ({
    default: m.ProjectPressureTestSection,
  }))
);
const ProjectTraceabilitySection = lazy(() =>
  import("../sections/traceability/ProjectTraceabilitySection").then((m) => ({ default: m.ProjectTraceabilitySection }))
);
const ProjectWeldLogSection = lazy(() =>
  import("../sections/weld-log/ProjectWeldLogSection").then((m) => ({ default: m.ProjectWeldLogSection }))
);
const ProjectWorkOrderSection = lazy(() =>
  import("../sections/work-order/ProjectWorkOrderSection").then((m) => ({ default: m.ProjectWorkOrderSection }))
);

type ProjectDetailsSectionViewProps = {
  section: ProjectDetailsSectionKey;
  projectId: string;
  isAdmin: boolean;
  project: ProjectRow;
};

function SectionPendingFallback() {
  return <Text c="dimmed">Laster seksjon...</Text>;
}

export function ProjectDetailsSectionView({ section, projectId, isAdmin, project }: ProjectDetailsSectionViewProps) {
  return (
    <Suspense fallback={<SectionPendingFallback />}>
      {section === "oversikt" ? <ProjectOverviewSection projectId={projectId} /> : null}
      {section === "arbeidsordre" ? <ProjectWorkOrderSection projectId={projectId} isAdmin={isAdmin} /> : null}
      {section === "tegninger" ? <ProjectDrawingsSection projectId={projectId} isAdmin={isAdmin} /> : null}
      {section === "sporbarhet" ? (
        <ProjectTraceabilitySection projectId={projectId} isAdmin={isAdmin} project={project} />
      ) : null}
      {section === "sveiselogg" ? <ProjectWeldLogSection projectId={projectId} isAdmin={isAdmin} project={project} /> : null}
      {section === "dokumenter" ? <ProjectDocumentsSection /> : null}
      {section === "trykktest" ? <ProjectPressureTestSection /> : null}
      {section === "dokumentasjonspakke" ? (
        <ProjectDocumentationPackageSection projectId={projectId} isAdmin={isAdmin} project={project} />
      ) : null}
    </Suspense>
  );
}
