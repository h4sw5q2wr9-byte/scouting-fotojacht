# FOTOJACHT

Kies een foto. Maak hem samen na. Bewaar jullie herinneringen per team.

This branch simplifies the previous interface to three tabs: **Spelen**, **Fotoalbum**, **Teams**. The live `main` branch has the separate social-preview fix; this private-team redesign is not ready for live shared uploads until its Supabase project is connected and verified.

## Simple flow

1. Browse without an account. The default challenge and picker use the 11 locally included reference images so pictures actually appear in the site. All 145 challenges remain unchanged and available through **Ook opdrachten met zoeklink**; copyrighted scenes still have a specific external search option instead of an unauthorized image. A permitted custom reference may be saved only on the current phone.
2. Sign in, create a team or enter a private invitation code. Every participant uses their own account. The organiser automatically belongs to each team they create.
3. Pick a challenge, optionally start the timer, then make/choose your recreated photo. Confirm the team and points before uploading.
4. View the gallery grouped by team, compare a recreation with its locally available original, and download individual photos or an entire self-contained HTML team album. Only the uploader or owner can delete a photo.

## Photo privacy

**Never save participant photos in this public repository.** Cookies cannot store an album. Private shared photos require authentication and server-enforced access rules, provided here by Supabase Auth, PostgreSQL row-level security and a private Storage bucket.

`config.js` is intentionally blank: uploads/sign-in are disabled until the backend is configured. Connect Supabase or follow [backend/README.md](backend/README.md) to activate and test the service. No private photo service has been deployed or verified yet. No service-role/secret key belongs in the frontend.

New photo files are converted to JPEG, stripped of the original EXIF/GPS metadata, and reduced to 1800px before a confirmed upload. Photo downloads require team membership. Temporary photo URLs are kept in memory and revoked on sign-out; the service worker never caches private photo requests. Team members can download copies, so share team invitations only with the group. This is private provider-managed storage, not end-to-end encryption.

Existing photos from the old site are retained locally in an **Eerdere foto's op deze telefoon** album. They are not automatically uploaded or assigned to a team. Old scores/preferences remain under their original browser key, but are not silently imported into the shared service.

## Local development

No runtime build step is needed:

```sh
python3 -m http.server 8767 --bind 127.0.0.1
node scripts/verify.mjs
# open http://127.0.0.1:8767/
```

The vendored Supabase JS client (v2.118.0, MIT license in `vendor/`) is local; no CDN scripts are required. `scripts/build-vendor.sh` documents how it was bundled. Browser test details and limits are in [TESTING.md](TESTING.md).

## Reference images

[assets/references/sources.json](assets/references/sources.json) lists the 11 included public-domain works and NASA photograph, authors, source pages and conversions. They are genuine references, not AI substitutes. Other copyrighted scenes retain a targeted search link. The independent `assets/og-image.png` is an original generated branding illustration for link previews, not a challenge reference.

## GitHub Pages and social previews

The public site is https://h4sw5q2wr9-byte.github.io/scouting-fotojacht/ . The workflow validates site files and private-access SQL, then deploys static assets on pushes to `main`. Pull requests validate without deploying.

Social metadata lives directly in `index.html`, so crawlers do not need JavaScript. Open Graph and Twitter Cards use the absolute 1200×630 `assets/og-image.png` URL. WhatsApp, Discord, iMessage and other services may retain an earlier preview until their cache refreshes.

Original ZIP backup: `original-zip` (`08462d6`). Previous complete interface backup: `before-simple-teams-2026-11-02` (`74db494`). The social-only change is commit `670a38e`; it changes only `index.html` metadata and the new preview asset.
