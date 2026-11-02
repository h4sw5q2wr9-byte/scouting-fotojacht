# FOTOJACHT V2 verification

- `node scripts/verify.mjs`: 21 unique real local JPEG challenges, 19 for 2–4 people and two solo reactions, V2 manifest/data parity, credits and usable license fields, valid scripts, archived earlier titles and credits, exact 1200×630 social preview, no old timer/team/search controls.
- `python scripts/browser-smoke.py`: first-open/reopen tutorial, all 21 local photos actually decode, responsive widths 320/375/390/768/1440px, make/choose/save a recreation, one-per-challenge replacement, reload persistence, side-by-side comparison, continue/previous/category picker, current-photo deletion, ZIP CRC/readable paths/titles/originals/credits and actual 1600×1080 JPEG comparisons. The test asserts no network writes and no JS page errors. Test artwork inputs, not personal photos, are used.
- `python scripts/browser-edge-cases.py`: original v1 photo migration and separate readable legacy ZIP, idempotent recovery after reload, broken-image cards hidden without search links, denied storage reported without pretending to save, complete 21-photo deck cached and loaded offline, including the `?v=2` test link. Personal photos are absent from Cache Storage.
- `git diff --check`.

Start a repository-only server on `127.0.0.1:8772` for the browser tests. Playwright, Chromium and Pillow are development tools, not visitor dependencies. Generated ZIPs/screenshots stay under `/tmp`.

Reference photographs were individually inspected in a contact sheet; distant S10, André Rieu and Loreen shots were replaced with clearer licensed photos. An agency-credited Max image was excluded in favor of Morio's own licensed podium photograph. Titles/instructions were corrected to match the actual visible poses. No generated illustration substitutes are used as challenge references.

A physical iPhone Safari was not available. Native camera selection, HEIC decoding, iOS Files download behavior and OS storage eviction still need an actual device check. The app uses 16px native file/input controls, safe-area spacing and native dialogs. Cookies are not used for photos; IndexedDB persists them locally. Private mode/cleared storage can remove data, so download the ZIP backup.

The V2 pack itself contained no actual reference photos. Its manifest shape, contract and export folder guidance were applied; placeholder examples are kept only in docs and never enter gameplay. Starting release is recoverable from tag `before-v2-deck-2026-11-02`.

The content refresh was visually reviewed: group interactions replace generic celebrity/performer portraits. Data validation enforces a 1–4 player limit, at least 80% group cards, and matching min/max player counts. The browser test checks exact player-count filters and that random/next obey them. Existing saved photos from the previous deck remain under the earlier-photo section and retain archived titles/credits.
