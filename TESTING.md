# v5 — local photos and ZIP export

No backend is needed. No participant photos are uploaded. The challenge library and social metadata remain unchanged.

Checks:

- `node scripts/verify.mjs`: 145 unique challenges, all original IDs, 11 local reference files/source credits, app/worker syntax, required files and exact 1200×630 Open Graph/Twitter image.
- `python scripts/browser-smoke.py`: mobile/touch Chromium; 320/375/390/768/1440px layouts; default team, multiple teams, photo capture/selection/confirmation, original reference snapshot, JPEG encoding without original EXIF, reload persistence, gallery/comparison, points, all-team and per-team ZIP exports. Python zipfile validates CRCs and paths, correct teams/titles, original files and actual 1600×1050 comparison JPEGs. The extracted HTML and comparison images load through a repository-only local server. Deletion, favorites and timer are also checked. The test records network requests and rejects every network write. No JS page errors.
- `python scripts/browser-edge-cases.py`: previous IndexedDB photo migration, custom reference persistence, missing-image fallback and timer/settings persistence.
- `git diff --check`.

Start a localhost-only repository server on port 8769 before the smoke test. It uses local reference artwork as test input, never a personal photo. Test outputs stay under `/tmp` and are not committed.

Limits: no physical iPhone Safari test was available. A native photo picker, HEIC decoding, iOS download UI and memory limits must be checked on the actual phone. The ZIP always includes individual JPEG comparisons even if the phone's HTML viewer restricts relative local images. A managed browser policy blocked direct file:// navigation in this environment; the extracted album was tested through localhost instead. If a very large export cannot fit in memory, use the smaller per-team ZIP buttons. Browser storage can be evicted: download a ZIP backup before leaving the game.
