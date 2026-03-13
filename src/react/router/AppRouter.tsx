import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PublicOnlyRoute, RequireAuthRoute, RouteLoadingScreen } from "@react/router/RouteGuards";
import { ROUTE_PATTERNS, ROUTES } from "@react/router/routes";
import { WorkerDocumentPackageRenderPage } from "@/react/features/worker/WorkerDocumentPackageRenderPage";
import {
  loadCertsPage,
  loadCompanySettingsOrganizationPage,
  loadCompanySettingsPage,
  loadCompanySettingsSystemPage,
  loadCompanySettingsWeldingPage,
  loadHomePage,
  loadLoginPage,
  loadMaterialCertsPage,
  loadMigrationPlaceholderPage,
  loadNdtPage,
  loadProjectDetailsPage,
  loadProjectsPage,
  loadSettingsPage,
  loadUsersPage,
  loadWpsPage,
  preloadRouteForPath,
} from "@react/router/routePreload";

const MIGRATION_PLACEHOLDERS: Array<{ path: string; title: string; subtitle: string }> = [];

const LoginPage = lazy(() => loadLoginPage().then((m) => ({ default: m.LoginPage })));
const CertsPage = lazy(() => loadCertsPage().then((m) => ({ default: m.CertsPage })));
const HomePage = lazy(() => loadHomePage().then((m) => ({ default: m.HomePage })));
const MaterialCertsPage = lazy(() => loadMaterialCertsPage().then((m) => ({ default: m.MaterialCertsPage })));
const MigrationPlaceholderPage = lazy(() =>
  loadMigrationPlaceholderPage().then((m) => ({ default: m.MigrationPlaceholderPage }))
);
const NdtPage = lazy(() => loadNdtPage().then((m) => ({ default: m.NdtPage })));
const ProjectDetailsPage = lazy(() =>
  loadProjectDetailsPage().then((m) => ({ default: m.ProjectDetailsPage }))
);
const ProjectsPage = lazy(() => loadProjectsPage().then((m) => ({ default: m.ProjectsPage })));
const SettingsPage = lazy(() => loadSettingsPage().then((m) => ({ default: m.SettingsPage })));
const CompanySettingsPage = lazy(() =>
  loadCompanySettingsPage().then((m) => ({ default: m.CompanySettingsPage }))
);
const CompanySettingsOrganizationPage = lazy(() =>
  loadCompanySettingsOrganizationPage().then((m) => ({
    default: m.CompanySettingsOrganizationPage,
  }))
);
const CompanySettingsSystemPage = lazy(() =>
  loadCompanySettingsSystemPage().then((m) => ({
    default: m.CompanySettingsSystemPage,
  }))
);
const CompanySettingsWeldingPage = lazy(() =>
  loadCompanySettingsWeldingPage().then((m) => ({
    default: m.CompanySettingsWeldingPage,
  }))
);
const UsersPage = lazy(() => loadUsersPage().then((m) => ({ default: m.UsersPage })));
const WpsPage = lazy(() => loadWpsPage().then((m) => ({ default: m.WpsPage })));

export function AppRouter() {
  const location = useLocation();
  const suspenseFallback = <RouteLoadingScreen />;

  useEffect(() => {
    void preloadRouteForPath(location.pathname);
  }, [location.pathname]);

  return (
    <Suspense fallback={suspenseFallback}>
      <Routes>
        <Route path={ROUTES.workerDocumentPackageRender} element={<WorkerDocumentPackageRenderPage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path={ROUTES.login} element={<LoginPage />} />
        </Route>

        <Route element={<RequireAuthRoute />}>
          <Route path={ROUTES.home} element={<HomePage />} />
          <Route path={ROUTES.projects} element={<ProjectsPage />} />
          <Route path={ROUTE_PATTERNS.projectDetails} element={<ProjectDetailsPage />} />
          <Route path={ROUTE_PATTERNS.projectDetailsSection} element={<ProjectDetailsPage />} />
          <Route path={ROUTES.materialCerts} element={<MaterialCertsPage />} />
          {MIGRATION_PLACEHOLDERS.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<MigrationPlaceholderPage title={route.title} subtitle={route.subtitle} />}
            />
          ))}
          <Route path={ROUTES.wps} element={<WpsPage />} />
          <Route path={ROUTES.certs} element={<CertsPage />} />
          <Route path={ROUTES.ndt} element={<NdtPage />} />
          <Route path={ROUTES.settings} element={<SettingsPage />} />
          <Route path={ROUTES.settingsUsers} element={<UsersPage />} />
          <Route path={ROUTES.settingsCompany} element={<CompanySettingsPage />} />
          <Route path={ROUTES.settingsCompanySystem} element={<CompanySettingsSystemPage />} />
          <Route path={ROUTES.settingsCompanyOrganization} element={<CompanySettingsOrganizationPage />} />
          <Route path={ROUTES.settingsCompanyWelding} element={<CompanySettingsWeldingPage />} />
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
      </Routes>
    </Suspense>
  );
}
