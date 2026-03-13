import type { DocumentPackageMainPdfData } from "./documentPackageMainPdf.types";

type DocumentPackageCoverPageProps = {
  data: DocumentPackageMainPdfData;
};

type CoverFieldProps = {
  label: string;
  value: string;
  className?: string;
};

function CoverField({ label, value, className }: CoverFieldProps) {
  const classes = ["doc-package-cover-card", className].filter(Boolean).join(" ");

  return (
    <section className={classes}>
      <div className="doc-package-cover-card-label">{label}</div>
      <div className="doc-package-cover-card-value">{value || "-"}</div>
    </section>
  );
}

export function DocumentPackageCoverPage({ data }: DocumentPackageCoverPageProps) {
  return (
    <section className="doc-package-cover" aria-label="Forside dokumentasjonspakke">
      <div className="doc-package-cover-hero">
        <div className="doc-package-cover-logo-frame doc-package-cover-logo-frame-large">
          <img
            className="doc-package-cover-logo doc-package-cover-logo-large"
            src={`${import.meta.env.BASE_URL}images/titech-logo.png`}
            alt="Ti-Tech logo"
          />
        </div>

        <div className="doc-package-cover-kicker">Ti-Tech Sveis AS</div>
        <h1 className="doc-package-cover-title">Dokumentasjonspakke</h1>
      </div>

      <div className="doc-package-cover-panel">
        <div className="doc-package-cover-main-grid">
          <CoverField label="Kunde" value={data.customer} className="doc-package-cover-card" />
          <CoverField label="Arbeidsordre" value={data.workOrder} />
          <CoverField label="Prosjektnavn" value={data.projectName} className="doc-package-cover-card-wide" />
        </div>

        <div className="doc-package-cover-reference">
          <span className="doc-package-cover-reference-label">Internt prosjektnummer</span>
          <span className="doc-package-cover-reference-value">{data.projectLabel}</span>
        </div>
      </div>
    </section>
  );
}