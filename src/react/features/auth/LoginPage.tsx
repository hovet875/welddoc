import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { signIn } from "../../../app/auth";
import { useAuth } from "../../auth/AuthProvider";

function readRememberMe() {
  try {
    const saved = localStorage.getItem("rememberMe");
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

function formatLoginError(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  return "Innlogging feilet.";
}

export function LoginPage() {
  const navigate = useNavigate();
  const { message, clearMessage, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(readRememberMe);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!message) return;
    setError(message);
  }, [message]);

  const resetErrors = () => {
    if (error) setError("");
    if (message) clearMessage();
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    resetErrors();
    setIsSubmitting(true);
    try {
      localStorage.setItem("rememberMe", String(remember));
      await signIn(email.trim(), password);
      await refresh();
      clearMessage();
      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setError(formatLoginError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="shell page-login">
      <main className="main">
        <div className="loginwrap">
          <section className="logincard">
            <div className="loginbrand">
              <img className="loginlogo-main" src="/images/titech-logo-login.png" alt="WeldDoc" />
            </div>

            <form onSubmit={onSubmit}>
              <div className="loginrow">
                <label htmlFor="react-email">E-post</label>
                <input
                  id="react-email"
                  className="input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => {
                    resetErrors();
                    setEmail(event.target.value);
                  }}
                  disabled={isSubmitting}
                />
              </div>

              <div className="loginrow">
                <label htmlFor="react-pass">Passord</label>
                <input
                  id="react-pass"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    resetErrors();
                    setPassword(event.target.value);
                  }}
                  disabled={isSubmitting}
                />
              </div>

              <div className="loginrow remember">
                <label className="rememberlabel">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    disabled={isSubmitting}
                  />
                  Husk meg
                </label>
              </div>

              <div className="loginactions">
                <button className="btn primary" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Logger inn..." : "Logg inn"}
                </button>
              </div>
            </form>

            <p className="loginerr">{error}</p>
          </section>
        </div>
      </main>
    </div>
  );
}
