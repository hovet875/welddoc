import { useEffect, useMemo } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { signOut } from "@app/auth";
import { LoginPage } from "@react/features/auth/LoginPage";
import { HomePage } from "@react/features/home/HomePage";
import { SettingsPage } from "@react/features/settings/SettingsPage";
import { CompanySettingsPage } from "@react/features/settings/company/CompanySettingsPage";
import { CompanySettingsOrganizationPage } from "@react/features/settings/company/organization/CompanySettingsOrganizationPage";
import { CompanySettingsSystemPage } from "@react/features/settings/company/CompanySettingsSystemPage";
import { CompanySettingsWeldingPage } from "@react/features/settings/company/welding/CompanySettingsWeldingPage";
import { UsersPage } from "@react/features/settings/users/UsersPage";
import { LegacyPage } from "@react/legacy/LegacyPage";
import {
  renderLegacyCerts,
  renderLegacyCompanySettingsWelding,
  renderLegacyMaterialCerts,
  renderLegacyNdt,
  renderLegacyProjectDetail,
  renderLegacyProjects,
  renderLegacyWps,
} from "@react/legacy/renderers";
import { PublicOnlyRoute, RequireAuthRoute } from "@react/router/RouteGuards";

function GlobalLogoutListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const onDocumentClick = async (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.id !== "logout" && !target.closest("#logout")) return;
      event.preventDefault();

      try {
        await signOut();
      } catch (err) {
        console.warn("Utlogging feilet", err);
      } finally {
        navigate("/login", { replace: true });
      }
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [navigate]);

  return null;
}

function LegacyProjectDetailRoute() {
  const { projectId, section } = useParams();

  if (!projectId) {
    return <Navigate to="/prosjekter" replace />;
  }

  const render = useMemo(() => renderLegacyProjectDetail(projectId, section ?? null), [projectId, section]);
  return <LegacyPage render={render} />;
}

export function AppRouter() {
  return (
    <>
      <GlobalLogoutListener />
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/react-login" element={<Navigate to="/login" replace />} />
        </Route>

        <Route element={<RequireAuthRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/prosjekter" element={<LegacyPage render={renderLegacyProjects} />} />
          <Route path="/prosjekter/:projectId" element={<LegacyProjectDetailRoute />} />
          <Route path="/prosjekter/:projectId/:section" element={<LegacyProjectDetailRoute />} />
          <Route path="/wps" element={<LegacyPage render={renderLegacyWps} />} />
          <Route path="/certs" element={<LegacyPage render={renderLegacyCerts} />} />
          <Route path="/ndt" element={<LegacyPage render={renderLegacyNdt} />} />
          <Route path="/materialsertifikater" element={<LegacyPage render={renderLegacyMaterialCerts} />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/users" element={<UsersPage />} />
          <Route path="/settings/company" element={<CompanySettingsPage />} />
          <Route path="/settings/company/system" element={<CompanySettingsSystemPage />} />
          <Route path="/settings/company/organization" element={<CompanySettingsOrganizationPage />} />
          <Route path="/settings/company/welding" element={<CompanySettingsWeldingPage />} />
          <Route path="/legacy/company-settings/welding" element={<LegacyPage render={renderLegacyCompanySettingsWelding} />} />

          <Route path="/users" element={<Navigate to="/settings/users" replace />} />
          <Route path="/company-settings" element={<Navigate to="/settings/company" replace />} />
          <Route
            path="/company-settings/organization"
            element={<Navigate to="/settings/company/organization" replace />}
          />
          <Route path="/company-settings/welding" element={<Navigate to="/settings/company/welding" replace />} />
          <Route path="/company-settings/system" element={<Navigate to="/settings/company/system" replace />} />

          <Route path="/react" element={<Navigate to="/" replace />} />
          <Route path="/react/home" element={<Navigate to="/" replace />} />
          <Route path="/react/prosjekter" element={<Navigate to="/prosjekter" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
