import type { LegacyRender } from "./LegacyPage";

function asCleanup(value: unknown): void | (() => void) {
  return typeof value === "function" ? (value as () => void) : undefined;
}

export const renderLegacyProjects: LegacyRender = async (host) => {
  const { renderProjectsPage } = await import("@legacy/pages/projects");
  return asCleanup(await renderProjectsPage(host));
};

export const renderLegacyWps: LegacyRender = async (host) => {
  const { renderWpsPage } = await import("@legacy/pages/wps");
  return asCleanup(await renderWpsPage(host));
};

export const renderLegacyCerts: LegacyRender = async (host) => {
  const { renderCertsPage } = await import("@legacy/pages/certs");
  return asCleanup(await renderCertsPage(host));
};

export const renderLegacyNdt: LegacyRender = async (host) => {
  const { renderNdtPage } = await import("@legacy/pages/ndt");
  return asCleanup(await renderNdtPage(host));
};

export const renderLegacyMaterialCerts: LegacyRender = async (host) => {
  const { renderMaterialCertsPage } = await import("@legacy/pages/material-certs");
  return asCleanup(await renderMaterialCertsPage(host));
};

export const renderLegacyCompanySettingsWelding: LegacyRender = async (host) => {
  const { renderCompanySettingsWelding } = await import("@legacy/pages/company-settings/welding");
  return asCleanup(await renderCompanySettingsWelding(host));
};

export function renderLegacyProjectDetail(projectId: string, section: string | null): LegacyRender {
  return async (host) => {
    const { renderProjectDetail } = await import("@legacy/pages/projects/detail");
    return asCleanup(await renderProjectDetail(host, projectId, section));
  };
}
