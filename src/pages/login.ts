import { signIn } from "../app/auth";

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
}
