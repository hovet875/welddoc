import { signIn } from "../app/auth";
import { wireInstallHomeScreenButton } from "../ui/installPrompt";

export function renderLogin(app: HTMLElement) {
  app.innerHTML = `
    <div class="shell page-login">
      <main class="main">
        <div class="loginwrap">
          <section class="logincard">
            <div class="loginbrand">
              <img class="loginlogo-main" src="/images/titech-logo-login.png" alt="WeldDoc" />
            </div>
            <div class="loginrow">
              <label>E-post</label>
              <input id="email" class="input" type="email" autocomplete="username" />
            </div>

            <div class="loginrow">
              <label>Passord</label>
              <input id="pass" class="input" type="password" autocomplete="current-password" />
            </div>

            <div class="loginrow remember">
              <label class="rememberlabel">
                <input id="remember" type="checkbox" checked />
                Husk meg
              </label>
            </div>

            <div class="loginactions">
              <button id="btnLogin" class="btn primary">Logg inn</button>
            </div>
            <div class="logininstall">
              <button id="install-home-screen" class="btn login-install-btn" type="button" hidden>
                <svg viewBox="0 0 24 24" class="svgicon login-install-icon" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 3l9 8h-2v9h-5v-6H10v6H5v-9H3l9-8z"
                  />
                </svg>
                <span data-install-label>Legg til på hjemskjerm</span>
              </button>
              <p id="install-home-screen-hint" class="login-install-hint" hidden></p>
            </div>

            <p id="err" class="loginerr"></p>
          </section>
        </div>
      </main>
    </div>
  `;

  const emailEl = app.querySelector<HTMLInputElement>("#email")!;
  const passEl = app.querySelector<HTMLInputElement>("#pass")!;
  const errEl = app.querySelector<HTMLParagraphElement>("#err")!;
  const btn = app.querySelector<HTMLButtonElement>("#btnLogin")!;
  const rememberEl = app.querySelector<HTMLInputElement>("#remember")!;

  const saved = localStorage.getItem("rememberMe");
  rememberEl.checked = saved === null ? true : saved === "true";

  const doLogin = async () => {
    errEl.textContent = "";
    localStorage.setItem("rememberMe", String(rememberEl.checked));

    try {
      await signIn(emailEl.value.trim(), passEl.value);
      location.reload();
    } catch (e: any) {
      console.error(e);
      errEl.textContent = e?.message ?? "Innlogging feilet.";
    }
  };

  btn.addEventListener("click", doLogin);
  passEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doLogin();
  });

  const cleanupInstall = wireInstallHomeScreenButton(app);
  return () => {
    cleanupInstall();
  };
}
