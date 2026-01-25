import { signOut } from "../app/auth";

export function renderHeader() {
  return /*html*/`
    <header class="topbar">
      <div class="brand">
        <img class="logo" src="/images/titech-hvit.jpg" alt="Ti-Tech" />
        <div class="brandtext">
          <div class="title">Ti-Tech Sveis AS - Prosjektstyring</div>
          <div class="subtitle">Sporbarhet • Sveis • Kontroll</div>
        </div>
      </div>

      <nav class="nav">
        <a class="navlink" href="#/prosjekter">Prosjekter</a>
        <a class="navlink" href="#/wps">Sveiseprosedyrer</a>
        <a class="navlink" href="#/certs">Sveisesertifikater</a>
        <a class="navlink" href="#/trykktest">Trykktest</a>
        <button id="logout" class="naviconlogout" title="Logg ut" aria-label="Logg ut">
  <svg viewBox="0 0 24 24" class="logouticon" aria-hidden="true">
    <path d="M10 17l1.41-1.41L8.83 13H20v-2H8.83l2.58-2.59L10 7l-5 5 5 5z"/>
    <path d="M4 4h8v2H4v12h8v2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
  </svg>
</button>

      </nav>
    </header>
  `;
}

export function wireHeader(app: HTMLElement) {
  app.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", async () => {
    await signOut();
    location.reload();
  });
}
