import { Alert, Text } from "@mantine/core";
import { useParams } from "react-router-dom";
import { useAuth } from "@react/auth/AuthProvider";
import { AppPageLayout } from "@react/layout/AppPageLayout";
import { AppLinkButton } from "@react/ui/AppLinkButton";
import { AppSectionHeader } from "@react/ui/AppSectionHeader";
import { ProjectDetailsMenu } from "./components/ProjectDetailsMenu";
import { ProjectDetailsSectionView } from "./components/ProjectDetailsSectionView";
import { useProjectDetailsData } from "./hooks/useProjectDetailsData";
import { normalizeProjectDetailsSection, PROJECT_DETAILS_SECTIONS } from "./lib/sections";
import { ROUTES } from "@react/router/routes";

export function ProjectDetailsPage() {
  const params = useParams<{ projectId: string; section?: string }>();
  const { access, session } = useAuth();

  const displayName = access?.displayName ?? "Bruker";
  const email = session?.user?.email ?? "";
  const isAdmin = access?.isAdmin ?? false;

  const projectId = params.projectId;
  const section = normalizeProjectDetailsSection(params.section);
  const { project, loading, error } = useProjectDetailsData(projectId);

  if (!projectId) {
    return (
      <AppPageLayout pageClassName="page-project-details" displayName={displayName} email={email}>
        <Alert color="red" variant="light">Mangler prosjekt-ID.</Alert>
      </AppPageLayout>
    );
  }

  if (loading) {
    return (
      <AppPageLayout pageClassName="page-project-details" displayName={displayName} email={email}>
        <Text c="dimmed">Laster prosjekt...</Text>
      </AppPageLayout>
    );
  }

  if (error) {
    return (
      <AppPageLayout pageClassName="page-project-details" displayName={displayName} email={email}>
        <Alert color="red" variant="light">{error}</Alert>
      </AppPageLayout>
    );
  }

  if (!project) {
    return (
      <AppPageLayout pageClassName="page-project-details" displayName={displayName} email={email}>
        <Alert color="red" variant="light">Fant ikke prosjekt.</Alert>
      </AppPageLayout>
    );
  }

  return (
    <AppPageLayout pageClassName="page-project-details" displayName={displayName} email={email}>
      <AppSectionHeader
        title={`${project.project_no} – ${project.name}`}
        subtitle={`${project.customer} · AO ${project.work_order}`}
        actions={
          <>
            <AppLinkButton to={ROUTES.projects} size="sm">
              Tilbake
            </AppLinkButton>
          </>
        }
      />

      <ProjectDetailsMenu
        projectId={project.id}
        sections={PROJECT_DETAILS_SECTIONS}
        activeSection={section}
      />

      <ProjectDetailsSectionView section={section} projectId={project.id} isAdmin={isAdmin} project={project} />
    </AppPageLayout>
  );
}
