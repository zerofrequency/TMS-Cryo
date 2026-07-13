# TMS API and Document Storage Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the active Supabase integration from the TMS MVP, centralize PostgREST access behind a shared TMS API client, and store uploaded POD files on the VPS behind authenticated nginx routes.

**Architecture:** The browser uses a shared `window.TmsApi` client for same-origin `/rest/v1` data requests and `/documents` file operations. nginx keeps the existing login-cookie boundary, proxies data to loopback PostgREST, and proxies files to a new loopback Python document service writing under `/var/lib/tms/documents`; DERP remains unchanged on TCP 443 and UDP 3478.

**Tech Stack:** Static HTML, browser JavaScript, Node.js built-in test runner, Python 3 standard library and `unittest`, nginx, systemd, PostgREST, PostgreSQL 16, Bash deployment scripts.

---

## File Map

Create:

- `scripts/tms-api.js`: shared browser configuration, PostgREST request, and document request client.
- `tms-config.example.js`: safe generic runtime configuration example.
- `server/tms-documents-server.py`: loopback-only upload/download/delete service.
- `deploy/tms-documents.service`: systemd unit for the document service.
- `deploy/nginx-tms.conf.template`: nginx template with a runtime session-token placeholder.
- `scripts/install-vps-services.sh`: installs the document service and renders nginx config from `/etc/tms`.
- `tests/tms-api.test.mjs`: API client behavior tests using Node's built-in runner.
- `tests/tms-frontend-contract.test.mjs`: static cutover and HTML load-order tests.
- `tests/test_tms_documents_server.py`: document service unit/integration tests.

Modify:

- `package.json`: add JavaScript, Python, contract, and combined test commands.
- `.gitignore`: replace the ignored Supabase config with `tms-config.js` and keep secrets/local files excluded.
- `appts.html` and nine files under `pages/`: load `tms-config.js` and `scripts/tms-api.js` before page scripts; replace backend status copy.
- Ten data-backed files under `scripts/`: use `window.TmsApi`, generic API state, and neutral status text.
- `scripts/trip-plan-detail.js`: replace Supabase Storage upload with `TmsApi.uploadDocument()` and rollback delete.
- `scripts/deploy-vps.sh`: preserve generic config, install service assets, validate before release switch.
- `scripts/check-vps.sh`: verify document service and authenticated file lifecycle.
- `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/CURRENT.md`, `docs/PROJECT_STRUCTURE.md`, `docs/TMS_ACCEPTANCE_CHECKLIST.md`, and current architecture documents: describe PostgreSQL/PostgREST/TMS document storage.

Rename:

- All 13 `sql/supabase-*.sql` files to the equivalent `sql/postgres-*.sql` name and update tracked references.

Delete:

- `supabase-config.example.js` after the generic example is in place.

## Task 1: Establish the Test Harness

**Files:**

- Modify: `package.json`
- Create: `tests/tms-api.test.mjs`
- Create: `tests/tms-frontend-contract.test.mjs`
- Create: `tests/test_tms_documents_server.py`

- [ ] **Step 1: Add explicit test commands**

Add these scripts to `package.json`:

```json
"test": "npm run test:js && npm run test:python",
"test:js": "node --test tests/*.test.mjs",
"test:python": "python3 -m unittest discover -s tests -p 'test_*.py'"
```

- [ ] **Step 2: Add the first failing API-client test**

Create a VM loader in `tests/tms-api.test.mjs` that evaluates `scripts/tms-api.js` with a fake `window` and injected `fetch`. Add this test:

```js
test("builds a same-origin PostgREST request without auth headers", async () => {
  const calls = [];
  const api = loadClient(async (url, options) => {
    calls.push({ url, options });
    return response(200, "[]");
  });

  await api.request("appointments?select=isa&limit=1");

  assert.equal(calls[0].url, "/rest/v1/appointments?select=isa&limit=1");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[0].options.headers.apikey, undefined);
});
```

The loader must expose `loadClient(fetchImpl, config = {})` and `response(status, body, statusText = "")` helpers to later tests.

- [ ] **Step 3: Add failing contract assertions**

In `tests/tms-frontend-contract.test.mjs`, enumerate the ten HTML files and ten data-backed JavaScript files. Assert that each HTML file loads `tms-config.js`, then `tms-api.js`, then its page script. Assert active HTML/JS contains none of:

```js
const retiredPatterns = [
  "supabase-config.js",
  "CARRIER_APPT_SUPABASE",
  "state.supabase",
  "loadSupabaseConfig",
  "supabaseRequest",
  "/storage/v1/",
];
```

- [ ] **Step 4: Add a failing document-service import test**

In `tests/test_tms_documents_server.py`, load `server/tms-documents-server.py` with `importlib.util.spec_from_file_location` and assert `validate_upload()` accepts a PDF header and returns the normalized `.pdf` extension.

```python
def test_validate_upload_accepts_pdf(self):
    result = self.module.validate_upload(
        entity_type="trip_plan",
        entity_id="11111111-1111-4111-8111-111111111111",
        document_type="pod",
        file_name="proof.pdf",
        content_type="application/pdf",
        body=b"%PDF-1.7\nexample",
    )
    self.assertEqual(result.extension, ".pdf")
```

- [ ] **Step 5: Run the suite and verify red**

Run: `npm test`

Expected: FAIL because `scripts/tms-api.js` and `server/tms-documents-server.py` do not exist and the active frontend still contains retired names.

- [ ] **Step 6: Commit the red tests**

```bash
git add package.json tests
git commit -m "test: define tms api migration contracts"
```

## Task 2: Build the Shared TMS API Client

**Files:**

- Create: `scripts/tms-api.js`
- Create: `tms-config.example.js`
- Modify: `.gitignore`
- Test: `tests/tms-api.test.mjs`

- [ ] **Step 1: Complete failing API behavior tests**

Add focused tests for:

```js
test("adds a configured generic API token", async () => {
  // Configure apiToken: "public-token" and assert both apikey and
  // Authorization: "Bearer public-token" are sent.
});

test("parses JSON and treats an empty response as an empty array", async () => {
  // Assert JSON rows are returned and HTTP 204 returns [].
});

test("reports the HTTP status and backend message", async () => {
  // Return HTTP 400 with "invalid query" and assert rejection contains both.
});

test("uploads a document with metadata headers", async () => {
  // Pass a PDF File-like object and assert PUT /documents/files, encoded file
  // name, entity headers, raw body, and returned metadata.
});

test("deletes a newly uploaded document by encoded storage path", async () => {
  // Assert DELETE /documents/files/trip-plans/... and path segment encoding.
});
```

- [ ] **Step 2: Run API tests and verify red**

Run: `node --test tests/tms-api.test.mjs`

Expected: FAIL because `window.TmsApi` is missing.

- [ ] **Step 3: Implement the browser client**

Implement `scripts/tms-api.js` as an IIFE that reads `window.TMS_CONFIG || {}` and exposes:

```js
window.TmsApi = Object.freeze({
  configure,
  isConfigured,
  request,
  uploadDocument,
  deleteDocument,
  documentUrl,
});
```

Normalize trailing slashes. Build REST URLs as `${apiBaseUrl}/rest/v1/${path}` and document URLs as `${documentBaseUrl}/files/${encodedPath}`. Use `credentials: "same-origin"`. Add JSON content type by default for REST requests, preserve caller headers, and add token headers only when `apiToken` is non-empty.

For upload, send raw bytes with `PUT`, preserve the file MIME type, URL-encode the original filename header, and validate that the service response contains `storagePath` and `fileUrl` before returning it.

- [ ] **Step 4: Add the generic safe config example**

Create `tms-config.example.js`:

```js
window.TMS_CONFIG = {
  apiBaseUrl: "",
  apiToken: "",
  documentBaseUrl: "/documents",
};
```

Replace `/supabase-config.js` with `/tms-config.js` in `.gitignore`.

- [ ] **Step 5: Run focused tests and verify green**

Run: `node --test tests/tms-api.test.mjs`

Expected: all TMS API tests PASS.

- [ ] **Step 6: Commit the client**

```bash
git add .gitignore scripts/tms-api.js tms-config.example.js tests/tms-api.test.mjs
git commit -m "feat: add shared tms api client"
```

## Task 3: Build the VPS Document Service

**Files:**

- Create: `server/tms-documents-server.py`
- Modify: `tests/test_tms_documents_server.py`

- [ ] **Step 1: Add validation and path-security tests**

Add tests that assert:

- PNG and JPEG signatures are accepted with matching MIME and extension.
- Unsupported MIME, mismatched extension, invalid signature, invalid entity UUID, and body larger than 20 MiB raise `UploadValidationError`.
- `resolve_storage_path(root, "../secret")` raises `PathValidationError`.
- A valid path resolves beneath the temporary storage root.
- PUT creates a UUID-named file, GET returns identical bytes, and DELETE removes it.

Use `tempfile.TemporaryDirectory`, start `ThreadingHTTPServer(("127.0.0.1", 0), handler)` in a test thread, and stop it in cleanup.

- [ ] **Step 2: Run Python tests and verify red**

Run: `python3 -m unittest discover -s tests -p 'test_*.py'`

Expected: FAIL for missing validation and handler behavior.

- [ ] **Step 3: Implement validation primitives**

In `server/tms-documents-server.py`, define:

```python
MAX_BODY = 20 * 1024 * 1024
ALLOWED_ENTITY_TYPES = {"trip_plan": "trip-plans"}
ALLOWED_DOCUMENT_TYPES = {"pod"}
MIME_RULES = {
    "application/pdf": (".pdf", lambda body: body.startswith(b"%PDF-")),
    "image/png": (".png", lambda body: body.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/jpeg": (".jpg", lambda body: body.startswith(b"\xff\xd8\xff")),
}
```

Define immutable `UploadDetails(extension, safe_original_name)`, `UploadValidationError`, `PathValidationError`, `validate_upload(...)`, and `resolve_storage_path(root, storage_path)`. Use `uuid.UUID` for entity IDs and `Path.resolve().relative_to(root.resolve())` for containment.

- [ ] **Step 4: Implement HTTP PUT, GET, and DELETE**

Create a `DocumentHandler` that:

- Rejects missing, zero, non-numeric, or oversized `Content-Length` before reading.
- Reads the exact body, validates metadata, generates `uuid.uuid4()`, and writes atomically with a temporary file followed by `Path.replace()`.
- Returns JSON with `storagePath`, decoded `fileName`, `mimeType`, `size`, and `/documents/files/...` URL.
- Serves only paths below the storage root with `Content-Length`, `Content-Type`, `Content-Disposition: inline`, and `X-Content-Type-Options: nosniff`.
- Deletes only a validated existing regular file and returns HTTP 204.
- Returns JSON errors with 400, 404, 413, or 415 status as appropriate.
- Suppresses default request logging and binds to `127.0.0.1`, port `3101` by default.

Read `TMS_DOCUMENT_ROOT`, `TMS_DOCUMENT_HOST`, and `TMS_DOCUMENT_PORT` from environment variables for tests and deployment.

- [ ] **Step 5: Run Python tests and verify green**

Run: `python3 -m unittest discover -s tests -p 'test_*.py'`

Expected: all document service tests PASS.

- [ ] **Step 6: Commit the document service**

```bash
git add server/tms-documents-server.py tests/test_tms_documents_server.py
git commit -m "feat: add vps document storage service"
```

## Task 4: Migrate the Frontend Data Layer

**Files:**

- Modify: `scripts/appointments.js`
- Modify: `scripts/carrier-billing.js`
- Modify: `scripts/fc-dashboard.js`
- Modify: `scripts/inventory-detail.js`
- Modify: `scripts/inventory.js`
- Modify: `scripts/resource-maintain.js`
- Modify: `scripts/resources.js`
- Modify: `scripts/trip-plan-detail.js`
- Modify: `scripts/trip-plans-list.js`
- Modify: `scripts/trip-plans.js`
- Test: `tests/tms-frontend-contract.test.mjs`

- [ ] **Step 1: Run the frontend contract and verify red**

Run: `node --test tests/tms-frontend-contract.test.mjs`

Expected: FAIL listing the scripts that still contain retired Supabase names.

- [ ] **Step 2: Migrate appointment persistence**

In `scripts/appointments.js`:

- Rename `SUPABASE_TABLE` to `APPOINTMENTS_TABLE`.
- Replace `state.supabase` with `state.api = { enabled: Boolean(window.TmsApi) }`.
- Replace configuration loading with `state.api.enabled = Boolean(window.TmsApi && window.TmsApi.isConfigured())`.
- Replace table request helpers with `window.TmsApi.request(`${table}${query}`, options)`.
- Rename conversion helpers to `recordToApiRow` and `recordFromApiRow`.
- Rename sync/load/upsert/delete functions from `*Supabase*` to `*Api*`.
- Keep IndexedDB fallback behavior unchanged.
- Change status messages to `TMS API`, `server`, or `local backup` wording.

- [ ] **Step 3: Migrate the nine module scripts**

For each remaining script:

- Replace `state.supabase` with `state.api`.
- Replace `loadSupabaseConfig()` with a generic API availability check.
- Replace every `supabaseRequest(path, options)` call with `window.TmsApi.request(path, options)`.
- Remove each duplicated request helper.
- Preserve all table names, query strings, HTTP methods, `Prefer` headers, payloads, and render behavior.
- Replace setup and failure copy with `TMS API is not configured`, `Loading TMS data`, or the module-specific action.

- [ ] **Step 4: Replace Trip Plan POD storage**

In `scripts/trip-plan-detail.js`, remove `DOCUMENT_BUCKET` and `uploadStorageObject`. Implement:

```js
const uploaded = await window.TmsApi.uploadDocument({
  entityType: "trip_plan",
  entityId: state.planId,
  documentType: "pod",
  file,
});
```

Persist `uploaded.fileUrl`, `uploaded.storagePath`, and `uploaded.mimeType`. Wrap metadata save in a nested `try/catch`; on failure call `window.TmsApi.deleteDocument(uploaded.storagePath)` in a best-effort cleanup, then rethrow the original error.

- [ ] **Step 5: Run contract and API tests**

Run: `npm run test:js`

Expected: API tests PASS; contract may still fail only on HTML/config references handled in Task 5. No JavaScript file may fail a retired-name assertion.

- [ ] **Step 6: Commit the data-layer migration**

```bash
git add scripts/appointments.js scripts/carrier-billing.js scripts/fc-dashboard.js scripts/inventory-detail.js scripts/inventory.js scripts/resource-maintain.js scripts/resources.js scripts/trip-plan-detail.js scripts/trip-plans-list.js scripts/trip-plans.js tests/tms-frontend-contract.test.mjs
git commit -m "refactor: migrate frontend to tms api"
```

## Task 5: Cut Over HTML and Runtime Configuration

**Files:**

- Modify: `appts.html`
- Modify: `pages/carrier-billing.html`
- Modify: `pages/create-trip-plans.html`
- Modify: `pages/fc-dashboard.html`
- Modify: `pages/inventory-detail.html`
- Modify: `pages/inventory.html`
- Modify: `pages/resource-maintain.html`
- Modify: `pages/resources.html`
- Modify: `pages/trip-plan-detail.html`
- Modify: `pages/trip-plans.html`
- Delete: `supabase-config.example.js`
- Test: `tests/tms-frontend-contract.test.mjs`

- [ ] **Step 1: Replace the script chain in all ten pages**

For root pages use:

```html
<script src="./tms-config.js?v=tms-api-20260713"></script>
<script src="./scripts/tms-api.js?v=tms-api-20260713"></script>
```

For pages under `pages/` use:

```html
<script src="../tms-config.js?v=tms-api-20260713"></script>
<script src="../scripts/tms-api.js?v=tms-api-20260713"></script>
```

Keep map libraries, `map-config.js`, clocks, and page scripts in dependency-safe order. Replace visible `Checking Supabase` and setup text with `Connecting to TMS API` or module-specific neutral text.

- [ ] **Step 2: Remove the retired example**

Delete `supabase-config.example.js`. Keep `tms-config.example.js` as the only REST configuration example.

- [ ] **Step 3: Run the full JavaScript contract**

Run: `npm run test:js`

Expected: all JavaScript and frontend contract tests PASS with no retired active frontend references.

- [ ] **Step 4: Commit the HTML cutover**

```bash
git add appts.html pages supabase-config.example.js tms-config.example.js tests/tms-frontend-contract.test.mjs
git commit -m "refactor: cut pages over to tms api config"
```

## Task 6: Rename PostgreSQL Assets and Current Documentation

**Files:**

- Rename: `sql/supabase-*.sql` to `sql/postgres-*.sql`
- Modify: renamed SQL comments and policies where deployment-specific language is obsolete
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `CONTRIBUTING.md`
- Modify: `docs/CURRENT.md`
- Modify: `docs/PROJECT_STRUCTURE.md`
- Modify: `docs/TMS_ACCEPTANCE_CHECKLIST.md`
- Modify: other tracked docs returned by the retired-name scan
- Test: `tests/tms-frontend-contract.test.mjs`

- [ ] **Step 1: Add tracked-document naming assertions**

Extend the contract test to assert:

```js
assert.equal(sqlFiles.some((file) => basename(file).startsWith("supabase-")), false);
```

Allow the word `Supabase` only in an explicit legacy-history paragraph and the migration design/plan. Current setup instructions, file paths, service status, acceptance checks, and team rules must use PostgreSQL, PostgREST, TMS API, or TMS document service.

- [ ] **Step 2: Run the naming contract and verify red**

Run: `node --test tests/tms-frontend-contract.test.mjs`

Expected: FAIL listing the 13 historical SQL filenames and current documentation references.

- [ ] **Step 3: Rename SQL files and update references**

Rename every file by replacing the leading `supabase-` with `postgres-`. Update comments such as `Run in Supabase SQL Editor` to PostgreSQL `psql` instructions. Preserve PostgreSQL DDL, constraints, indexes, seed data, table names, PostgREST roles, and policy behavior required by the deployed database.

- [ ] **Step 4: Rewrite current operational documentation**

Document:

- PostgreSQL on VPS port 5433 is the active database.
- PostgREST on loopback 3000 is the REST service.
- TMS document service on loopback 3101 owns uploaded files.
- `tms-config.js` is local/runtime-only and contains generic API settings.
- Supabase is only the retired external backup and is not used by active code.
- `npm test`, `npm run backup:vps-db`, `npm run deploy:vps`, and `npm run check:vps` are the required validation/deployment commands.

- [ ] **Step 5: Run naming and full tests**

Run: `npm test`

Expected: all JavaScript, contract, and Python tests PASS.

- [ ] **Step 6: Commit the naming migration**

```bash
git add sql README.md AGENTS.md CONTRIBUTING.md docs tests/tms-frontend-contract.test.mjs
git commit -m "docs: retire supabase naming from active tms"
```

## Task 7: Add VPS Service and nginx Deployment Assets

**Files:**

- Create: `deploy/tms-documents.service`
- Create: `deploy/nginx-tms.conf.template`
- Create: `scripts/install-vps-services.sh`
- Modify: `scripts/deploy-vps.sh`
- Modify: `scripts/check-vps.sh`

- [ ] **Step 1: Add the systemd unit**

Create `deploy/tms-documents.service` with:

```ini
[Unit]
Description=TMS Document Service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
Environment=TMS_DOCUMENT_ROOT=/var/lib/tms/documents
Environment=TMS_DOCUMENT_HOST=127.0.0.1
Environment=TMS_DOCUMENT_PORT=3101
ExecStart=/usr/bin/python3 /opt/tms/server/tms-documents-server.py
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/tms/documents

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Add the nginx template**

Create the current port-80 TMS server block using `__TMS_SESSION_TOKEN__` as the only secret placeholder. Keep `/login.html` and `/auth/`. Protect `/rest/v1/`, `/documents/`, runtime configs, static assets, and `/` with the existing cookie check. Proxy `/documents/` to `http://127.0.0.1:3101` with a 20 MiB request limit. Do not add a `listen 443` directive.

- [ ] **Step 3: Add the idempotent installer**

`scripts/install-vps-services.sh` must run on the VPS as root and:

- Read `/etc/tms/tms-login-session-token` without printing it.
- Install the server file under `/opt/tms/server` with root ownership and mode 0755/0644.
- Create `/var/lib/tms/documents` owned by `www-data:www-data` with mode 0750.
- Install the systemd unit and render nginx config using escaped token replacement.
- Run `systemctl daemon-reload`, `nginx -t`, enable/restart `tms-documents`, and reload nginx.
- Fail on missing token, empty token, service failure, or nginx validation failure.

- [ ] **Step 4: Update release deployment**

Update `scripts/deploy-vps.sh` to include `tms-config.js`, `scripts/tms-api.js`, and deployment assets where appropriate; stop preserving `supabase-config.js`. Before switching `/var/www/tms/current`, upload server/deploy assets to a temporary VPS staging directory and invoke the installer. Preserve the prior release path and restore it if post-switch health checks fail.

- [ ] **Step 5: Expand VPS health checks**

Update `scripts/check-vps.sh` to assert:

- `tms-documents` is active.
- `127.0.0.1:3101` is listening and no wildcard/public 3101 listener exists.
- Anonymous `/documents/files/missing.pdf` redirects to login.
- An authenticated tiny PDF uploads successfully.
- The returned file URL downloads bytes identical to the uploaded file.
- DELETE returns 204 and the next GET returns 404.
- DERP remains active on TCP 443 and UDP 3478.

Use temporary files and a cookie jar with a shell trap so checks leave no test document behind.

- [ ] **Step 6: Verify scripts without changing the VPS**

Run: `bash -n scripts/deploy-vps.sh scripts/install-vps-services.sh scripts/check-vps.sh`

Expected: exit 0.

Run: `DRY_RUN=1 npm run deploy:vps`

Expected: release file list includes TMS API assets and excludes secrets, uploads, `.git`, `outputs`, and local task handoffs; no release symlink changes.

- [ ] **Step 7: Commit deployment assets**

```bash
git add deploy server scripts/deploy-vps.sh scripts/install-vps-services.sh scripts/check-vps.sh
git commit -m "chore: deploy tms document service"
```

## Task 8: Local Verification and Browser Smoke Test

**Files:**

- Modify only files required by failures found in this task

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: all Node and Python tests PASS with zero failures.

- [ ] **Step 2: Run static syntax checks**

Run: `node --check scripts/tms-api.js`

Expected: exit 0.

Run `node --check` separately for each of the ten migrated browser scripts.

Expected: every command exits 0.

- [ ] **Step 3: Start the local development server**

Run: `npm run dev`

Expected: server reports `http://127.0.0.1:5173/` and remains running for smoke tests.

- [ ] **Step 4: Perform browser smoke checks**

Open the home page and all ten data-backed pages. Verify no JavaScript load-order or undefined-`TmsApi` errors occur. Confirm the Appointment page can enter local IndexedDB mode when no local API is configured. Confirm Trip Plan Detail renders a clear document-service error if upload is attempted without a reachable service.

- [ ] **Step 5: Stop the local server and commit any verified fixes**

If smoke checks required code changes, rerun `npm test`, stage only those files, and commit:

```bash
git commit -m "fix: resolve tms api smoke test issues"
```

If no files changed, do not create an empty commit.

## Task 9: VPS Backup, Cutover, and End-to-End Verification

**Files:**

- Modify only files required by deployment failures found in this task

- [ ] **Step 1: Confirm a clean deployable Git state**

Run: `git status --short --branch`

Expected: only intentionally ignored local runtime files are absent from output; tracked worktree is clean.

- [ ] **Step 2: Create a fresh database backup**

Run: `npm run backup:vps-db`

Expected: a new PostgreSQL custom-format dump appears under ignored `outputs/backups/` and the command exits 0.

- [ ] **Step 3: Capture VPS rollback state**

Record `/var/www/tms/current` target and copy active nginx TMS config plus TMS systemd units into a timestamped root-only directory under `/var/backups/tms/`. Do not print secret file contents.

- [ ] **Step 4: Deploy the direct cutover**

Run: `npm run deploy:vps`

Expected: document service installation, nginx validation, release switch, service restart, and nginx reload all succeed.

- [ ] **Step 5: Run the expanded VPS check**

Run: `npm run check:vps`

Expected: all services active; PostgREST on loopback 3000; document service on loopback 3101; DERP on 443/3478; authenticated REST and document lifecycle checks pass; appointments remain 299 and FCs remain 212 unless live data has legitimately changed.

- [ ] **Step 6: Perform public browser acceptance**

Open `http://tms.zefanlong.space`, sign in, and verify:

- Appointment list, filters, map, and persistence load without Supabase text.
- Trip Plans, Resources, Carrier Billing, Inventory, and FC dashboard load data.
- Uploading an allowed POD succeeds and View/Download uses `/documents/files/...`.
- An unsupported file is rejected with a useful message.
- Logging out prevents access to the uploaded file URL.
- `https://tms.zefanlong.space` is not used for TMS and DERP remains the HTTPS service.

- [ ] **Step 7: Roll back on failure or finalize on success**

If verification fails, restore the previous static symlink and nginx config, reload nginx, and stop the new document service only if it caused the failure. Do not restore PostgreSQL because the cutover has no schema mutation.

If verification succeeds, run `git status --short --branch` and commit any deployment-derived tracked fixes only after rerunning `npm test` and `npm run check:vps`.

## Task 10: Final Repository and Remote Integration

**Files:**

- Modify: `docs/CURRENT.md` only if final runtime details differ from the planned architecture

- [ ] **Step 1: Run final evidence checks**

Run:

```bash
npm test
npm run check:vps
git diff --check
git status --short --branch
```

Expected: tests and VPS checks exit 0, diff check is clean, and no secret/runtime file is staged.

- [ ] **Step 2: Verify retired active references**

Run `rg` across active HTML, JavaScript, SQL filenames, current docs, deployment scripts, and configuration examples for the retired Supabase identifiers.

Expected: references remain only in the approved migration-history design/plan or explicit legacy-backup paragraph, never in active configuration, application code, UI copy, SQL filenames, or deployment behavior.

- [ ] **Step 3: Push the completed main branch**

Run: `git push origin main`

Expected: remote `main` advances to the verified local commit without force push.
