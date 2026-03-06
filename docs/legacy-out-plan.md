# Legacy-Out Plan (React/Mantine)

Mål: flytte WeldDoc helt over på React/Mantine uten brudd i produksjonsflyt, og uten destruktive endringer i `src/legacy`.

## 1) Routes
- [x] Samle legacy-redirects i ett sted i `AppRouter` (lav risiko, ingen funksjonell endring).
- [ ] Definere hvilke legacy-ruter som fortsatt må leve midlertidig, med eier per rute.
- [ ] Flytte placeholders til ferdige React-sider (`/prosjekter`, `/materialsertifikater`).
- [ ] Fjerne legacy redirect-ruter når erstattende React-sider er i drift.

## 2) CSS imports
- [x] Dokumentere og gruppere import-seksjoner i `src/styles/index.css` (lav risiko).
- [ ] Lage eksplisitt skille mellom:
- [ ] React-side CSS (aktiv)
- [ ] Legacy bridge CSS (midlertidig)
- [ ] Print-only CSS
- [ ] Kartlegge og merke imports som kun brukes av `src/legacy`.
- [ ] Fase ut legacy-only imports etter hvert som sider migreres.

## 3) UI helpers
- [ ] Definere "godkjente" React UI-wrappere (`AppButton`, `AppSelect`, osv.) som standard.
- [ ] Kartlegge gjenstående bruk av legacy helpers i React-sider.
- [ ] Erstatte legacy helpers med React/Mantine wrappers side for side.
- [ ] Stoppe ny bruk av legacy helpers i React-kode.

## 4) Auth/logout-mønstre
- [x] Bruke eksplisitt logout-handler i header menu (ingen global document-listener).
- [x] Ekstrahere delt `signOutSafely` helper for React auth-flyt (lav risiko).
- [ ] Rydde opp resterende logout-kall slik at all React-kode bruker samme helper.
- [ ] Verifisere redirect/feilmeldingsmønster ved utlogging i alle beskyttede ruter.

## Gjennomføringsrekkefølge (lav risiko først)
1. Samle konfigurasjon og mønstre uten funksjonell endring (ruter, auth-helper, CSS-gruppering).
2. Migrere enkeltstående sider/helpers med lav kobling.
3. Migrere tunge sider og fjerne legacy-avhengigheter gradvis.
4. Avslutte med opprydding av legacy imports/ruter når bruk er 0.
