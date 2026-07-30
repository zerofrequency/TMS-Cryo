import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const exporterPath = new URL("../scripts/fc-poster-export.js", import.meta.url);

async function loadExporter() {
  const source = await readFile(exporterPath, "utf8");
  const window = {};
  vm.runInNewContext(source, { console, window }, { filename: exporterPath.pathname });
  return window.FcPosterExport;
}

test("builds poster groups from FCs with a weekly status", async () => {
  const exporter = await loadExporter();
  const model = exporter.buildPosterModel([
    { fc: "LGB6", state: "CA-S", zip: "92518", latitude: 33.9, longitude: -117.2, appointment_status: "Severely Full" },
    { fc: "SCK4", state: "CA-N", zip: "95206", latitude: 37.9, longitude: -121.3, appointment_status: "Very Busy" },
    { fc: "DEN8", state: "CO", latitude: 39.7, longitude: -104.7, appointment_status: "Slightly Busy" },
    { fc: "EMPTY", state: "TX", latitude: 32.7, longitude: -96.8, appointment_status: "" },
  ], "2026-07-27", new Date("2026-07-30T12:00:00-07:00"));

  assert.equal(model.width, 1085);
  assert.equal(model.height, 1450);
  assert.equal(model.total, 3);
  assert.deepEqual(Array.from(model.groups, (group) => group.key), ["CA-N", "CA-S", "CO"]);
  assert.equal(model.dateLabel, "7/30");
  assert.equal(model.fileName, "amazon-appointment-status-2026-07-30.png");
});

test("sorts FCs by severity and rejects unsupported statuses", async () => {
  const exporter = await loadExporter();
  const model = exporter.buildPosterModel([
    { fc: "SNA4", state: "CA-S", zip: "92376", latitude: 34, longitude: -117, appointment_status: "Very Busy" },
    { fc: "LGB6", state: "CA-S", zip: "92518", latitude: 34.1, longitude: -117.2, appointment_status: "Severely Full" },
    { fc: "POC1", state: "CA-S", zip: "91761", latitude: 34.05, longitude: -117.6, appointment_status: "Slightly Busy" },
    { fc: "BAD", state: "CA-S", latitude: 34, longitude: -117, appointment_status: "Unknown" },
  ], "2026-07-27", new Date("2026-07-30T12:00:00-07:00"));

  assert.deepEqual(
    Array.from(model.groups[0].items, (item) => item.fc),
    ["LGB6", "SNA4", "POC1"],
  );
  assert.equal(model.groups[0].status, "Severely Full");
});

test("groups an unlocated LAX FC into the SoCal callout without inventing coordinates", async () => {
  const exporter = await loadExporter();
  const model = exporter.buildPosterModel([
    { fc: "LAX6", state: null, zip: null, latitude: null, longitude: null, appointment_status: "Severely Full" },
  ], "2026-07-27", new Date("2026-07-30T12:00:00-07:00"));

  assert.equal(model.groups[0].key, "CA-S");
  assert.equal(model.groups[0].items[0].fc, "LAX6");
});

test("positions poster callouts around markers using the web map directions", async () => {
  const exporter = await loadExporter();
  const group = {
    key: "TX",
    label: "TX",
    latitude: 31,
    longitude: -99,
    status: "Severely Full",
    items: [{ fc: "FTW5", status: "Severely Full" }],
  };
  const [placement] = exporter.layoutCallouts([group], {
    project() {
      return { x: 500, y: 650 };
    },
  });
  const cardCenterX = placement.card.x + placement.card.width / 2;
  const cardCenterY = placement.card.y + placement.card.height / 2;

  assert.ok(cardCenterX > placement.marker.x, "TX label should sit east of its marker");
  assert.ok(cardCenterY > placement.marker.y, "TX label should sit south of its marker");
});

test("keeps poster labels clear of other map markers", async () => {
  const exporter = await loadExporter();
  const groups = [
    {
      key: "TX",
      label: "TX",
      latitude: 31,
      longitude: -99,
      status: "Severely Full",
      items: [{ fc: "FTW5", status: "Severely Full" }],
    },
    {
      key: "MO",
      label: "MO",
      latitude: 38,
      longitude: -93,
      status: "Slightly Busy",
      items: [{ fc: "STL3", status: "Slightly Busy" }],
    },
  ];
  const placements = exporter.layoutCallouts(groups, {
    project(longitude) {
      return longitude === -99 ? { x: 500, y: 650 } : { x: 540, y: 700 };
    },
  });

  placements.forEach(({ card }, cardIndex) => {
    placements.forEach(({ marker }, markerIndex) => {
      const overlaps = marker.x >= card.x - 8
        && marker.x <= card.x + card.width + 8
        && marker.y >= card.y - 8
        && marker.y <= card.y + card.height + 8;
      assert.equal(overlaps, false, `label ${cardIndex} overlaps marker ${markerIndex}`);
    });
  });
});

test("keeps edge-constrained labels clear of their own markers", async () => {
  const exporter = await loadExporter();
  const group = {
    key: "WA",
    label: "WA",
    latitude: 47,
    longitude: -117,
    status: "Severely Full",
    items: [{ fc: "GEG2", status: "Severely Full" }],
  };
  const [placement] = exporter.layoutCallouts([group], {
    project() {
      return { x: 267, y: 482 };
    },
  });
  const { card, marker } = placement;
  const overlaps = marker.x >= card.x - 8
    && marker.x <= card.x + card.width + 8
    && marker.y >= card.y - 8
    && marker.y <= card.y + card.height + 8;

  assert.equal(overlaps, false);
});

test("uses compact web-style label widths and only splits after nine FCs", async () => {
  const exporter = await loadExporter();
  const makeGroup = (key, count) => ({
    key,
    label: key,
    latitude: 35,
    longitude: -100 + count,
    status: "Very Busy",
    items: Array.from({ length: count }, (_, index) => ({
      fc: `${key}${index}`,
      status: "Very Busy",
    })),
  });
  const placements = exporter.layoutCallouts([
    makeGroup("CA-N", 6),
    makeGroup("CA-S", 13),
  ], {
    project(longitude) {
      return longitude === -94 ? { x: 240, y: 560 } : { x: 700, y: 720 };
    },
  });

  assert.equal(placements[0].card.width, 128);
  assert.equal(placements[1].card.width, 208);
  assert.ok(placements[0].card.height > placements[1].card.height / 2);
});

test("Hot FC page loads the HD poster exporter before dashboard code", async () => {
  const html = await readFile(new URL("../pages/fc-dashboard.html", import.meta.url), "utf8");
  const exporterIndex = html.indexOf("../scripts/fc-poster-export.js");
  const dashboardIndex = html.indexOf("../scripts/fc-dashboard.js");
  const template = await stat(new URL("../assets/posters/hye-amazon-appointment-template.jpg", import.meta.url));

  assert.match(html, /id="exportPosterButton"/);
  assert.ok(exporterIndex >= 0);
  assert.ok(dashboardIndex > exporterIndex);
  assert.match(html, /fc-poster-export\.js\?v=fc-poster-\d+/);
  assert.match(html, /fc-dashboard\.js\?v=fc-poster-\d+/);
  assert.ok(template.size > 100_000);
});

test("VPS deployment includes poster assets", async () => {
  const deployScript = await readFile(new URL("../scripts/deploy-vps.sh", import.meta.url), "utf8");
  const healthCheck = await readFile(new URL("../scripts/check-vps.sh", import.meta.url), "utf8");

  assert.match(deployScript, /--include=\/assets\//);
  assert.match(deployScript, /--include=\/assets\/\*\*\*/);
  assert.match(healthCheck, /assets\/posters\/hye-amazon-appointment-template\.jpg/);
});
