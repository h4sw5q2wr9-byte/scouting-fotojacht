# FOTOJACHT V2 — Maak ’m na

**Live:** https://h4sw5q2wr9-byte.github.io/scouting-fotojacht/

Eén groep per telefoon. **39 lokaal ingebouwde referenties**: Grappige interacties, komische scènes en overdreven reacties. **34 groepskaarten**, plus 5 solo-reacties (één daarvan ook met twee personen). Concert-, sport- en rode-loperportretten zijn verwijderd. Geen timer, scorebord, teambeheer, hotlinks of zoekmachines in het spel.

## Vanavond gebruiken

1. Open de site en lees de vier korte stappen. De **?** rechtsboven opent de uitleg opnieuw.
2. Kies **Alle 39 kaarten** of **Verras ons**. De kiezer toont alle kaarten, met de tien aangeleverde memes vooraan. Zoek op titel of filter op spelers. Kies eventueel precies 2, 3 of 4 personen. Vorige, volgende en willekeurig volgen dat spelersfilter. Solo-kaarten staan apart. Het origineel staat groot in de site; tik om te vergroten.
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

Eerder bewaarde foto’s blijven apart beschikbaar onder **Eerder opgeslagen foto’s** in het album. Oude opdrachttitels en credits, inclusief de vorige 25 kaarten, blijven in `archive/challenges-v1.json` voor die oude exports; ze zijn niet speelbaar in de nieuwe fotodeck. Ook oude v1-IndexedDB-foto’s worden behouden.

Nieuwe foto’s worden maximaal 1800px als JPEG opgeslagen, zonder de oorspronkelijke EXIF/GPS-metadata. De ingebouwde referentie wordt bij de foto bewaard voor een stabiele vergelijking. Downloaden of delen doe je zelf met toestemming van deelnemers.

## Inhoud en het V2-pack

Het aangeleverde `FOTOJACHT_V2_Codex_Pack.zip` is gelezen en gebruikt. Het bevatte een structuur, instructies en placeholders, geen bruikbare referentiefoto’s. De instructies en het contract staan onder `docs/v2-pack/`.

`assets/references/sources.json` gebruikt het V2-formaat `{version, items}`. Elk speelbaar item heeft een lokale JPEG, maker, image-level licentie, bronpagina, bewerkingsnotitie, `status: ready`, categorie, moeilijkheid en spelersaantal. `challenges.js` stelt dezelfde entries beschikbaar als `FOTOJACHT_LOCAL_REFERENCES`.

De referenties zijn echte foto’s/publiciteitsbeelden uit herbruikbare Commons-bronnen, geen AI-vervangingen. Het gaat onder meer om een fusion dance, de spionnenpose, drie wijze apen, de mysterieuze bol, ‘not impressed’, twee chauffeurs met allebei een stuur, een snackdief onder tafel, een ingestorte taart, vier gestapelde hoofden, Samson, dubbele Bassies en een ongemakkelijke handdruk. Twee sterke solo-reacties zijn Grumpy Cat en de mic drop. Sommige referenties zijn echte party-/cosplayfoto’s van een bekende pose, niet het oorspronkelijke studiofilmbeeld. Een scène zonder toegestane lokale foto is bewust niet opgenomen. Verre podiumbeelden zijn vervangen door duidelijkere foto's. Fotocredits staan lokaal op `credits.html`; bronlinks daar zijn alleen voor attributie en niet nodig om te spelen. Licenties van originelen gelden voor die originelen, niet automatisch voor jullie eigen foto’s.

## Ontwikkeling en deploy

```sh
python3 -m http.server 8772 --bind 127.0.0.1
node scripts/verify.mjs
python3 scripts/browser-smoke.py
```

Geen build of backend. De MIT-library fflate v0.8.2 maakt ZIP's in de browser. De service worker bewaart de openbare app en volledige kleine fotodeck voor offline gebruik na de eerste volledige installatie; persoonlijke foto’s gaan uitsluitend naar IndexedDB, niet naar Cache Storage.

Elke werkende push naar **main** wordt direct via GitHub Pages gepubliceerd. Social previews zijn behouden. Startpunt van deze rebuild: tag **before-v2-deck-2026-11-02**, commit `77b962c`. Oudere herstelpunten: `original-zip` en `before-simple-teams-2026-11-02`.

## Update: teams en humor

De deck is uitgebreid naar 33 kaarten. De meeste kaarten zijn voor 2–4 personen; twee aangeleverde groepsfoto’s ondersteunen ook grotere groepen. Een foto moest een grappige interactie of uitgesproken pose bevatten. Normale portretten, poses met meer dan vier hoofdrollen, een beeld van zandsculpturen en een architectuurfoto die als perspectiefgrap werd gevonden zijn na visuele controle verworpen. De Cha Cha Cha-foto is onder dezelfde CC BY-SA-licentie uitgesneden op drie zichtbare dansers.

Herstelpunt vóór deze inhoudswijziging: `before-funny-teams-deck-2026-11-02` (`ac85182`). Bestaande foto’s blijven in het eerdere album staan met hun oorspronkelijke titels en credits.


## Update V2.2
Alle tien aangeleverde beelden zijn exact lokaal opgenomen (Woman yelling at cat, Home Alone, Spider-Man, Distracted Boyfriend, Flynn Rider, Get Out, Up, perspectieftrap, groepsselfie en vele armen), plus twee extra groepsreferenties van Batman en de Three Stooges. Er zijn 33 kaarten. Nieuwe zoekbalk en spelersfilters tot zeven personen. Alle recreaties blijven lokaal; ZIP via **Jullie foto’s → Download ZIP**. Herkomst en SHA256 van gebruikersuploads: `docs/user-reference-uploads.md`. Deze uploads zijn niet vrij gelicentieerd; auteursrechten blijven bij de oorspronkelijke rechthebbenden. Herstelpunt: `before-uploaded-memes-2026-11-02`.


## Credits, offline en delen
De CC-licentielinks worden automatisch tegen naam en versie gecontroleerd. Samson is CC BY-SA 3.0 (Fun4life), Grumpy Cat CC BY-SA 3.0 (Gage Skidmore); de Commons-bron van Bassie noemt een public-domain-toewijding door Blom86 (gecontroleerd 2 november 2026). De bronfoto’s behouden hun eigen licentie, inclusief share-alike voor bewerkingen van die beelden. Zelfgemaakte recreaties blijven afzonderlijke beelden met eigen rechten. De ZIP bevat zichtbare bron- en licentielinks, `credits.json`, `LICENTIES.txt` en een creditbestand per origineel. Gebruikersuploads zijn niet als vrij gelicentieerd aangemerkt.

Na de eerste volledige online laadbeurt slaat de serviceworker het spel, alle JPEG-originelen en de WebP-weergavekopieën op voor offline gebruik. Houd de pagina de eerste keer even open; wis browseropslag niet vóór de ZIP-export. Privéfoto’s gaan alleen in IndexedDB, niet in de serviceworker-cache of repository. De WebP-weergavekopieën zijn samen 48% kleiner dan de JPEG’s; bij een ontbrekende WebP valt de kaart terug op JPEG.

Klik **Download ZIP**. Als de browser bestandsdeling ondersteunt, verschijnt daarna **Deel ZIP…**; die opent op een nieuwe tik het deelmenu zodat de vereiste gebruikersactie op iPhone behouden blijft. Bij annuleren of ontbrekende ondersteuning blijft de gedownloade ZIP beschikbaar. Het spel kiest geen ontvanger en verstuurt niets automatisch.

In een bewaarde vergelijking kun je **Kies als beste pose** aantikken. Eén favoriet wordt lokaal onthouden, in het album gemarkeerd en in `results.json` als `bestPose` opgenomen. Geen extra teams of scorebord. Ontwikkelversies zijn uit de zichtbare interface verwijderd. Het fotoaantal wordt bij wijziging aan schermlezers gemeld; icoonknoppen hebben tekstlabels.

Extra controle: `python scripts/browser-sharing.py` (gemockt deelmenu; verstuurt niets). Herstelpunt vóór deze update: `before-credits-sharing-2026-11-02`.


## Fotodeck voor de Scoutingavond
Zes extra, visueel gecontroleerde groepsfoto’s: wedding dab (2), Gangnam Style-liftscène (2), Titanic-pose (2), Bert en Ernie (2), kabouterdans met dikke buiken (3), Team Rocket en Pikachu (3). De aanwijzingen volgen de echte foto’s en bieden eenvoudige alternatieven voor kostuums. Geen nieuwe spelelementen. Alle eerdere kaarten, favorieten en eigen foto’s blijven bewaard. Totaal: 39 kaarten, waarvan 34 groepsopdrachten. Deze zes nieuwe referenties zijn herbruikbare echte foto’s; cosplay is als zodanig vermeld in de credits. Foto’s van poppen, een grote klas en dubbele dab-/Team Rocket-poses zijn na visuele controle niet toegevoegd.
Herstelpunt: `before-scout-night-photos-2026-11-02`.
