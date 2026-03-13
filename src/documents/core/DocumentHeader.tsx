import type { CSSProperties, ReactNode } from "react";

const DEFAULT_DOCUMENT_KICKER = "Ti-Tech Sveis AS";

type DocumentHeaderProps = {
  kicker?: string | null;
  title: string;
  subtitle?: string;
  lead?: ReactNode;
  showLogo?: boolean;
  aside?: ReactNode;
  asideWidth?: string;
  className?: string;
};

export function DocumentHeader({
  kicker,
  title,
  subtitle,
  lead,
  showLogo = true,
  aside,
  asideWidth,
  className,
}: DocumentHeaderProps) {
  const classes = ["doc-header", className].filter(Boolean).join(" ");
  const asideStyle = asideWidth
    ? ({ "--doc-header-aside-width": asideWidth } as CSSProperties)
    : undefined;
  const resolvedKicker = kicker === undefined ? DEFAULT_DOCUMENT_KICKER : kicker;
  const resolvedLead =
    lead !== undefined
      ? lead
      : showLogo
        ? <img className="doc-header-logo-image" src={`${import.meta.env.BASE_URL}images/titech-logo.png`} alt="Ti-Tech logo" />
        : null;

  return (
    <header className={classes}>
      <div className="doc-header-main">
        {resolvedLead ? <div className="doc-header-lead">{resolvedLead}</div> : null}
        <div className="doc-header-copy">
          {resolvedKicker ? <div className="doc-kicker">{resolvedKicker}</div> : null}
          <h1 className="doc-title">{title}</h1>
          {subtitle ? <p className="doc-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {aside ? (
        <div className="doc-header-aside" style={asideStyle}>
          {aside}
        </div>
      ) : null}
    </header>
  );
}
