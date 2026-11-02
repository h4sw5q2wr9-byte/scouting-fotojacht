# Verification — 2026-11-02

## Live social-preview change (main)

Commit `670a38e` changed only `index.html` metadata and `assets/og-image.png`. The challenge library and gameplay scripts/styles were unchanged in that commit.

- Exact PNG dimensions verified: **1200 × 630**.
- Open Graph and Twitter metadata include title, description, alt text and the same absolute HTTPS image URL.
- The published site returned the new metadata to a request using a WhatsApp user-agent, without executing JavaScript.
- The public PNG returned HTTP 200 with `image/png`; Pages workflow [41478823241](https://github.com/h4sw5q2wr9-byte/scouting-fotojacht/actions/runs/41478823241) succeeded.
- This verifies crawlability and metadata, not the internal cache/UI of every messaging platform. Previously shared links may retain cached previews.

## Simplified private-team branch

`config.js` is blank. No Supabase connection or live private-photo deployment has been confirmed. All cloud-interface tests below use mocks, and SQL tests use disposable PostgreSQL fixtures. They do not prove a live backend is configured.

- `node scripts/verify.mjs`: all 145 unique original library entries/IDs, all 11 local references and source records, assets, JavaScript syntax, exact preview PNG dimensions, Open Graph/Twitter tags, and rejection of secret/service-role keys in frontend configuration.
- `python scripts/browser-smoke.py`: Chromium mobile/touch at 390×844; working inline reference; safe disabled uploads while unconfigured; picker exposes 11 inline references or all 145 with search-link opt-in; search, timer, favorites after reload, three-tab navigation, responsive widths 320/375/390/768/1440px. No JavaScript page errors.
- `python scripts/browser-edge-cases.py`: repository URL prefix; old IndexedDB recreation photos remain visible locally, can be exported/deleted, and are not automatically uploaded; old custom reference survives; missing-image fallback; expired timer and selected duration across reloads. No JavaScript page errors.
- `python scripts/browser-cloud-mock.py`: actual vendored Supabase SDK against mocked network responses; login/team selection, no upload before confirmation, JPEG conversion without original EXIF, bearer-authenticated image fetches, per-team album and scores, session/album after reload, individual download and self-contained team export, invitation/member removal, photo deletion and logout media cleanup. No JavaScript page errors. Mocked browser contexts block service workers so intercepted backend/config responses are deterministic.
- `backend/test-access.sql` executed against a disposable **PostgreSQL 17** container with real RLS and fixtures for Supabase's Auth/Storage schemas. Passed: owner/member access, outsider and anonymous denial, unauthorized upload/metadata insertion denial, uploader-folder impersonation denial, protected deletion, invite rotation and membership removal, stored failed-attempt count, private bucket. A policy qualification bug caught by these tests was corrected before committing.
- `git diff --check` and syntax checks.

Run a repository-only server on `127.0.0.1:8767` for the smoke/cloud-mock tests. The edge-case script starts its own localhost-only server. Python Playwright and Chromium are development tools, not visitor dependencies.

CI runs `node scripts/verify.mjs` plus the SQL fixture/schema/access tests. Pull requests validate without deploying. Only main deploys after verification.

## Remaining live checks

Connect Supabase and complete [backend/README.md](backend/README.md). Verify real email delivery and confirmation/reset, independent accounts and phones, denied anonymous/outsider storage requests, revoked-member requests, and upload/export/delete end to end before using participant photos. No personal photo was uploaded during development.

A physical iPhone Safari was not available. The downloaded WebKit browser requires missing host libraries, so no Safari/WebKit execution is claimed. Device camera selection, HEIC decoding and memory behavior still require a device test. The interface uses native file inputs, 16px controls, safe-area spacing and wall-clock deadlines.
