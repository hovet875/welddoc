import type { ReactNode } from "react";
import { Group, Progress, Stack, Text } from "@mantine/core";
import { AppStatusBadge, appStatusBadgeColor, type AppStatusTone } from "./AppStatusBadge";

export type AppJobProgressStatus = "queued" | "running" | "completed" | "failed";

type AppJobProgressProps = {
  title?: ReactNode;
  meta?: ReactNode;
  description?: ReactNode;
  status: AppJobProgressStatus;
  value?: number;
};

type AppJobProgressConfig = {
  label: string;
  tone: AppStatusTone;
  value: number;
};

const JOB_PROGRESS_CONFIG: Record<AppJobProgressStatus, AppJobProgressConfig> = {
  queued: {
    label: "I kø",
    tone: "info",
    value: 0,
  },
  running: {
    label: "Kjører",
    tone: "warning",
    value: 64,
  },
  completed: {
    label: "Ferdig",
    tone: "success",
    value: 100,
  },
  failed: {
    label: "Feilet",
    tone: "danger",
    value: 100,
  },
};

export function getAppJobProgressLabel(status: AppJobProgressStatus) {
  return JOB_PROGRESS_CONFIG[status].label;
}

export function getAppJobProgressTone(status: AppJobProgressStatus) {
  return JOB_PROGRESS_CONFIG[status].tone;
}

export function getAppJobProgressValue(status: AppJobProgressStatus) {
  return JOB_PROGRESS_CONFIG[status].value;
}

export function AppJobProgress({ title, meta, description, status, value }: AppJobProgressProps) {
  const config = JOB_PROGRESS_CONFIG[status];
  const progressValue = Math.max(0, Math.min(100, Math.round(value ?? config.value)));

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-start" gap="sm">
        <Stack gap={2}>
          {title ? <Text fw={700}>{title}</Text> : null}
          {meta ? (
            <Text size="sm" c="dimmed">
              {meta}
            </Text>
          ) : null}
        </Stack>
        <Group gap="xs" align="center">
          <Text size="sm" fw={700}>
            {progressValue}%
          </Text>
          <AppStatusBadge tone={config.tone}>{config.label}</AppStatusBadge>
        </Group>
      </Group>

      <Progress value={progressValue} color={appStatusBadgeColor(config.tone)} radius="xl" size="lg" />

      {description ? (
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      ) : null}
    </Stack>
  );
}