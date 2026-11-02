# FOTOJACHT — v5

**Live:** https://h4sw5q2wr9-byte.github.io/scouting-fotojacht/

Een simpele fotochallenge: **Spelen → Fotoalbum → Teams**. Geen account, backend of cloudopslag. Alle 145 bestaande opdrachten zijn ongewijzigd beschikbaar. De standaard fotokiezer toont de 11 lokale referenties; schakel **Ook opdrachten met zoeklink** in voor de overige scènes. Copyrightbeelden worden niet zonder toestemming meegeleverd. Je kunt een eigen toegestaan voorbeeld lokaal toevoegen.

## In één minuut starten

1. Er staat meteen een team **Mijn team** klaar. Verander de naam of voeg teams toe bij **Teams**.
2. Kies een foto en maak de pose na. De timer is optioneel.
3. Kies **Maak of kies jullie foto**, bekijk de preview, geef punten en kies **Bewaar op deze telefoon**.
4. Tik bij **Fotoalbum** op **Download alle foto’s als ZIP**, of kies de ZIP-knop naast één team.

De ZIP bevat per team en opdracht een map met:

- jullie foto met de passende opdrachttitel in het mappad;
- het opgeslagen origineel, als dat beschikbaar is;
- **vergelijking.jpg** met titel, team en origineel naast jullie foto;
- **referentie.txt** met beschrijving, titel, bron en zoeklink;
- daarnaast **album.html** voor het uitgepakte album, **overzicht.json** en **LEES-MIJ.txt**.

Ontbreekt het origineel, dan toont de vergelijking dat expliciet en staat er een zoeklink bij. Nieuwe foto's bewaren een kopie van het beschikbare voorbeeld zodat de vergelijking niet verandert als je later een ander voorbeeld kiest. Pak de ZIP uit in Bestanden/Downloads. De losse vergelijking-JPG's werken ook als je telefoon het HTML-album niet volledig toont.

## Belangrijk voor vanavond

- **Foto's blijven uitsluitend in deze browser op deze telefoon.** Er is geen synchronisatie tussen telefoons. Iedere telefoon downloadt zijn eigen ZIP; deel die daarna zelf met de organisator.
- Cookies zijn veel te klein voor foto's. De app gebruikt **IndexedDB** voor foto's/teams en **localStorage** voor voorkeuren, timer en favorieten. Er worden geen foto’s naar GitHub of een server verstuurd.
- Gebruik geen privémodus. Browsergegevens wissen of opslagopruiming kan de foto's verwijderen. Download de ZIP na het spel als back-up. Iedereen die deze browser kan gebruiken, kan het lokale album openen: het is geen met een wachtwoord beveiligde kluis.
- Foto's worden maximaal 1800px groot als JPEG opgeslagen; oorspronkelijke EXIF/GPS-metadata wordt niet overgenomen. De camera-/fotobibliotheekkiezer is van de telefoon zelf.
- Foto's uit de eerdere site blijven behouden en worden in een lokaal team **Eerdere foto's** gezet. Ze worden niet geüpload.

## Ontwikkeling en publicatie

```sh
python3 -m http.server 8769 --bind 127.0.0.1
node scripts/verify.mjs
python3 scripts/browser-smoke.py
```

HTML, CSS en JavaScript; geen build nodig. ZIP's worden lokaal gemaakt met de gebundelde MIT-library fflate v0.8.2 (`vendor/FFLATE-LICENSE.txt`). Alleen openbare site-assets gaan naar GitHub Pages; de service worker bewaart geen persoonlijke foto's.

Elke push naar **main** wordt gecontroleerd en direct via GitHub Actions gepubliceerd. Open de site opnieuw of vernieuw om de nieuwste versie te laden; de header toont **v5**. De Open Graph/Twitter metadata en de 1200×630 social preview zijn behouden.

Bronnen van de lokale referenties: [assets/references/sources.json](assets/references/sources.json). Herstelpunten: `original-zip` en `before-simple-teams-2026-11-02`. De eerdere Supabase-opzet is vervallen; deze versie vereist geen verbinding of accounts. Validatie: [TESTING.md](TESTING.md).
