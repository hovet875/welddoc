import { Link } from "react-router-dom";

export function HomeHero() {
  return (
    <div className="herotext">
      <h1>Dokumentasjon som faktisk funker i verkstedet.</h1>
      <p>
        Ett system for prosjekter, tegninger, sveiselogger, materialsertifikater og kontrollrapporter.
        Bygd for rask registrering og enkel eksport.
      </p>

      <div className="cta">
        <Link className="btn primary" to="/prosjekter">
          Åpne prosjekter
        </Link>
        <Link className="btn" to="/prosjekter">
          Ny sveiselog
        </Link>
      </div>

      <div className="quick">
        <div className="pill">Prosjektstyrt struktur</div>
        <div className="pill">Klar for QR / sporbarhet</div>
        <div className="pill">Klar for PDF-export</div>
      </div>
    </div>
  );
}
