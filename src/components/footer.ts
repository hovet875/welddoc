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
          <!-- Knapper/lenker kan komme senere -->
          <!-- <a class="app-footer__link" href="/personvern">Personvern</a> -->
          <!-- <button class="app-footer__btn">Kontakt</button> -->
        </div>
      </div>
    </footer>
  `;
}
