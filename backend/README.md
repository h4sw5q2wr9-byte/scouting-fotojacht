# Private team albums — activation required

**No live backend is configured in this branch.** `config.js` is intentionally empty. The site permits browsing and timers but disables new photo uploads and sign-in until setup is complete. This is not a working shared-photo deployment yet.

## Connect and set up

The available Supabase connection was suggested in the conversation but has not been confirmed. Connect it to allow the assistant to configure and verify the project, or complete these steps in your own Supabase account:

1. Create a dedicated Supabase project, preferably in an EU region for this Dutch group. Keep the database password and service-role/secret keys out of GitHub and chat.
2. Run **only `schema.sql`** in the project SQL editor. `test-bootstrap.sql` and `test-access.sql` are fixtures for an empty, disposable local PostgreSQL instance; do not run them on the live project.
3. Keep the `team-photos` bucket **private**. The migration limits uploads to JPEG images of at most 5 MB, installs row-level security, and makes team membership a prerequisite for photo metadata and image downloads.
4. Enable email/password authentication with email confirmation. Configure a production SMTP sender for real participants; Supabase's default sender has restrictions and rate limits. Set the Site URL and redirect allowlist to `https://h4sw5q2wr9-byte.github.io/scouting-fotojacht/` (and localhost only for development). Leave anonymous sign-in disabled. Review project quotas before inviting the group.
5. Put the project URL and **publishable** (or legacy `anon`) key in `config.js`. These identify the project and are public; they are not the security boundary. The database and storage policies are the boundary. `service_role`, `sb_secret_…`, database passwords and SMTP passwords never belong in client code.
6. Merge/push the frontend and verify all of the live checks below before using personal photos. An empty config must never be described as a completed shared-photo service.

## Access model

- Each participant logs in with their own email/password. The session is kept in `sessionStorage`, not a photo cookie. Closing the tab ends local session persistence; cloud photos remain until deleted.
- A signed-in user can create a team. They automatically become the owner/member. Only team members can select that team's metadata, members or photos.
- Only the owner can generate an invitation. The server creates a random 192-bit code, stores only its SHA-256 hash and expires it after 24 hours. Generating a new code invalidates the previous code. Joining requires an authenticated account and is limited to 30 attempts per hour per account.
- Anyone who is given a valid code can join that team. Share codes privately. An owner can remove a member. A removed member cannot make new authorized downloads, but you cannot recall copies they have already saved or screenshots they have taken.
- Photo paths are `team_uuid/uploader_uuid/photo_uuid.jpg`. A team member may upload only in their own folder. Only the uploader or team owner may delete a photo. There are no direct API grants for changing teams, members or invite hashes.
- The organiser sees all teams they created; a participant sees teams they joined. Other teams' albums are not visible by default. If the organiser wants a participant to see multiple teams, invite them to those teams explicitly.
- Images are downloaded using the signed-in user's bearer token, then rendered with temporary in-memory Blob URLs. No public URLs or signed sharing URLs are created. The service worker caches only public site assets, never Supabase requests or private media. Uploaded objects use `cacheControl: 0`.
- Canvas rendering reduces photos to at most 1800px and creates a fresh JPEG. The stored file does not contain the original EXIF/GPS metadata. Upload happens only after the user confirms the preview/team. This is ordinary provider-managed private storage, **not end-to-end encryption**; project administrators/provider infrastructure can access stored data.
- Per-team HTML album downloads contain the actual photos for offline viewing. These are private copies under the downloader's control, not published website pages. Share them only with the group.

## Existing browser data

The new frontend reads the previous IndexedDB `images` store. Existing custom reference pictures stay local. Old `recreation:*` photos appear in an **Eerdere foto's op deze telefoon** section, where they can be downloaded or deleted. They are never automatically uploaded. Previous localStorage settings/scores are retained under the old key but do not become shared team records. Team scores in the new service are sums of stored photo points.

## Verification before activation

Use test artwork, never personal photos, for setup checks:

- Create accounts A, B and C. A creates a team; B joins with A's code. A/B can load the album on separate devices. C cannot list team metadata/photos, guess the object path to fetch bytes, upload to the team or mint invitations. Anonymous requests must also fail.
- A rotates the invite: the old code must fail. A removes B: B's next metadata/image request must fail. Existing downloaded copies cannot be revoked.
- Upload a test image; reload and sign in from another phone. Confirm the photo is in the correct team's album, export and delete it, then confirm the storage object and database record are both gone.
- Sign out and confirm private media is removed from the current screen. Inspect Cache Storage: no private storage requests should be present.
- Test real email delivery, confirmation, password reset and a physical iPhone's camera/photo picker. Configure abuse controls/CAPTCHA for a broader public launch if needed.

`test-access.sql` runs the database portion with actual PostgreSQL row-level security and disposable auth/storage fixtures. It is not a substitute for verifying Supabase's actual Auth/Storage configuration live.

## Failure handling

The frontend uploads a new object, then inserts its metadata record. If metadata insertion fails it attempts to remove the new object. An interrupted connection can leave an unlisted orphan; periodically compare objects to `photos.object_path` and remove confirmed orphans through the project admin tools. Never make the bucket public to troubleshoot a failed image request. Fix membership/policies or network errors instead.

Reference: [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals), [storage access rules](https://supabase.com/docs/guides/storage/security/access-control), [production email](https://supabase.com/docs/guides/auth/auth-smtp).
