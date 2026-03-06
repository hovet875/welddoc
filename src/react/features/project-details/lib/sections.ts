import type {
  ProjectDetailsAliasSection,
  ProjectDetailsSection,
  ProjectDetailsSectionKey,
} from "../projectDetails.types";

export const PROJECT_DETAILS_SECTIONS: ProjectDetailsSection[] = [
  { key: "oversikt", label: "Prosjektoversikt" },
  { key: "arbeidsordre", label: "Arbeidsordre" },
  { key: "tegninger", label: "Tegninger" },
  { key: "sporbarhet", label: "Materialsporbarhet" },
  { key: "sveiselogg", label: "Sveiselogg" },
  { key: "dokumenter", label: "Koblede dokumenter" },
  { key: "trykktest", label: "Trykktest" },
  { key: "dokumentasjonspakke", label: "Generer dokumentasjonspakke" },
];

const SECTION_KEYS = new Set<ProjectDetailsSectionKey>(PROJECT_DETAILS_SECTIONS.map((section) => section.key));

const ALIAS_MAP: Record<ProjectDetailsAliasSection, ProjectDetailsSectionKey> = {
  wps: "dokumenter",
  sveisesertifikat: "dokumenter",
  ndt: "dokumenter",
};

export function normalizeProjectDetailsSection(rawSection: string | undefined): ProjectDetailsSectionKey {
  const value = String(rawSection ?? "").trim();
  if (!value) return "oversikt";

  if (value in ALIAS_MAP) {
    return ALIAS_MAP[value as ProjectDetailsAliasSection];
  }

  if (SECTION_KEYS.has(value as ProjectDetailsSectionKey)) {
    return value as ProjectDetailsSectionKey;
  }

  return "oversikt";
}

export function sectionLabel(section: ProjectDetailsSectionKey) {
  return PROJECT_DETAILS_SECTIONS.find((item) => item.key === section)?.label ?? "";
}

export function hasSectionKey(value: string): value is ProjectDetailsSectionKey {
  return SECTION_KEYS.has(value as ProjectDetailsSectionKey);
}
