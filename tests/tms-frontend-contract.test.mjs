import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
