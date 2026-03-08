import { Paper, Tabs } from "@mantine/core";
import { useNavigate } from "react-router-dom";
import type { ProjectDetailsSection, ProjectDetailsSectionKey } from "../projectDetails.types";
import { routePath } from "@react/router/routes";
import {
  IconLayoutDashboard,
  IconClipboardList,
  IconFileTypePdf,
  IconBarcode,
  IconFlame,
  IconLink,
  IconGauge,
  IconPackageExport,
} from "@tabler/icons-react";

type ProjectDetailsMenuProps = {
  projectId: string;
  sections: ProjectDetailsSection[];
  activeSection: ProjectDetailsSectionKey;
};

const tabIconProps = { size: 16, stroke: 1.8 };

const iconByKey: Record<ProjectDetailsSectionKey, React.ReactNode> = {
  oversikt: <IconLayoutDashboard {...tabIconProps} />,
  arbeidsordre: <IconClipboardList {...tabIconProps} />,
  tegninger: <IconFileTypePdf {...tabIconProps} />,
  sporbarhet: <IconBarcode {...tabIconProps} />,
  sveiselogg: <IconFlame {...tabIconProps} />,
  dokumenter: <IconLink {...tabIconProps} />,
  trykktest: <IconGauge {...tabIconProps} />,
  dokumentasjonspakke: <IconPackageExport {...tabIconProps} />,
};

export function ProjectDetailsMenu({ projectId, sections, activeSection }: ProjectDetailsMenuProps) {
  const navigate = useNavigate();
  const value = activeSection || sections[0]?.key || null;

  return (
    <Paper withBorder radius="xl" shadow="md" p="sm">
      <Tabs
        value={value}
        onChange={(nextValue) => {
          if (!nextValue) return;
          navigate(routePath.projectDetailsSection(projectId, nextValue));
        }}
        variant="pills"
      >
        <Tabs.List justify="center">
          {sections.map((section) => (
            <Tabs.Tab key={section.key} value={section.key} leftSection={iconByKey[section.key] ?? null}>
              {section.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
    </Paper>
  );
}
