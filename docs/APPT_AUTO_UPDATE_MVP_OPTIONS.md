# Appt Auto Update MVP Options

This document defines practical MVP options for automatically updating Appt data from Amazon Carrier Central while avoiding unsafe credential storage.

## Goal

Update TMS appointments with Carrier Central fields that are missing or incomplete in the normal export, especially:

- Load Type
- Trailer Number
- Carrier SCAC
- Updated status and schedule fields

## Hard Constraint

Do not store Amazon Carrier Central username/password in project JavaScript, local config committed to Git, or browser-exposed code.

MVP automation should rely on a user-controlled authenticated browser session.

## Recommended MVP Option

### Option A: Assisted Auto Update Through Tampermonkey Export

This is the safest and fastest MVP approach.

Flow:

```text
User logs into Carrier Central manually
  -> Opens appointment list page
  -> Tampermonkey collector extracts appointment details
  -> Collector exports CSV/JSON with Load Type / Trailer / SCAC
  -> User uploads the file into Appt
  -> Appt merges records by ISA
```

Why this is recommended:

- Uses existing browser login session.
- No password storage.
- No backend required.
- Works with the current static HTML + TMS API app.
- Lowest implementation risk.

Limitations:

- User still performs export/upload.
- Carrier Central DOM changes can break parsing.
- Not true background sync.

Best use:

- MVP demo.
- Daily or manual operations update.
- Validating whether Load Type automation is useful before investing in backend integration.

## Option B: Local Browser Collector With Manual Login

This is a more automated local workflow, still safe if credentials are not stored.

Flow:

```text
User runs local collector
  -> Collector opens persistent Chrome profile
  -> User logs into Carrier Central manually when needed
  -> Collector uses session cookies from that local profile
  -> Collector exports CSV/JSON
  -> Collector either saves file or posts to local Appt import endpoint/future API
```

MVP implementation:

- Use a local Node.js or Playwright script.
- Use a persistent browser profile directory ignored by Git.
- Do not store username/password.
- Do not commit cookies or exported business data.
- Output a CSV compatible with Appt upload.

Pros:

- Less manual clicking than Tampermonkey.
- Can schedule local runs if the session remains valid.
- Still avoids password storage.

Cons:

- Requires local runtime setup.
- Session can expire.
- Carrier Central DOM changes can break parsing.
- More complex than Option A.

Best use:

- Internal operations machine.
- Semi-automated daily update.
- Bridge before a real enterprise integration.

## Option C: Browser Extension Later

Flow:

```text
User logs into Carrier Central
  -> Browser extension reads appointment pages using active session
  -> Extension sends normalized data to TMS import flow
```

Pros:

- Better user experience than Tampermonkey.
- Can add buttons, status, and direct import.

Cons:

- Requires extension packaging.
- Requires permission review.
- More engineering overhead.

Best use:

- After MVP proves value.

## Option D: Backend Integration Later

Only do this if there is an approved Amazon API or secure enterprise integration path.

Flow:

```text
Approved integration
  -> Backend worker
  -> Secure secret manager
  -> TMS API
  -> appointments table
```

Pros:

- True automation.
- Centralized logs and monitoring.
- Better enterprise control.

Cons:

- Requires backend architecture.
- Requires approved auth model.
- Not suitable for current static MVP.

Best use:

- Enterprise phase.

## Rejected MVP Option

Do not implement:

```text
JS script stores Amazon username/password
  -> automatically logs into Carrier Central
  -> keeps session alive
```

Reasons:

- Credential leakage risk.
- MFA/SSO incompatibility.
- Amazon risk controls may block automation.
- Current app has no secure secrets boundary.
- High compliance risk.

## Appt Import Requirements

Whichever collector is used, the output should map to Appt import fields:

```text
Destination FC
Appointment ID
Trailer Number
Appointment Reference Code
Load Type
Carrier Requested Delivery Date
Status
Scheduled Time
Carrier SCAC
```

Appt should:

- Merge by `Appointment ID` / ISA.
- Update Load Type when supplied.
- Update Trailer Number when supplied.
- Update Carrier SCAC if schema support exists.
- Preserve manual Notes.
- Avoid creating duplicate ISA records.

## Recommended MVP Roadmap

### Step 1: Repair Current Tampermonkey Collector

- Fix JavaScript syntax errors.
- Confirm it runs on Carrier Central.
- Confirm it exports Load Type, Trailer Number, and SCAC.
- Make CSV headers compatible with Appt importer.

### Step 2: Improve Appt Import Compatibility

- Confirm Appt imports the collector CSV.
- Add Carrier SCAC field support if product requires it.
- Confirm repeated imports update existing ISA records.

### Step 3: Add Guided Import UX

- Add instructions in Appt for Carrier Central enhanced export.
- Optionally add a separate upload label:

```text
Upload Carrier Central Enhanced CSV
```

### Step 4: Consider Local Browser Collector

Only after Step 1 and Step 2 are stable.

## Recommendation

For MVP, choose:

```text
Option A first: repaired Tampermonkey collector + Appt CSV merge
```

Then consider:

```text
Option B: local browser collector with persistent profile
```

Do not store Amazon credentials in scripts.
