import { type MouseEventHandler, type ReactNode } from "react";
import { Button } from "@mantine/core";

export type AppButtonTone = "neutral" | "primary" | "danger";

type AppButtonProps = {
  tone?: AppButtonTone;
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  loading?: boolean;
  size?: "xs" | "sm" | "md";
  id?: string;
  className?: string;
  title?: string;
  ariaLabel?: string;
  leftSection?: ReactNode;
};

const BUTTON_TONE_CONFIG: Record<
  AppButtonTone,
  { variant: "filled" | "light"; color?: string }
> = {
  neutral: { variant: "light", color: "gray" },
  primary: { variant: "filled", color: "brand" },
  danger: { variant: "filled", color: "red" },
};

export function AppButton({
  tone = "neutral",
  children,
  onClick,
  type = "button",
  disabled,
  loading,
  size = "xs",
  id,
  className,
  title,
  ariaLabel,
  leftSection,
}: AppButtonProps) {
  const toneConfig = BUTTON_TONE_CONFIG[tone];
  return (
    <Button
      id={id}
      className={className}
      title={title}
      aria-label={ariaLabel}
      leftSection={leftSection}
      size={size}
      {...toneConfig}
      type={type}
      onClick={onClick}
      disabled={disabled}
      loading={loading}
    >
      {children}
    </Button>
  );
}
