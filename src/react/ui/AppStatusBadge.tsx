import type { ReactNode } from "react";
import { Badge } from "@mantine/core";

export type AppStatusTone = "success" | "warning" | "danger" | "neutral" | "info";

type AppStatusBadgeProps = {
  tone?: AppStatusTone;
  children: ReactNode;
};

const STATUS_COLOR_MAP: Record<AppStatusTone, string> = {
  success: "green",
  warning: "yellow",
  danger: "red",
  neutral: "gray",
  info: "blue",
};

export function AppStatusBadge({ tone = "neutral", children }: AppStatusBadgeProps) {
  return (
    <Badge variant="light" color={STATUS_COLOR_MAP[tone]} radius="xl">
      {children}
    </Badge>
  );
}

export function appStatusBadgeColor(tone: AppStatusTone) {
  return STATUS_COLOR_MAP[tone];
}
