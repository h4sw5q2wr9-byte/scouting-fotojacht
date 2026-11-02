# FOTOJACHT V2 — Maak ’m na

**Live:** https://h4sw5q2wr9-byte.github.io/scouting-fotojacht/

Eén groep per telefoon. **25 echte, lokaal ingebouwde referentiefoto’s**: Nederlandse popcultuur, memes, filmpubliciteitsfoto’s, muziek en iconische fotografie. Geen timer, scorebord, teambeheer, hotlinks of zoekmachines in het spel.

## Vanavond gebruiken

1. Open de site en lees de vier korte stappen. De **?** rechtsboven opent de uitleg opnieuw.
2. Kies **Alle 25 kaarten** of **Verras ons**. Het origineel staat groot in de site; tik om te vergroten.
3. Kies **Maak jullie versie**, maak of kies een foto en tik **Bewaar & vergelijk**.
4. Bekijk beide foto’s naast elkaar en ga door naar de volgende kaart. Er blijft **één foto per opdracht** bewaard; een nieuwe versie vervangt de vorige na bevestiging.
5. Tik onderaan op **Jullie foto’s**, daarna op de grote knop **Download ZIP**.

De ZIP volgt het aangeleverde V2-pack:

- `photos/joost-europapa.jpg` — jullie foto’s met leesbare titels;
- `comparisons/joost-europapa-comparison.jpg` — originele referentie naast jullie versie, met titel;
- `originals/` — de bewaarde referenties;
- `results.json` — titels, bestandsnamen en overzicht;
- `credits.json` — makers, bronnen, licenties en bewerkingen van de originelen;
- `index.html` en `LEES-MIJ.txt` — album en uitleg na uitpakken.

## Lokaal bewaren

Foto’s blijven in **IndexedDB op deze telefoon**. Er zijn geen accounts, uploads of gedeelde serveralbums. Voorkeuren en de afgeronde tutorial staan in localStorage. Cookies zijn te klein om foto’s in op te slaan.

Gebruik geen privémodus. Browsergegevens wissen of opslagopruiming kan foto’s verwijderen: **download de ZIP aan het eind**. Iedere telefoon exporteert zijn eigen foto’s. Een optionele groepsnaam verandert alleen de naam/titel van de export; er is geen multi-teammodus.

Eerder bewaarde foto’s blijven apart beschikbaar onder **Eerder opgeslagen foto’s** in het album. De oude 145 opdrachttitels blijven in `archive/challenges-v1.json` voor die oude exports; ze zijn niet speelbaar in de nieuwe fotodeck. Ook oude v1-IndexedDB-foto’s worden behouden.

Nieuwe foto’s worden maximaal 1800px als JPEG opgeslagen, zonder de oorspronkelijke EXIF/GPS-metadata. De ingebouwde referentie wordt bij de foto bewaard voor een stabiele vergelijking. Downloaden of delen doe je zelf met toestemming van deelnemers.

## Inhoud en het V2-pack

Het aangeleverde `FOTOJACHT_V2_Codex_Pack.zip` is gelezen en gebruikt. Het bevatte een structuur, instructies en placeholders, geen bruikbare referentiefoto’s. De instructies en het contract staan onder `docs/v2-pack/`.

`assets/references/sources.json` gebruikt het V2-formaat `{version, items}`. Elk speelbaar item heeft een lokale JPEG, maker, image-level licentie, bronpagina, bewerkingsnotitie, `status: ready`, categorie, moeilijkheid en spelersaantal. `challenges.js` stelt dezelfde entries beschikbaar als `FOTOJACHT_LOCAL_REFERENCES`.

De referenties zijn echte foto’s/publiciteitsbeelden uit herbruikbare Commons-bronnen, geen AI-vervangingen. Het gaat onder meer om Joost/Europapa, Snollebollekes, Duncan, S10, Max & Lewis, Grumpy Cat, Rick Astley, ‘not impressed’, Chaplin, Marilyn, Audrey en Bolt. Een scène zonder toegestane lokale foto is bewust niet opgenomen. Verre podiumbeelden zijn vervangen door duidelijkere foto's. Fotocredits staan lokaal op `credits.html`; bronlinks daar zijn alleen voor attributie en niet nodig om te spelen. Licenties van originelen gelden voor die originelen, niet automatisch voor jullie eigen foto’s.

## Ontwikkeling en deploy

```sh
python3 -m http.server 8772 --bind 127.0.0.1
node scripts/verify.mjs
python3 scripts/browser-smoke.py
```

Geen build of backend. De MIT-library fflate v0.8.2 maakt ZIP's in de browser. De service worker bewaart de openbare app en volledige kleine fotodeck voor offline gebruik na de eerste volledige installatie; persoonlijke foto’s gaan uitsluitend naar IndexedDB, niet naar Cache Storage.

Elke werkende push naar **main** wordt direct via GitHub Pages gepubliceerd. Social previews zijn behouden. Startpunt van deze rebuild: tag **before-v2-deck-2026-11-02**, commit `77b962c`. Oudere herstelpunten: `original-zip` en `before-simple-teams-2026-11-02`.
