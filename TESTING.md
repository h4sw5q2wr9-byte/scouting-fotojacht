# Verification

Run date: 2026-11-02.

## Automated checks

- `node scripts/verify.mjs`: 145 unique IDs and titles, all original 125 IDs, required fields, 11 local sources and assets, valid JavaScript and unique HTML IDs.
- `python scripts/browser-smoke.py`: Chromium at 390 × 844 with touch/mobile emulation. Search and categories, local-photo filter, random empty state, favorites and reload persistence, previous/next, skip, timer start, recreation upload/delete and IndexedDB persistence, score award with duplicate prevention, team name, full-screen reference viewer. Desktop layout at 1440px. No JavaScript page errors.
- `python scripts/browser-edge-cases.py`: responsive widths 320/375/390/768/1440px; repository URL prefix; every local reference decodes; timer duration/deadline survives reload and an expired deadline reaches zero; missing-image fallback; invalid score rejected. No JavaScript page errors.
- `git diff --check`.

For browser tests install Python Playwright and Chromium. Start a repository-only server on localhost port 8765 for `browser-smoke.py`; `browser-edge-cases.py` starts its own server. Optional `FOTOJACHT_URL` changes the smoke test target. These tools are for development and are not shipped as dependencies to visitors.

## Limits

Touch emulation checks mobile layout and interaction, but is not a physical iPhone Safari test. A WebKit browser download was attempted; missing host libraries prevented running it here. Native iPhone camera selection, HEIC decoding and behavior under OS memory pressure should still be checked on a device. The app relies on standard file inputs, uses 16px form fonts, safe-area spacing, dynamic viewport height and wall-clock deadlines to accommodate Safari.

External image-search result pages belong to Google and require internet; their content and image rights are not controlled by this project. The website never hotlinks those search-result images. User photos and game state stay in the browser. Clearing browser storage removes them.

## Deployment

The initial version is preserved remotely as `original-zip` (08462d6). Pages activation through the available GitHub integration returned HTTP 403, `Resource not accessible by integration`. The repository owner must select **Settings → Pages → Source: GitHub Actions** before the Pages workflow can publish. Consult the Actions run for the actual deployment status; do not treat the expected URL as proof of publication.
