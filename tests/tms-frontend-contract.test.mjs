import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { basename } from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);

const pageContracts = [
  ["appts.html", "./scripts/appointments.js"],
  ["pages/carrier-billing.html", "../scripts/carrier-billing.js"],
  ["pages/create-trip-plans.html", "../scripts/trip-plans.js"],
  ["pages/fc-dashboard.html", "../scripts/fc-dashboard.js"],
  ["pages/inventory-detail.html", "../scripts/inventory-detail.js"],
  ["pages/inventory.html", "../scripts/inventory.js"],
  ["pages/resource-maintain.html", "../scripts/resource-maintain.js"],
  ["pages/resources.html", "../scripts/resources.js"],
  ["pages/trip-plan-detail.html", "../scripts/trip-plan-detail.js"],
  ["pages/trip-plans.html", "../scripts/trip-plans-list.js"],
];

const scriptFiles = [
  "scripts/appointments.js",
  "scripts/carrier-billing.js",
  "scripts/fc-dashboard.js",
  "scripts/inventory-detail.js",
  "scripts/inventory.js",
  "scripts/resource-maintain.js",
  "scripts/resources.js",
  "scripts/trip-plan-detail.js",
  "scripts/trip-plans-list.js",
  "scripts/trip-plans.js",
];

const retiredPatterns = [
  "supabase-config.js",
  "CARRIER_APPT_SUPABASE",
  "state.supabase",
  "loadSupabaseConfig",
  "supabaseRequest",
  "/storage/v1/",
];

const currentDocs = [
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "docs/CURRENT.md",
  "docs/PROJECT_STRUCTURE.md",
  "docs/TMS_ACCEPTANCE_CHECKLIST.md",
  "docs/LOCAL_DEV_SERVER_GUIDE.md",
  "docs/TASK_HANDOFF_PROCESS.md",
  "docs/TEAM_ROLES.md",
  "docs/FRONTEND_BACKEND_SEPARATION_PREP.md",
];

const retiredOperationalPatterns = [
  "supabase-config.js",
  "supabase-config.example.js",
  "CARRIER_APPT_SUPABASE",
  "sql/supabase-",
  "Browser directly writes to Supabase",
  "browser scripts call Supabase directly",
];

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("data-backed pages load config and shared API before page code", async () => {
  for (const [pagePath, pageScript] of pageContracts) {
    const html = await source(pagePath);
    const prefix = pagePath.startsWith("pages/") ? "../" : "./";
    const configIndex = html.indexOf(`${prefix}tms-config.js`);
    const apiIndex = html.indexOf(`${prefix}scripts/tms-api.js`);
    const pageIndex = html.indexOf(pageScript);

    assert.ok(configIndex >= 0, `${pagePath} must load tms-config.js`);
    assert.ok(apiIndex > configIndex, `${pagePath} must load tms-api.js after config`);
    assert.ok(pageIndex > apiIndex, `${pagePath} must load page code after tms-api.js`);
  }
});

test("active frontend has no retired Supabase integration identifiers", async () => {
  for (const path of [...pageContracts.map(([page]) => page), ...scriptFiles]) {
    const content = await source(path);
    for (const pattern of retiredPatterns) {
      assert.equal(content.includes(pattern), false, `${path} contains ${pattern}`);
    }
  }
});

test("PostgreSQL assets and current docs use active TMS naming", async () => {
  const sqlFiles = await readdir(new URL("sql/", root));
  assert.equal(
    sqlFiles.some((file) => basename(file).startsWith("supabase-")),
    false,
    "SQL filenames must use the postgres- prefix",
  );

  for (const path of currentDocs) {
    const content = await source(path);
    for (const pattern of retiredOperationalPatterns) {
      assert.equal(content.includes(pattern), false, `${path} contains ${pattern}`);
    }
  }
});

test("VPS listener checks do not fail under pipefail when grep exits early", async () => {
  const content = await source("scripts/check-vps.sh");

  assert.match(content, /tcp_listeners="\$\(ss -ltnp\)"/);
  assert.match(content, /udp_listeners="\$\(ss -lunp\)"/);
  assert.doesNotMatch(content, /ss -ltnp \| grep -q/);
  assert.doesNotMatch(content, /ss -lunp \| grep -q/);
});

test("VPS listener checks can skip DERP requirements for non-DERP targets", async () => {
  const content = await source("scripts/check-vps.sh");

  assert.match(content, /EXPECT_DERP="\$\{EXPECT_DERP:-0\}"/);
  assert.match(content, /systemctl is-active derper/);
  assert.match(content, /if \[\[ "\$EXPECT_DERP" == "1" \]\]/);
  assert.match(content, /DERP TCP 443 listener is missing/);
  assert.match(content, /DERP UDP 3478 listener is missing/);
});

test("VPS operational scripts default to the current vps-ca deployment", async () => {
  for (const path of ["scripts/deploy-vps.sh", "scripts/check-vps.sh", "scripts/backup-vps-db.sh"]) {
    const content = await source(path);
    assert.match(content, /SSH_HOST="\$\{SSH_HOST:-vps-ca\}"/, `${path} must default to vps-ca`);
  }
});

test("VPS deploy replaces a restored current directory with the release symlink", async () => {
  const content = await source("scripts/deploy-vps.sh");

  assert.match(content, /if \[\[ -d "\$current_link" && ! -L "\$current_link" \]\]/);
  assert.match(content, /rm -rf "\$current_link"/);
  assert.match(content, /ln -sfn '\$REMOTE_RELEASE' '\$REMOTE_CURRENT'/);
});

test("VPS health check asserts login and authenticated home status codes", async () => {
  const content = await source("scripts/check-vps.sh");

  assert.match(content, /login_status="\$\(curl/);
  assert.match(content, /\[\[ "\$login_status" == "200" \]\]/);
  assert.match(content, /home_status="\$\(curl/);
  assert.match(content, /\[\[ "\$home_status" == "200" \]\]/);
});
