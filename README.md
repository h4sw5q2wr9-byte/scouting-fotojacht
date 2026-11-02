# FOTOJACHT 📸 — Scouting

Mobielvriendelijke fotochallenge met **125** opdrachten, waarvan **47 Nederlandse** (memes + tv/film).

## Online zetten met GitHub Pages

1. Maak op GitHub een **openbare** repository, bijvoorbeeld `scouting-fotojacht`.
2. Upload **index.html**, **challenges.js**, **sw.js** en **manifest.webmanifest** (direct in de hoofdmap van de repository). Upload desgewenst ook deze README.
3. Ga naar **Settings → Pages → Build and deployment → Deploy from a branch**.
4. Kies **main** en **/(root)** en sla op.
5. De site verschijnt doorgaans op `https://JOUW-GEBRUIKERSNAAM.github.io/scouting-fotojacht/`.

> Als je de ZIP gebruikt, upload dan **de bestanden uit de ZIP**: niet de ZIP zelf.

## Gebruik

- Zoek, filter en kies via **🎲 Kies er één** een opdracht.
- Open de opdracht en klik **Zoek origineel** voor de precieze oorspronkelijke afbeelding.
- Een deel van de kaarten toont direct een extern gehost voorbeeld; andere laden (indien beschikbaar) een *Wikipedia*-thumbnail. Dat is soms een filmposter of algemene afbeelding en **niet altijd de exacte scène**.
- Via **Eigen voorbeeld** kun je een **zelf opgeslagen screenshot** of foto instellen op een kaart. Dit blijft alleen op hetzelfde apparaat, via IndexedDB.
- **Favorieten, voltooid, teamnamen en scores** blijven in je browser opgeslagen (localStorage); geen gedeelde online synchronisatie.
- Timer met instelbare 3/5/10/15 minuten. Site zelf werkt na eerder bezoeken offline (externe afbeeldingen meestal niet).
- Op de iPhone kun je met Safari **Deel → Zet op beginscherm** kiezen.

## Copyright & privacy

De website downloadt of herverdeelt geen filmposters of memeafbeeldingen. Een handjevol openbare foto-URL's verschijnt als *extern geladen voorbeeld*; rechthebbenden behouden hun rechten, en hotlinks kunnen verdwijnen of door de host geblokkeerd worden. Wikipedia-foto's worden vanaf Wikipedia geladen. Bezoekers kunnen een eigen afbeelding opslaan op hun apparaat. Deel persoonlijke scoutingfoto's alleen als iedereen dat wil.

## Zelf bewerken

Alle opdrachten staan in `challenges.js`. Elke opdracht heeft een titel, categorie, pose-instructie, zoekopdracht, aantal personen, moeilijkheid en soms een vaste afbeelding/Wikipedia-artikel. Zet voor een ontbrekende exacte afbeelding eventueel een eigen link in `image`, met toestemming van de rechthebbende.
