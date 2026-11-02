# 📸 FOTOJACHT — Scouting Photo Challenge

Een Nederlandse, mobiele fotochallenge zonder account of backend. Kies een bekende scène, maak de pose na en geef elkaar punten. **145 opdrachten**, inclusief alle **125 oorspronkelijke opdrachten**, en **11 lokale referenties**. Andere opdrachten hebben een gerichte externe afbeeldingenzoeker voor de precieze scène; er worden geen willekeurige filmposters als scène getoond.

## Spelen

1. Zoek op titel, kies een categorie of niveau, of laat je verrassen. Je kunt altijd vrij rondkijken.
2. Open de opdracht. Een lokale foto staat direct in beeld. Bij een externe zoekreferentie opent **Zoek origineel** Google Afbeeldingen. Kies daar het exacte beeld; een toegestaan eigen voorbeeld kun je op je apparaat bewaren.
3. Stel onderaan 3, 5, 10 of 15 minuten in en kies **Start ronde**. Pauzeer of reset via de vaste timer. De resterende tijd wordt berekend met een eindtijd, ook na schermvergrendeling. Safari kan op de achtergrond geen melding garanderen: de verstreken tijd wordt bij terugkomst bijgewerkt.
4. Kies **Maak of kies een foto**. Op een telefoon kun je via de systeembestandskiezer de camera of fotobibliotheek gebruiken. Je foto staat naast het voorbeeld. Met **Vergroot** bekijk je het origineel beeldvullend.
5. Selecteer één van de twee teams en ken 0–10 punten toe. Een opdracht kan eenmaal punten krijgen; het scorebord biedt handmatige correcties. Scores resetten maakt de puntentoekenningen opnieuw vrij.
6. Kies **Volgende**, **Vorige**, willekeurig of **Sla over**. Willekeurig geeft waar mogelijk voorrang aan niet-afgeronde, niet-overgeslagen opdrachten. Overgeslagen opdrachten blijven vrij te bekijken.

Favorieten, filters, teamnamen, scores, puntentoekenningen, voortgang, timerduur en een lopende eindtijd blijven in localStorage. Eigen referenties en recreaties staan in IndexedDB, apart per opdracht. Foto's verlaten de browser niet. Er is geen synchronisatie tussen telefoons. Browsergegevens wissen verwijdert de lokale spelgegevens. Privémodus of opslaglimieten kunnen opslag verhinderen; kies dan een kleinere JPEG. Afbeeldingen van maximaal 12 MB worden geaccepteerd als de browser ze kan openen.

## Bronnen en rechten

- **Lokale referentie:** de bron en auteur staan onder de foto. Het register [assets/references/sources.json](assets/references/sources.json) noemt de bronpagina, maker, rechtenstatus en bewerkingen. Het gaat om publiekdomeinwerken en een NASA-foto; de Commons-bronpagina's bevatten de onderbouwing. De afbeeldingen zijn verkleind en omgezet naar WebP. Geen AI-vervangingen.
- **Externe zoekreferentie:** auteursrechtelijk beschermde scènes en memes worden niet meegeleverd of gehotlinkt. Elke opdracht heeft een specifieke zoekterm. Zoekresultaten kunnen wijzigen; kies het beeld dat bij de pose-instructie hoort. Er wordt geen beschikbaarheid of licentie van externe resultaten beloofd.
- **Eigen voorbeeld / jullie versie:** alleen op dit apparaat opgeslagen. Gebruik beelden die je mag gebruiken en vraag deelnemers voordat je hun foto's deelt.

De bestaande brede opdrachten zijn behouden; de nieuwe opdrachten hebben eigen scènes en unieke titels. De Nederlandse kunstwerken Het melkmeisje en De Nachtwacht zijn toegevoegd als lokaal beschikbare groeps- en soloreferenties.

## Lokaal starten en controleren

Geen dependencies of buildstap nodig. Gebruik een lokale server (niet file://):

```sh
python3 -m http.server 8000 --bind 127.0.0.1
# open http://127.0.0.1:8000
node scripts/verify.mjs
```

`index.html`, `styles.css`, `app.js` en `challenges.js` vormen de app. Alle site-assets gebruiken relatieve paden en werken onder `/scouting-fotojacht/`. Het service worker bewaart de app-shell en bezochte lokale beelden; externe zoekresultaten vereisen internet. Niet-bezochte beelden kunnen offline ontbreken en tonen dan de zoekfallback. Een ontbrekende asset krijgt geen HTML-document als afbeelding terug.

Het optionele onderhoudsscript `scripts/fetch-references.py` vereist Python en Pillow plus curl. Het haalt uitsluitend de vastgelegde publiekdomeinwerken op. Controleer bij wijzigingen eerst de bronpagina en rechten; pas ook het register en de velden in `challenges.js` aan.

## GitHub Pages

De workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) valideert de bibliotheek en publiceert alleen de statische website bij een push naar `main`.

1. Open de repository **Settings → Pages**.
2. Kies bij **Source: GitHub Actions**. Hiervoor is beheertoegang nodig.
3. Start onder **Actions → Verify and deploy GitHub Pages → Run workflow**, of push naar `main`.
4. Wacht tot de deployment groen is.

Verwachte URL na succesvolle publicatie:
**https://h4sw5q2wr9-byte.github.io/scouting-fotojacht/**

De gebruikte GitHub-integratie kan commits pushen maar krijgt HTTP 403 bij het aanmaken/inschakelen van Pages. Daarom kan de eerste instelling in stap 2 door de eigenaar nodig zijn. De URL is pas gepubliceerd als de Pages-deployment slaagt.

De ongewijzigde aangeleverde site is hersteldbaar met de Git-tag **`original-zip`** (commit `08462d6`). Om te bekijken zonder wijzigingen aan main: `git switch --detach original-zip`.

## Validatie

`node scripts/verify.mjs` controleert unieke IDs en titels, behoud van alle oorspronkelijke IDs, verplichte opdrachtvelden, lokale bronverwijzingen, assets en JavaScript-syntaxis. Mobiele browsercontroles en hun beperkingen staan in [TESTING.md](TESTING.md).
