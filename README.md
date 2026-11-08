# Cure · Ballot operations

A Next.js 16 / React 19 application backed by Supabase Auth, Postgres, and PostGIS. One Supabase project represents one campaign. Existing sample voter files are never automatically uploaded or exposed publicly.

## Architecture

App Router Server Components load voter workspaces, batch details, upload history/reports, and public batches directly through the server-only data layer in `lib/data.ts`. Staff reads verify the current Supabase session and `staff_members` membership; row-level security independently protects database access. The session check is memoized within a render, without caching authorization or voter data across requests. Loading and error boundaries handle server-rendered pages.

Client components receive the loaded data as props and keep interaction state such as filters, selections, dialogs, and live upload progress. They do not fetch initial screen data after hydration. Batch details query their own members instead of loading the complete workspace. Dates use Pacific time and counts use an explicit English locale so server and browser markup match.

Server Functions in `app/actions/` handle login/logout, batch assignment and editing, upload creation, and voter status changes. Every function validates inputs and enforces staff access or the database's public-token permission check. Expected errors return typed results. Successful mutations revalidate affected pages so fresh server props reach the UI; refresh buttons use the Next.js router. Login/logout forms use `useActionState` with server redirects.

The one retained HTTP endpoint is `/api/imports/[id]`: GET reads job progress and POST processes another resumable chunk. Upload creation itself is a Server Function. Its request-body limit is 6 MB to accommodate multipart overhead while preserving the 5 MB file limit. Chunk processing still depends on an open browser; it is not a background worker.

## Run locally

1. Install dependencies with `pnpm install` (Node 22+).
2. Copy `.env.example` to `.env`, or retain your existing `.env`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from your Supabase project. A legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported.
3. Apply the SQL files in `supabase/migrations/` in filename order in the **Supabase SQL editor**, or set `POSTGRES_SESSION_POOLER_URL` (or `POSTGRES_URL`) and run `pnpm db:migrate`. The command installs the initial schema if needed and applies the voter removal, batch deletion, and Support ID migrations. Existing installations can run it to enable these features without recreating tables. Deleting a batch revokes its volunteer link and preserves voter records and contact history. `pnpm db:check` checks whether the base schema is installed.
4. Create your initial administrator account in **Supabase → Authentication → Users**, with an email and password. Add its user ID to the staff allowlist using the SQL editor:

   ```sql
   insert into public.staff_members (user_id)
   values ('THE-AUTH-USER-UUID');
   ```

5. Run `pnpm dev` and open `http://localhost:3000`. `/` opens the protected voter workspace; signed-out visitors are sent to `/login`.

If `db.YOUR_PROJECT.supabase.co` does not resolve or your network cannot reach an IPv6-only direct database endpoint, copy the **Session pooler** connection string from Supabase's Connect dialog into `POSTGRES_SESSION_POOLER_URL`. The SQL editor also works without a local database connection. Never put database passwords or Supabase secret/service-role keys in `NEXT_PUBLIC_*` variables. Normal staff and public workflows use the publishable key and authenticated sessions. Staff management additionally uses a server-only secret key.

## Automatic migrations with Vercel and Supabase

The [Vercel/Supabase integration](https://supabase.com/docs/guides/integrations/vercel-marketplace) syncs database credentials into Vercel. To apply committed migrations automatically, also configure the [Supabase GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration):

1. Before enabling automatic deployment on an existing database, compare its schema and Supabase migration history with `supabase/migrations/`. The local `pnpm db:migrate` script and SQL editor do not record files in Supabase's migration history. Use the Supabase CLI's `migration list` and, only for migrations whose SQL has already been fully applied, `migration repair --status applied <version>` to reconcile history. Otherwise the integration may try to recreate existing tables. Leave `202611070004` pending if `public.voters.support_id` is missing; marking it applied would skip the fix.
2. In **Supabase → Project Settings → Integrations → GitHub**, authorize GitHub and select this repository. Set **Working directory** to `.` because `supabase/` is at the repository root.
3. Set the production branch to `main` and enable **Deploy to production**. Keep the Vercel production branch set to `main` as well.
4. Push a commit to `main`, then check the Supabase deployment logs for the migration step. It should apply pending SQL files, including `202611070004_supporters.sql`, which adds `public.voters.support_id` and updates the importer. Reupload older voter exports to recover Support IDs that the old importer discarded.

Supabase and Vercel both react to the Git push; this setup does not wait for Vercel to finish deploying. Strict ordering after a successful Vercel deployment requires a separate deployment-event workflow. No GitHub Actions workflow or Vercel build-command change is needed for Supabase's native GitHub deployment. See [Supabase migration history and repair](https://supabase.com/docs/guides/deployment/database-migrations) for the one-time transition from manually applied SQL.

## Signup and staff approval

Configure these environment variables on the server (and restart the app):

- `SUPER_ADMIN_USER_ID`: the exact Authentication user UUID of your initial administrator. This user must also belong to `staff_members`. With this unset, nobody has super-admin access. Staff cannot change this setting or promote themselves.
- `SUPABASE_SECRET_KEY`: the Supabase project's secret key (a legacy service-role key also works). This privileged client is used only after the super-admin authorization check to list accounts and grant staff membership. Signup uses the public key.

In **Supabase → Authentication**, enable new user signups and the Email provider. Under **URL Configuration**, set **Site URL** to the app's root URL, such as `https://YOUR_APP_DOMAIN` or `http://localhost:3000` for local testing. Keep the default **Confirm signup** email template. No email template changes or app `SITE_URL` environment variable are required.

Anyone can register at `/signup` with an email and password of at least 12 characters. Signup never inserts a `staff_members` row. With email confirmation enabled, Supabase sends its standard confirmation email. The app accepts the PKCE code at the root Site URL and exchanges it at `/auth/callback`, then opens `/pending-approval`. Open the link in the same browser used for signup; if the session cannot be established, users can sign in with their password after confirming their email. With email confirmation disabled, signup goes straight to `/pending-approval`. See [Supabase signup behavior](https://supabase.com/docs/reference/javascript/auth-signup).

If email confirmation is enabled, the project's email delivery settings must support your registrants. Supabase's default mail service restricts recipients and has tight rate limits; see [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp). The app does not send invitation or approval emails.

Sign in as the configured administrator and open **Staff management** (`/staff`). All accounts without staff membership appear under **Awaiting approval**. Click **Approve as staff** to insert their account ID into `staff_members`; existing staff appear separately. The listing reads every page of Auth users. Email confirmation status is shown independently, and approval does not bypass Supabase's email confirmation requirement.

Unapproved accounts stay signed in on `/pending-approval` and cannot access staff pages, data, or mutations. After approval, **Check approval status** or a new login opens the voter workspace. Approval is idempotent and does not change passwords or account metadata. Revoke access by deleting the account's `staff_members` row in the SQL editor; the account then appears as unapproved again.

If staff management reports `permission denied for table staff_members`, apply `202611070005_staff_management_grants.sql` in the SQL editor or run `pnpm db:migrate`. It explicitly grants `select, insert, update` on `public.staff_members` to `service_role` for listing and approval. The server-only secret key bypasses RLS but still needs table privileges; authenticated users retain their existing read-own-membership policy.

## Staff workflow

- **`/staff`**: super-admin only account list and staff approval. Access requires both staff membership and the configured `SUPER_ADMIN_USER_ID`. Use `pnpm test:staff` for signup, approval authorization, account pagination, and callback tests.
- **`/signup`**: public account registration; staff access requires separate administrator approval.
- **`/pending-approval`**: signed-in accounts awaiting staff access. Refresh the approval status to enter the app after approval.
- **`/login`**: email/password authentication. Approved users enter the workspace; unapproved users see their pending status. Staff access always requires both a verified Supabase session and explicit `staff_members` membership.
- **`/uploads`**: CSV and XLSX uploads, reports, failed-row downloads, and resumable processing. Limits: 5 MB and 10,000 data rows per file. XLSX reads the first worksheet. The supplied CSV and Excel exports each contain 122 supported rows. Report links use `/uploads?import=[id]` and load the report on the server.
- **`/voters`**: map, searchable/paginated table, status and ZIP filters, an unassigned-only filter, and a Supporters checkbox for Strong Support or Lean Support. Click a marker to select a voter; grouped markers list all voters at that coordinate. On desktop, **Select an area** lets you drag a rectangle. The table supports individual selection and selecting all filtered voters, including across pages. Selections remain when filters change; the selection count includes hidden selections.
- **`/batches`**: rename batches, copy links, inspect contents, and enable/disable public access. Select voters in the workspace to create a door-knocking or phone-calling batch, or add them to an existing active batch. Assignment is transactional and repeated assignment is harmless.
- **`/batches/[id]`**: staff batch details and a link to the volunteer view. Staff can inspect disabled batches, but status changes require an active link.

## Upload format and geocoding

Use these template headers:

```csv
first_name,last_name,street,unit,city,state,zip,phone
Alex,Example,4600 Silver Hill Rd,,Suitland,MD,20746,
```

The PDI headers `V1_FIRSTNAME`, `V1_LASTNAME`, `RES_ADDRESS1`, `RES_ADDRESS2`, `RA_ZIP`, and `WIRELESSPHONENUMBER` are recognized. A locality such as `Los Angeles, CA 90011` in `RES_ADDRESS2` is extracted into city, state, and ZIP; ordinary unit values remain part of the address. Phone numbers are optional and normalize to `+1` plus ten digits. Invalid phone numbers are reported as failed rows rather than silently discarded.

Identity is first + last name and complete address (street, unit, city, state, ZIP), ignoring case, whitespace, and punctuation. A database-generated unique key prevents duplicates even during concurrent imports. Unicode letters are preserved. Address abbreviations, alternate spellings, and differently placed apartment information are not fuzzy-matched. Existing records, phone numbers, and statuses are preserved when duplicate rows are skipped. Duplicate rows are reported separately from failures.

Uploads are persisted before geocoding. The browser drives resumable chunks of 100 using the [US Census batch geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html). Only row identifiers and addresses are submitted; names and phone numbers are excluded. Unambiguous matches with valid coordinates are imported, including Census `Non_Exact` matches (for example, fractional house numbers or an added street direction). Original voter addresses are preserved. Coordinates are saved in scalar columns and a generated PostGIS `geography(Point,4326)` with longitude first and a spatial index. Nonmatches/ties are failed rows; download, correct, and reupload them. Existing imported voters will be skipped on a retry.

The browser can pause between chunks. Navigating away may allow the current server request to finish, but subsequent chunks wait until **Resume upload** is clicked. A three-minute claim lease recovers interrupted requests. Upstream/network failures reset the chunk to pending instead of losing progress. Import histories and outcomes are durable; the last 50 uploads are shown.

The optional `Support ID` (or `support_id`) column is imported for the Supporters filter. Older imports discarded this field; after applying the Support ID migration, reupload the original file to fill missing Support IDs on existing voters. Reuploads preserve existing nonblank Support IDs. Party, age, gender, and other demographic fields are not imported or used for selection. The map differentiates curing statuses: uncontacted, interested, cured, no response, and not interested.

## Volunteer access

Both batch types use **`/batch/[token]`**. Separate URL structures are unnecessary: the stored batch type controls the map and directions. Door-knocking batches include both. Phone-calling batches display the same contact cards without the map. Cards include call/text links when a phone number is available.

A 256-bit random bearer token grants access to the voters in that active batch. Anyone holding the link can read those voters' names, addresses, phone numbers, and statuses, and change only their curing status. Volunteers do not log in. Share links only with assigned volunteers; disable a batch to revoke its public access. Re-enabling a batch restores the same link.

Statuses are shared across all batches for a voter. Selecting the current status clears it to no status. Updates are saved immediately, recorded in `status_events`, and use optimistic concurrency: if another volunteer already changed the voter, the later save is rejected with a refresh prompt. Use **Refresh** to load other volunteers' latest updates. Links do not identify individual volunteers, so the audit records the batch and status change, not a volunteer identity.

Anonymous clients have no direct table permissions. Narrow SQL functions validate the active token and batch membership. Authenticated staff are protected by row-level security and server-side membership checks. Pages have noindex, same-origin referrer and frame restrictions; private APIs return no-store. Public RPCs use an anonymous client rather than bypassing RLS with a service key. Maps use OpenStreetMap's standard interactive tiles and require internet access. Tile requests send only the site origin as their referrer, preserving batch-token privacy while complying with the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Failed tiles leave the table available. For a large deployment, configure a tile provider suitable for its traffic.

## Verification

Storybook previews live under **Screens**: Login, Voters, Batches, Batch Detail,
Uploads, and Volunteer Batch. Run `pnpm storybook` to open them on port 6006,
or `pnpm build-storybook` to generate a static preview in `storybook-static`.
Run `pnpm test:storybook` for browser rendering and interaction
checks (install Chromium once with `pnpm exec playwright install chromium`).

Stories use the app's components and styles, synthetic records in
`stories/fixtures.ts`, and the staff shell where appropriate. Storybook-only Vite
aliases replace server actions and import API requests with mocks in
`.storybook/mocks`; no Supabase configuration is needed. Mock writes reset for
each story and do not persist data or reload server-provided props. Maps still
use live OpenStreetMap tiles and need internet access; map animations are disabled
in previews to keep story changes stable. The stories include empty
lists, upload reports, disabled batches, and interactive error and success states.

```sh
pnpm typecheck
pnpm test
pnpm build
# With the app running in another terminal:
pnpm test:smoke
# After schema setup, with an administrator pooler connection:
pnpm test:db
```

Unit tests cover both sample exports, field normalization, duplicate detection, Unicode identities, malformed inputs, CSV quoting, geocoder response handling, and address-only Census submissions. Database integration checks use temporary synthetic fixtures inside a rolled-back transaction, testing PostGIS, anonymous table denial, staff RLS, batch scoping, status conflicts and clearing, revocation, and audit history. They also test import outcomes, lease recovery, retry idempotency, and batch assignment. They require a migrated, reachable database and never commit fixture data.

Deploy as a server-backed Next.js application with the two public Supabase environment values configured. Upload processing uses Node route handlers with a 120-second duration budget; choose a host that permits it. The Census request itself has a 65-second timeout. A static export cannot support authentication or uploads.
