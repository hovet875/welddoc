// src/components/footer.ts
export function Footer() {
  const year = new Date().getFullYear();

  return `
    <footer class="app-footer" role="contentinfo">
      <div class="app-footer__inner">
        <div class="app-footer__left">
          Ti-Tech Sveis AS – ${year}
        </div>

        <div class="app-footer__right">
          <button id="logout" class="iconbtn danger app-footer__logout" title="Logg ut" aria-label="Logg ut">
            <svg viewBox="0 0 24 24" class="logouticon" aria-hidden="true">
              <path d="M10 17l1.41-1.41L8.83 13H20v-2H8.83l2.58-2.59L10 7l-5 5 5 5z"/>
              <path d="M4 4h8v2H4v12h8v2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            </svg>
            <span>Logg ut</span>
          </button>
        </div>
      </div>
    </footer>
  `;
}
