import { signOut } from "../app/auth";
import { renderHeader, wireHeader } from "../components/header";
import { Footer } from "../components/footer";

export function renderHome(app: HTMLElement) {
  app.innerHTML = `
    <div class="shell page-home">
      ${renderHeader()}
      <main class="main">
        <section class="hero">
          <div class="herotext">
            <h1>Dokumentasjon som faktisk funker i verkstedet.</h1>
            <p>
              Ett system for prosjekter, tegninger, sveiselogger, materialsertifikater og kontrollrapporter.
              Bygd for rask registrering og enkel eksport.
            </p>

            <div class="cta">
              <a class="btn primary" href="#/prosjekter">Åpne prosjekter</a>
              <a class="btn" href="#/sveiselogg">Ny sveiselog</a>
            </div>

            <div class="quick">
              <div class="pill">✅ Prosjektstyrt struktur</div>
              <div class="pill">✅ Klar for QR / sporbarhet</div>
              <div class="pill">✅ Klar for PDF-export</div>
            </div>
          </div>

          <div class="herocard">
            <div class="cardtitle">Hurtigstart</div>
            <div class="cardgrid">
              <a class="card" href="#/prosjekter">
                <div class="cardh">Prosjekter</div>
                <div class="cardp">Opprett prosjekt → legg til tegninger → logg.</div>
              </a>
              <a class="card" href="#/wps">
                <div class="cardh">WPS</div>
                <div class="cardp">Hold WPS-oversikt og koble mot sveis.</div>
              </a>
              <a class="card" href="#/sveiselogg">
                <div class="cardh">Sveiselogg</div>
                <div class="cardp">Excel-følelse i nettleser, med kontrollfelt.</div>
              </a>
              <a class="card" href="#/trykktest">
                <div class="cardh">Trykktest</div>
                <div class="cardp">Registrer testdata og generer rapport.</div>
              </a>
            </div>
          </div>
        </section>

        <section class="section">
          <div class="sectionhead">
            <h2>Oversikt</h2>
            <p>Byggesteinene vi fyller med funksjon etter hvert.</p>
          </div>

          <div class="tiles">
            <div class="tile">
              <div class="tileh">Prosjekt</div>
              <div class="tilep">Master for alt: tegninger, sveiser, materialer, dokumenter.</div>
            </div>
            <div class="tile">
              <div class="tileh">Sporbarhet</div>
              <div class="tilep">Heat → kode (P1/P2…) → knyttes til prosjekt og linjer.</div>
            </div>
            <div class="tile">
              <div class="tileh">Dokumenter</div>
              <div class="tilep">PDF-tegninger, MTC, NDT-rapporter og vedlegg.</div>
            </div>
          </div>
        </section>
      </main>
      ${Footer()}
    </div>
  `;
  wireHeader(app);
  app.querySelector<HTMLButtonElement>("#logout")?.addEventListener("click", async () => {
    await signOut();
    location.reload();
  });
}
