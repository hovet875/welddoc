import type { JobTitleRow } from "../../../../repo/jobTitleRepo";
import type { SettingsFormState } from "../settings.types";

type SettingsProfileFormProps = {
  isAdmin: boolean;
  email: string;
  loading: boolean;
  saving: boolean;
  resettingPassword: boolean;
  jobTitles: JobTitleRow[];
  form: SettingsFormState;
  onDisplayNameChange: (value: string) => void;
  onJobTitleChange: (value: string) => void;
  onWelderNoChange: (value: string) => void;
  onSave: () => void;
  onResetPassword: () => void;
};

export function SettingsProfileForm({
  isAdmin,
  email,
  loading,
  saving,
  resettingPassword,
  jobTitles,
  form,
  onDisplayNameChange,
  onJobTitleChange,
  onWelderNoChange,
  onSave,
  onResetPassword,
}: SettingsProfileFormProps) {
  return (
    <section className="section-grid">
      <div className="panel">
        <div className="panel-head">
          <div className="panel-title">Brukerinfo</div>
          <div className="panel-meta">{isAdmin ? "Admin" : "Les"}</div>
        </div>

        <div className="panel-body">
          <div className="settings-form">
            <div className="settings-row">
              <label>Visningsnavn</label>
              <input
                className="input"
                type="text"
                value={form.displayName}
                disabled={!isAdmin || loading || saving}
                onChange={(event) => onDisplayNameChange(event.target.value)}
              />
            </div>

            <div className="settings-row">
              <label>E-post</label>
              <input className="input" type="email" value={email} disabled />
            </div>

            <div className="settings-row">
              <label>Stilling</label>
              <select
                className="select"
                value={form.jobTitle}
                disabled={!isAdmin || loading || saving}
                onChange={(event) => onJobTitleChange(event.target.value)}
              >
                <option value="">Velg stilling...</option>
                {jobTitles.map((jobTitle) => (
                  <option key={jobTitle.id} value={jobTitle.title} disabled={!jobTitle.is_active}>
                    {jobTitle.is_active ? jobTitle.title : `${jobTitle.title} (inaktiv)`}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-row">
              <label>Sveiser ID</label>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                value={form.welderNo}
                disabled={!isAdmin || loading || saving}
                onChange={(event) => onWelderNoChange(event.target.value)}
              />
            </div>

            <div className="settings-actions">
              <button className="btn" type="button" disabled={resettingPassword} onClick={onResetPassword}>
                {resettingPassword ? "Sender..." : "Bytt passord"}
              </button>
              {isAdmin ? (
                <button className="btn primary" type="button" disabled={loading || saving} onClick={onSave}>
                  {saving ? "Lagrer..." : "Lagre"}
                </button>
              ) : null}
            </div>
          </div>

          {!isAdmin ? <div className="muted" style={{ marginTop: 10 }}>Kun admin kan endre.</div> : null}
        </div>
      </div>
    </section>
  );
}
