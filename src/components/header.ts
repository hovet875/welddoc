function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderHeader(displayName = "Bruker", email = "") {
  const safeDisplayName = escapeHtml(displayName);
  const safeEmail = escapeHtml(email);

  return /*html*/`
    <header class="topbar">
      <div class="brand">
        <img class="logo" src="/welddoc-logo.png" alt="WeldDoc" />
      </div>

      <nav class="nav">
        <a class="navlink" href="#/">Hjem</a>
        <a class="navlink" href="#/prosjekter">Prosjekter</a>
        <a class="navlink" href="#/materialsertifikater">Materialsertifikater</a>
        <a class="navlink" href="#/wps">Sveiseprosedyrer</a>
        <a class="navlink" href="#/certs">Sveisesertifikater</a>
        <a class="navlink" href="#/ndt">NDT</a>
      </nav>

      <div class="user-section" data-user-menu>
        <button class="user-avatar" id="user-avatar" aria-label="Brukerprofil" aria-expanded="false" aria-haspopup="menu">
          <div class="avatar-circle">
            <svg viewBox="0 0 24 24" class="avatar-icon" aria-hidden="true">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <div class="user-name">${safeDisplayName}</div>
        </button>
        <div class="user-menu" role="menu" aria-label="Brukermeny">
          ${safeEmail ? `
            <div class="user-menu__email">
              <svg viewBox="0 0 24 24" class="user-menu__email-icon" aria-hidden="true">
                <path fill="currentColor" d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              <span>${safeEmail}</span>
            </div>
          ` : ""}
          <a class="user-menu__item" role="menuitem" href="#/settings">Innstillinger</a>
          <button class="user-menu__item" role="menuitem" id="logout" type="button">Logg ut</button>
        </div>
      </div>
    </header>
  `;
}

export function wireHeader(app: HTMLElement) {
  const menuRoot = app.querySelector<HTMLElement>("[data-user-menu]");
  const avatarBtn = app.querySelector<HTMLButtonElement>("#user-avatar");

  if (!menuRoot || !avatarBtn) return;

  const closeMenu = () => {
    menuRoot.classList.remove("is-open");
    avatarBtn.setAttribute("aria-expanded", "false");
  };

  const toggleMenu = () => {
    const isOpen = menuRoot.classList.toggle("is-open");
    avatarBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  };

  avatarBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });

  app.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (menuRoot.contains(target)) return;
    closeMenu();
  });

  // Bound to app root, so listener is naturally removed when route root is replaced.
  app.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}
