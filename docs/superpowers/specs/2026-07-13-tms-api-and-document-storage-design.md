# TMS API and Document Storage Migration Design

Date: 2026-07-13

## Goal

Remove the remaining Supabase-specific frontend, configuration, storage, SQL, and documentation conventions from the active TMS MVP. Keep PostgreSQL and PostgREST as the business data backend, move uploaded POD files to VPS-local storage, and preserve the existing DERP service as the VPS's primary workload.

This is a direct cutover. The application will not retain a Supabase compatibility layer after deployment.

## Scope

The migration includes:

- Replace `supabase-config.js` with a generic `tms-config.js` configuration contract.
- Replace page-specific `state.supabase`, `loadSupabaseConfig()`, and `supabaseRequest()` implementations with a shared TMS API client.
- Replace user-facing Supabase status and error text with backend-neutral TMS API language.
- Replace Supabase Storage POD upload and public file URLs with an authenticated VPS document service.
- Rename active `supabase-*` SQL files to PostgreSQL-oriented names and update all tracked references.
- Track the document service source and service configuration in the repository.
- Update deployment, health checks, documentation, and tests for the new architecture.

The migration does not include:

- Replacing PostgREST with a custom business API.
- Reworking business rules or database schemas unrelated to document storage.
- Production-grade multi-user identity, authorization, or HTTPS for TMS.
- Moving, replacing, or reconfiguring DERP on TCP 443 or UDP 3478.
- Migrating files that do not exist in the current Supabase Storage bucket. Existing metadata rows without an accessible source file remain metadata-only records.

## Architecture

The deployed request flow will be:

```text
Browser
  -> nginx :80
     -> static TMS files
     -> /auth/*       -> tms-login.service       127.0.0.1:3100
     -> /rest/v1/*    -> tms-postgrest.service   127.0.0.1:3000
     -> /documents/*  -> tms-documents.service   127.0.0.1:3101

PostgREST -> PostgreSQL tms database on 127.0.0.1:5433
Document service -> /var/lib/tms/documents
DERP -> unchanged on TCP 443 and UDP 3478
```

nginx remains the public boundary. Static application files, REST requests, uploads, and downloads require the existing `tms_session` cookie. PostgREST and the document service remain reachable only through loopback interfaces.

## Frontend Configuration

All application pages will load `tms-config.js` followed by `scripts/tms-api.js` before their page-specific script.

The generic configuration contract is:

```js
window.TMS_CONFIG = {
  apiBaseUrl: "",
  apiToken: "",
  documentBaseUrl: "/documents",
};
```

An empty `apiBaseUrl` means same-origin. The API client appends `/rest/v1` for PostgREST requests. `apiToken` is optional and omitted on the VPS because nginx authenticates the browser with the login cookie and strips inbound authorization before proxying to PostgREST.

`tms-config.example.js` is tracked. The real `tms-config.js` remains ignored and is preserved between VPS releases. The deployment creates a same-origin default when no previous runtime config exists. No Supabase variable names or key aliases remain.

## Shared API Client

`scripts/tms-api.js` exposes one browser global, `window.TmsApi`, with these operations:

- `configure(config)` normalizes the runtime configuration.
- `isConfigured()` reports whether a usable same-origin or explicit API target exists.
- `request(path, options)` calls PostgREST and returns parsed JSON or an empty array for empty responses.
- `uploadDocument({ entityType, entityId, documentType, file })` uploads one document and returns its storage metadata.
- `documentUrl(storagePath)` returns the authenticated download URL for a stored file.

The client sends JSON headers for REST operations and adds `apikey` and bearer authorization only when an optional generic API token is configured. Errors use backend-neutral text and include the HTTP status.

Each page stores a generic `state.api` reference or calls `TmsApi` directly. Duplicate request helpers are removed. Existing PostgREST query strings and business behavior remain unchanged.

## Document Service

The repository will contain a small Python standard-library service dedicated to file operations. It runs as `www-data`, listens on `127.0.0.1:3101`, and writes only beneath `/var/lib/tms/documents`.

### Upload

The browser sends a raw file body to:

```text
PUT /documents/files
```

Required request headers:

- `X-TMS-Entity-Type: trip_plan`
- `X-TMS-Entity-Id: <UUID>`
- `X-TMS-Document-Type: pod`
- `X-TMS-File-Name: <URL-encoded original name>`
- `Content-Type: application/pdf | image/png | image/jpeg`

The service accepts PDF, PNG, JPG, and JPEG files up to 20 MiB. It validates the entity and document types, UUID format, declared MIME type, file extension, and leading file signature. It does not trust the supplied path or filename.

Each upload receives a server-generated UUID and is stored under a server-generated relative path:

```text
trip-plans/<trip-plan-uuid>/pod/<upload-uuid>.<extension>
```

The JSON response contains:

```json
{
  "storagePath": "trip-plans/<uuid>/pod/<uuid>.pdf",
  "fileName": "proof.pdf",
  "mimeType": "application/pdf",
  "size": 12345,
  "fileUrl": "/documents/files/trip-plans/<uuid>/pod/<uuid>.pdf"
}
```

After upload, the frontend replaces the prior active metadata row and inserts the new `business_documents` row through PostgREST. If metadata persistence fails, the frontend issues a best-effort delete for the newly uploaded file and reports the database error.

### Download

The browser reads:

```text
GET /documents/files/<storage-path>
```

The service resolves and verifies the requested path beneath its storage root, returns the stored MIME type, sets `X-Content-Type-Options: nosniff`, and uses a download-safe `Content-Disposition`. nginx enforces the login cookie before the request reaches the service.

### Delete

The browser may issue:

```text
DELETE /documents/files/<storage-path>
```

This endpoint exists only for upload rollback and future document replacement cleanup. It uses the same path containment checks. The first cutover will not automatically delete previously replaced files because metadata history still references them.

## Database Metadata

The existing `business_documents` table remains the source of truth for document metadata. No schema change is required for the cutover:

- `file_url` stores the authenticated `/documents/files/...` URL.
- `storage_path` stores the VPS-relative path.
- `mime_type`, `file_name`, `source`, and status fields retain their current meaning.

Generated BOL, loading-list, and invoice records continue to store generated payloads without requiring a physical file. Uploaded POD records use VPS storage.

## Deployment

The repository will track:

- Document service source.
- A systemd unit template for `tms-documents.service`.
- An nginx TMS site template without embedded session secrets.
- A provisioning or installation script that renders runtime secrets from `/etc/tms` on the VPS.

`scripts/deploy-vps.sh` will:

1. Publish the static release.
2. Preserve `tms-config.js` and `map-config.js`.
3. Install or update the document service source and systemd unit.
4. Ensure `/var/lib/tms/documents` exists with `www-data` ownership and non-public permissions.
5. Render and validate nginx configuration without exposing the session token in Git.
6. Restart the document service, reload nginx, and switch the static release symlink.

Deployment must fail before changing the release symlink when service installation or nginx validation fails. DERP units and listeners are never modified.

## SQL and Documentation Naming

Tracked SQL files with a `supabase-` prefix will be renamed to a `postgres-` prefix. Their content will be updated where comments, roles, or RLS instructions describe the former Supabase deployment. PostgreSQL-compatible schema behavior needed by PostgREST remains intact.

Current product and operational documentation will use these terms:

- PostgreSQL for the database.
- PostgREST for the REST data service.
- TMS API for frontend REST access.
- TMS document service for uploaded files.
- Supabase only when documenting the retired legacy backup or historical migration origin.

## Security Boundaries

- Public TMS traffic remains HTTP-only on port 80 during the MVP.
- DERP retains port 443 and is not proxied through TMS nginx configuration.
- PostgREST and document service listeners bind to `127.0.0.1` only.
- Uploads are limited to 20 MiB and validated by both extension and signature.
- Paths are generated by the server and checked against the storage root on every file operation.
- Runtime login/session secrets stay in `/etc/tms` and are never committed.
- The document service runs as `www-data`, not root.
- nginx requires the existing session cookie for REST, upload, download, and static application routes.

The existing single-user cookie remains an MVP limitation. It is not presented as production authentication.

## Testing

Automated tests will cover:

- TMS API configuration normalization and same-origin URL construction.
- Optional generic token headers and cookie-based requests without token headers.
- JSON, empty-body, and HTTP error handling.
- Document upload request construction and returned metadata.
- Document service MIME, extension, signature, UUID, size, and path validation.
- Successful upload, download, and rollback delete.
- Rejection of traversal paths and unsupported files.

VPS verification will cover:

- DERP, nginx, login, PostgREST, PostgreSQL, and document services are active.
- PostgREST listens only on `127.0.0.1:3000`.
- Document service listens only on `127.0.0.1:3101`.
- Anonymous static, REST, upload, and download requests redirect to login.
- Authenticated REST request succeeds.
- Authenticated test-file upload, download, content comparison, and delete succeed.
- Appointment and FC row counts remain unchanged after deployment.

## Cutover and Rollback

Before deployment:

1. Create a fresh PostgreSQL backup.
2. Record the current static release symlink.
3. Copy the active nginx site and service files to a timestamped VPS backup directory.

Cutover is complete only when the full VPS check passes. If it fails, restore the previous static release symlink and nginx configuration, stop the new document service if necessary, and leave PostgreSQL data untouched.

The old Supabase project remains an external legacy backup, but the active TMS code and VPS deployment no longer read from or write to it.

## Acceptance Criteria

- No active HTML or JavaScript file loads or references `supabase-config.js`.
- No active frontend code contains `state.supabase`, `loadSupabaseConfig`, or `supabaseRequest`.
- No user-facing application message describes the active backend as Supabase.
- All existing PostgREST-backed modules load and save through the shared TMS API client.
- POD upload, authenticated viewing, downloading, and metadata persistence work on the VPS.
- No TMS process newly listens on a public port other than nginx port 80.
- DERP remains active and retains TCP 443 and UDP 3478.
- Automated tests and the expanded VPS health check pass.
- Git contains no runtime API token, login password, session token, or uploaded document.
