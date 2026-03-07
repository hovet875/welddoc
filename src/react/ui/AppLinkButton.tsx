import type { ReactNode } from "react";
import { Button } from "@mantine/core";
import { Link } from "react-router-dom";
import { preloadRouteForPath } from "@react/router/routePreload";

type AppLinkButtonTone = "neutral" | "primary" | "danger";

type AppLinkButtonProps = {
  to: string;
  children: ReactNode;
  tone?: AppLinkButtonTone;
  size?: "xs" | "sm" | "md";
  fullWidth?: boolean;
};

const LINK_BUTTON_TONE_CONFIG: Record<
  AppLinkButtonTone,
  { variant: "filled" | "light"; color?: string }
> = {
  neutral: { variant: "light", color: "gray" },
  primary: { variant: "filled", color: "brand" },
  danger: { variant: "filled", color: "red" },
};

export function AppLinkButton({ to, children, tone = "neutral", size = "xs", fullWidth = false }: AppLinkButtonProps) {
  const toneConfig = LINK_BUTTON_TONE_CONFIG[tone];
  return (
    <Button
      component={Link}
      to={to}
      size={size}
      fullWidth={fullWidth}
      onMouseEnter={() => void preloadRouteForPath(to)}
      onFocus={() => void preloadRouteForPath(to)}
      onTouchStart={() => void preloadRouteForPath(to)}
      {...toneConfig}
    >
      {children}
    </Button>
  );
}
