const DB_NAME = "carrier-appt-manager";
const DB_VERSION = 1;
const RECORD_STORE = "appointments";
const APPOINTMENTS_TABLE = "appointments";
const TRIP_TABLE = "trip_plans";
const FC_TABLE = "fba_fcs";
const FC_ROUTE_CACHE_TABLE = "fba_fc_route_cache";
const MAPBOX_DAILY_LIMIT = 1000;
const MAPBOX_USAGE_STORAGE_KEY = "tms-mapbox-map-load-usage";
const SOUTHERN_CALIFORNIA_CAMERA = { center: [-117.66, 34.02], zoom: 8.4, pitch: 52, bearing: -18 };
const CONTINENTAL_US_CAMERA = { center: [-98.5795, 39.8283], zoom: 3.25, pitch: 0, bearing: 0 };

const state = {
  records: [],
  lastImportChanges: [],
  apiEnabled: false,
  selectedKey: null,
  viewMode: "table",
  timelineAutoScrollPending: false,
  calendarDate: startOfDay(new Date()),
  calendarSubview: "week",
  timeDisplayMode: "appointment",
  sortKey: "scheduleTime",
  sortDirection: "asc",
  filters: {
    search: "",
    fc: "",
    status: "",
    loadType: "",
    from: "",
    to: "",
  },
  tripPlansByIsa: new Map(),
  fcsByCode: new Map(),
  map: {
    instance: null,
    initialized: false,
    initializing: false,
    markers: new Map(),
    selectedFc: "",
    providerError: "",
  },
};

const TRIP_PLAN_EXECUTION_STATUSES = ["Planned", "Scheduled", "Pending", "Loading", "In Transit", "Delivered"];
const TRIP_PLAN_CONTROL_STATUSES = ["Active", "At Risk", "Cancelled", "Locked"];
const ETD_PERIODS = {
  "00-03": { label: "00:00-03:00" },
  "03-06": { label: "03:00-06:00" },
  "06-09": { label: "06:00-09:00" },
  "09-12": { label: "09:00-12:00" },
  "12-15": { label: "12:00-15:00" },
  "15-18": { label: "15:00-18:00" },
  "18-21": { label: "18:00-21:00" },
  "21-24": { label: "21:00-24:00" },
  AM: { label: "AM" },
  PM: { label: "PM" },
};

const LOAD_TYPES = [
  { value: "Floorload", label: "Floorload", className: "floorload" },
  { value: "Palletized", label: "Palletized", className: "palletized" },
];
const LOAD_TYPE_VALUES = LOAD_TYPES.map((type) => type.value);

const els = {
  fileInput: document.getElementById("fileInput"),
  addManualButton: document.getElementById("addManualButton"),
  exportButton: document.getElementById("exportButton"),
  searchInput: document.getElementById("searchInput"),
  fcFilter: document.getElementById("fcFilter"),
  statusFilter: document.getElementById("statusFilter"),
  loadTypeFilter: document.getElementById("loadTypeFilter"),
  fromDate: document.getElementById("fromDate"),
  toDate: document.getElementById("toDate"),
  clearFilters: document.getElementById("clearFilters"),
  totalCount: document.getElementById("totalCount"),
  upcomingCount: document.getElementById("upcomingCount"),
  todayCount: document.getElementById("todayCount"),
  issueCount: document.getElementById("issueCount"),
  resultCount: document.getElementById("resultCount"),
  importStatus: document.getElementById("importStatus"),
  tableViewButton: document.getElementById("tableViewButton"),
  calendarViewButton: document.getElementById("calendarViewButton"),
  timelineViewButton: document.getElementById("timelineViewButton"),
  mapViewButton: document.getElementById("mapViewButton"),
  appointmentTimeViewButton: document.getElementById("appointmentTimeViewButton"),
  latestDepartureViewButton: document.getElementById("latestDepartureViewButton"),
  soloSafeTransitViewButton: document.getElementById("soloSafeTransitViewButton"),
  tableView: document.getElementById("tableView"),
  calendarView: document.getElementById("calendarView"),
  timelineView: document.getElementById("timelineView"),
  mapView: document.getElementById("mapView"),
  mapResultCount: document.getElementById("mapResultCount"),
  mapSouthernCaliforniaButton: document.getElementById("mapSouthernCaliforniaButton"),
  mapProviderMessage: document.getElementById("mapProviderMessage"),
  appointmentMapCanvas: document.getElementById("appointmentMapCanvas"),
  mapSelectedSummary: document.getElementById("mapSelectedSummary"),
  mapMissingCoordinates: document.getElementById("mapMissingCoordinates"),
  prevMonthButton: document.getElementById("prevMonthButton"),
  nextMonthButton: document.getElementById("nextMonthButton"),
  todayCalendarButton: document.getElementById("todayCalendarButton"),
  exportWeekImageButton: document.getElementById("exportWeekImageButton"),
  calendarTitle: document.getElementById("calendarTitle"),
  calendarGrid: document.getElementById("calendarGrid"),
  calendarSubviewButtons: document.querySelectorAll("[data-calendar-subview]"),
  appointmentRows: document.getElementById("appointmentRows"),
  scheduleColumnHeader: document.getElementById("scheduleColumnHeader"),
  laTimeColumnHeader: document.getElementById("laTimeColumnHeader"),
  emptyState: document.getElementById("emptyState"),
  detailEmpty: document.getElementById("detailEmpty"),
  detailForm: document.getElementById("detailForm"),
  detailFc: document.getElementById("detailFc"),
  detailId: document.getElementById("detailId"),
  deleteRecord: document.getElementById("deleteRecord"),
  detailStatus: document.getElementById("detailStatus"),
  detailLoadType: document.getElementById("detailLoadType"),
  detailCrdd: document.getElementById("detailCrdd"),
  detailSchedule: document.getElementById("detailSchedule"),
  detailNotes: document.getElementById("detailNotes"),
  detailReference: document.getElementById("detailReference"),
  detailTrailer: document.getElementById("detailTrailer"),
  detailSource: document.getElementById("detailSource"),
  detailUpdated: document.getElementById("detailUpdated"),
  detailTripPlan: document.getElementById("detailTripPlan"),
  detailTripPlanSummary: document.getElementById("detailTripPlanSummary"),
  detailChangeLog: document.getElementById("detailChangeLog"),
  manualPanel: document.getElementById("manualPanel"),
  closeManualButton: document.getElementById("closeManualButton"),
  saveManualButton: document.getElementById("saveManualButton"),
  manualIsa: document.getElementById("manualIsa"),
  manualFc: document.getElementById("manualFc"),
  manualStatus: document.getElementById("manualStatus"),
  manualSchedule: document.getElementById("manualSchedule"),
  manualCrdd: document.getElementById("manualCrdd"),
  manualLoadType: document.getElementById("manualLoadType"),
  manualReference: document.getElementById("manualReference"),
  manualTrailer: document.getElementById("manualTrailer"),
  importSummaryModal: document.getElementById("importSummaryModal"),
  importSummarySubtitle: document.getElementById("importSummarySubtitle"),
  importSummaryBody: document.getElementById("importSummaryBody"),
  closeImportSummaryButton: document.getElementById("closeImportSummaryButton"),
  dismissImportSummaryButton: document.getElementById("dismissImportSummaryButton"),
};

async function boot() {
  renderLoadTypeOptions(els.detailLoadType, "Unassigned");
  renderLoadTypeOptions(els.manualLoadType, "Unassigned");
  loadApiConfig();
  await loadRecords();
  bindEvents();
  render();
}

function bindEvents() {
  els.fileInput.addEventListener("change", handleFileUpload);
  els.addManualButton.addEventListener("click", openManualPanel);
  els.closeManualButton.addEventListener("click", closeManualPanel);
  els.saveManualButton.addEventListener("click", saveManualRecord);
  els.manualPanel.addEventListener("click", (event) => {
    if (event.target === els.manualPanel) {
      closeManualPanel();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.manualPanel.classList.contains("hidden")) {
      closeManualPanel();
    }
    if (event.key === "Escape" && !els.importSummaryModal.classList.contains("hidden")) {
      closeImportSummaryModal();
    }
  });
  els.importSummaryModal.addEventListener("click", (event) => {
    if (event.target === els.importSummaryModal) closeImportSummaryModal();
  });
  els.closeImportSummaryButton.addEventListener("click", closeImportSummaryModal);
  els.dismissImportSummaryButton.addEventListener("click", closeImportSummaryModal);
  els.exportButton.addEventListener("click", exportCsv);
  els.tableViewButton.addEventListener("click", () => setViewMode("table"));
  els.calendarViewButton.addEventListener("click", () => setViewMode("calendar"));
  els.timelineViewButton.addEventListener("click", () => setViewMode("timeline"));
  els.mapViewButton.addEventListener("click", () => setViewMode("map"));
  els.mapSouthernCaliforniaButton.addEventListener("click", flyMapToSouthernCalifornia);
  els.appointmentTimeViewButton.addEventListener("click", () => setTimeDisplayMode("appointment"));
  els.latestDepartureViewButton.addEventListener("click", () => setTimeDisplayMode("latestDeparture"));
  els.soloSafeTransitViewButton.addEventListener("click", () => setTimeDisplayMode("soloSafeTransit"));
  els.prevMonthButton.addEventListener("click", () => shiftCalendarPeriod(-1));
  els.nextMonthButton.addEventListener("click", () => shiftCalendarPeriod(1));
  els.todayCalendarButton.addEventListener("click", () => jumpCalendarToToday());
  els.exportWeekImageButton.addEventListener("click", exportWeekImage);
  els.calendarSubviewButtons.forEach((button) => {
    button.addEventListener("click", () => setCalendarSubview(button.dataset.calendarSubview));
  });
  els.searchInput.addEventListener("input", (event) => setFilter("search", event.target.value));
  els.fcFilter.addEventListener("change", (event) => setFilter("fc", event.target.value));
  els.statusFilter.addEventListener("change", (event) => setFilter("status", event.target.value));
  els.loadTypeFilter.addEventListener("change", (event) => setFilter("loadType", event.target.value));
  els.fromDate.addEventListener("change", (event) => setFilter("from", event.target.value));
  els.toDate.addEventListener("change", (event) => setFilter("to", event.target.value));
  els.clearFilters.addEventListener("click", clearFilters);
  els.deleteRecord.addEventListener("click", deleteSelectedRecord);

  document.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) {
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = key;
        state.sortDirection = "asc";
      }
      render();
    });
  });

  [
    ["status", els.detailStatus],
    ["loadType", els.detailLoadType],
    ["crdd", els.detailCrdd],
    ["scheduleTime", els.detailSchedule],
    ["notes", els.detailNotes],
  ].forEach(([field, input]) => {
    input.addEventListener("change", () => updateSelectedRecord(field, input.value));
  });
}

async function loadRecords() {
  if (state.apiEnabled) {
    try {
      const [records, tripPlansByIsa, fcsByCode] = await Promise.all([
        loadRecordsFromApi(),
        loadTripPlansByIsa(),
        loadFcsByCode(),
      ]);
      state.records = records;
      state.tripPlansByIsa = tripPlansByIsa;
      state.fcsByCode = fcsByCode;
      await saveRecordsToDb(state.records);
      setImportStatus("Loaded from TMS API. Changes are synced to the server.");
      updateCloudStatus("Connected");
      return;
    } catch (error) {
      console.error("TMS API load failed.", error);
      setImportStatus(`TMS API load failed: ${error.message}. Loaded local backup instead.`);
      updateCloudStatus("Cloud error");
    }
  }

  try {
    state.records = await loadRecordsFromDb();
    setImportStatus("Loaded from local IndexedDB. Configure the TMS API for server sync.");
  } catch (error) {
    console.error("IndexedDB unavailable.", error);
    state.records = [];
    setImportStatus("IndexedDB is unavailable in this browser. Records cannot be saved.");
  }
}

async function saveRecords() {
  if (state.apiEnabled) {
    try {
      await upsertRecordsToApi(state.records);
      await saveRecordsToDb(state.records);
      setImportStatus("Saved to TMS API.");
      updateCloudStatus("Connected");
      return;
    } catch (error) {
      console.error("TMS API save failed.", error);
      setImportStatus(`TMS API save failed: ${error.message}. Saved local backup only.`);
      updateCloudStatus("Cloud error");
    }
  }

  try {
    await saveRecordsToDb(state.records);
    setImportStatus("Saved to local IndexedDB.");
  } catch (error) {
    console.error("IndexedDB save failed.", error);
    setImportStatus("Save failed: IndexedDB is unavailable.");
  }
}

function loadApiConfig() {
  state.apiEnabled = Boolean(window.TmsApi && window.TmsApi.isConfigured());
  updateCloudStatus(state.apiEnabled ? "Configured from file" : "Local mode");
}

async function syncApiNow() {
  if (!state.apiEnabled) return;

  try {
    setImportStatus("Syncing with TMS API...");
    const remoteRecords = await loadRecordsFromApi();
    const remoteResult = mergeRecords(remoteRecords);
    await upsertRecordsToApi(state.records);
    await saveRecordsToDb(state.records);
    state.lastImportChanges = remoteResult.changes;
    setImportStatus(`Synced with TMS API. Pulled ${remoteResult.added} new, updated ${remoteResult.updated}.`);
    updateCloudStatus("Connected");
    render();
  } catch (error) {
    console.error(error);
    setImportStatus(`TMS API sync failed: ${error.message}`);
    updateCloudStatus("Cloud error");
  }
}

function updateCloudStatus(message) {
  console.info(state.apiEnabled ? `TMS API: ${message}` : message);
}

function apiRequest(path, options = {}) {
  return window.TmsApi.request(`${APPOINTMENTS_TABLE}${path}`, options);
}

function apiTableRequest(table, path, options = {}) {
  return window.TmsApi.request(`${table}${path}`, options);
}

async function loadRecordsFromApi() {
  const rows = await apiRequest("?select=*&order=schedule_time_raw.asc", { method: "GET" });
  return (rows || []).map(recordFromApiRow);
}

async function loadTripPlansByIsa() {
  const rows = await apiTableRequest(TRIP_TABLE, "?select=*&order=etd_at.desc", { method: "GET" });
  const byIsa = new Map();
  (rows || []).forEach((row) => {
    const executionStatus = normalizeExecutionStatus(row);
    const controlStatus = normalizeControlStatus(row);
    if (controlStatus === "Cancelled") return;
    const plan = {
      id: clean(row.id),
      name: clean(row.plan_name) || clean(row.plan_type) || "Untitled Plan",
      type: clean(row.plan_type),
      status: controlStatus === "Active" ? executionStatus : `${executionStatus} / ${controlStatus}`,
      executionStatus,
      controlStatus,
      etaDate: clean(row.etd_date),
      etaPeriod: clean(row.etd_period),
      transport: clean(row.transport_mode),
      stops: Array.isArray(row.stops) ? row.stops : [],
      updatedAt: clean(row.updated_at),
    };
    plan.stops.forEach((stop) => {
      const isa = clean(stop.isa);
      if (isa && !byIsa.has(isa)) byIsa.set(isa, { ...plan, matchedStop: stop });
    });
  });
  return byIsa;
}

async function loadFcsByCode() {
  const fcRows = await apiTableRequest(FC_TABLE, "?select=fc,address,city,state,latitude,longitude,legal_transit_hours,transit_days", { method: "GET" });
  let routeRows = [];
  try {
    routeRows = await apiTableRequest(FC_ROUTE_CACHE_TABLE, "?select=fc,distance_miles", { method: "GET" });
  } catch (error) {
    console.warn("Route cache distance load failed.", error);
  }
  const distanceByFc = new Map((routeRows || []).map((row) => [clean(row.fc), numberOrNull(row.distance_miles)]));
  return new Map((fcRows || []).map((row) => {
    const fc = clean(row.fc);
    return [fc, { ...row, distance_miles: distanceByFc.get(fc) }];
  }));
}

async function upsertRecordsToApi(records) {
  const rows = records
    .filter((record) => clean(record.appointmentId))
    .map(recordToApiRow);
  if (!rows.length) return;
  await apiRequest("?on_conflict=isa", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
}

async function deleteRecordFromApi(record) {
  if (!state.apiEnabled || !record.appointmentId) return;
  await apiRequest(`?isa=eq.${encodeURIComponent(record.appointmentId)}`, { method: "DELETE" });
}

function recordToApiRow(record) {
  return {
    isa: clean(record.appointmentId),
    fc: clean(record.fc),
    status: clean(record.status),
    schedule_time_raw: clean(record.scheduleTime),
    schedule_time_la: formatLosAngelesTime(record.scheduleTime),
    crdd_raw: clean(record.crdd),
    load_type: normalizeLoadType(record.loadType) || null,
    reference_code: clean(record.referenceCode),
    trailer: clean(record.trailer),
    source: clean(record.source),
    notes: clean(record.notes),
    change_log: Array.isArray(record.changeLog) ? record.changeLog : [],
    last_imported_at: clean(record.lastUpdated) || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function recordFromApiRow(row) {
  const record = {
    fc: clean(row.fc),
    appointmentId: clean(row.isa),
    trailer: clean(row.trailer),
    referenceCode: clean(row.reference_code),
    crdd: clean(row.crdd_raw),
    status: clean(row.status),
    scheduleTime: clean(row.schedule_time_raw),
    loadType: normalizeLoadType(row.load_type),
    source: clean(row.source),
    lastUpdated: clean(row.updated_at || row.last_imported_at),
    notes: clean(row.notes),
    changeLog: Array.isArray(row.change_log) ? row.change_log : [],
  };
  record.key = makeKey(record);
  return record;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        const store = db.createObjectStore(RECORD_STORE, { keyPath: "key" });
        store.createIndex("appointmentId", "appointmentId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadRecordsFromDb() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECORD_STORE, "readonly");
    const request = transaction.objectStore(RECORD_STORE).getAll();
    request.onsuccess = () => resolve(request.result.map((record) => ({ ...record, key: makeKey(record) })));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function saveRecordsToDb(records) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RECORD_STORE, "readwrite");
    const store = transaction.objectStore(RECORD_STORE);
    store.clear();
    records.forEach((record) => store.put({ ...record, key: makeKey(record) }));
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function handleFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    setImportStatus(`Reading ${file.name}...`);
    const lowerName = file.name.toLowerCase();
    const records = rowsToRecords(
      lowerName.endsWith(".xlsx") ? await parseXlsx(file) : parseCsv(await file.text()),
      file.name,
    );
    const result = mergeRecords(records);
    await saveRecords();
    state.lastImportChanges = result.changes;
    setImportStatus(`Imported ${result.added} new, updated ${result.updated} from ${file.name}. Records are saved ${state.apiEnabled ? "to the TMS API" : "locally"}.`);
    render();
    openImportSummaryModal(result, file.name);
  } catch (error) {
    console.error(error);
    setImportStatus(`Import failed: ${error.message}`);
  } finally {
    els.fileInput.value = "";
  }
}

function openManualPanel() {
  clearManualFields();
  els.manualPanel.classList.remove("hidden");
  els.manualIsa.focus();
}

function closeManualPanel() {
  els.manualPanel.classList.add("hidden");
}

function openImportSummaryModal(result, fileName) {
  const addedRecords = Array.isArray(result.addedRecords) ? result.addedRecords : [];
  const updatedRecords = Array.isArray(result.updatedRecords) ? result.updatedRecords : result.changes || [];
  const unchanged = Number.isFinite(Number(result.unchanged)) ? Number(result.unchanged) : 0;
  els.importSummarySubtitle.textContent = clean(fileName) || "Appointment import results";
  els.importSummaryBody.innerHTML = `
    <div class="import-summary-counts" aria-label="Import counts">
      <article><span>Added</span><strong>${escapeHtml(result.added || 0)}</strong></article>
      <article><span>Updated</span><strong>${escapeHtml(result.updated || 0)}</strong></article>
      <article><span>Unchanged</span><strong>${escapeHtml(unchanged)}</strong></article>
    </div>
    ${!addedRecords.length && !updatedRecords.length ? '<p class="import-summary-empty">No appointment changes detected.</p>' : ""}
    ${renderAddedAppointments(addedRecords)}
    ${renderUpdatedAppointments(updatedRecords)}
  `;
  els.importSummaryModal.classList.remove("hidden");
  els.dismissImportSummaryButton.focus();
}

function closeImportSummaryModal() {
  els.importSummaryModal.classList.add("hidden");
}

function renderAddedAppointments(records) {
  if (!records.length) return "";
  return `
    <section class="import-summary-section">
      <h3>New Appointments</h3>
      <div class="import-summary-list">
        ${records.slice(0, 25).map((record) => `
          <article class="import-summary-record import-summary-row">
            <strong>${escapeHtml(record.appointmentId || "-")}</strong>
            <span>${escapeHtml(compactUnique([record.fc, record.status, record.scheduleTime, record.crdd, record.loadType || "Unassigned"]).join(" · ") || "-")}</span>
          </article>
        `).join("")}
      </div>
      ${records.length > 25 ? `<p class="import-summary-more">${escapeHtml(`${records.length - 25} more new appointments not shown.`)}</p>` : ""}
    </section>
  `;
}

function renderUpdatedAppointments(records) {
  if (!records.length) return "";
  return `
    <section class="import-summary-section">
      <h3>Updated Appointments</h3>
      <div class="import-summary-list">
        ${records.slice(0, 25).map((item) => `
          <article class="import-summary-record import-summary-row">
            <strong>${escapeHtml(item.isa || "-")}</strong>
            <span>${escapeHtml(item.fc || "-")}</span>
            <span>${escapeHtml((item.changes || []).map((change) => `${change.label}: ${change.oldValue || "-"} -> ${change.newValue || "-"}`).join("; ") || "-")}</span>
          </article>
        `).join("")}
      </div>
      ${records.length > 25 ? `<p class="import-summary-more">${escapeHtml(`${records.length - 25} more updated appointments not shown.`)}</p>` : ""}
    </section>
  `;
}

function clearManualFields() {
  els.manualIsa.value = "";
  els.manualFc.value = "";
  els.manualStatus.value = "";
  els.manualSchedule.value = "";
  els.manualCrdd.value = "";
  els.manualLoadType.value = "";
  els.manualReference.value = "";
  els.manualTrailer.value = "";
}

async function saveManualRecord() {
  const record = {
    fc: clean(els.manualFc.value),
    appointmentId: clean(els.manualIsa.value),
    trailer: clean(els.manualTrailer.value),
    referenceCode: clean(els.manualReference.value),
    crdd: clean(els.manualCrdd.value),
    status: clean(els.manualStatus.value),
    scheduleTime: clean(els.manualSchedule.value),
    loadType: normalizeLoadType(els.manualLoadType.value),
    source: "Manual",
    lastUpdated: new Date().toISOString(),
    notes: "",
    changeLog: [],
  };
  record.key = makeKey(record);
  if (!record.appointmentId) {
    setImportStatus("Manual add needs an ISA.");
    return;
  }

  const result = mergeRecords([record]);
  state.lastImportChanges = result.changes;
  await saveRecords();
  state.selectedKey = record.key;
  setImportStatus(`Saved manual appointment ${record.appointmentId}. Added ${result.added}, updated ${result.updated}.`);
  closeManualPanel();
  render();
}

function rowsToRecords(rows, sourceName) {
  if (!rows.length) return [];
  const headers = rows[0].map((header) => normalizeHeader(header));
  return rows.slice(1).map((row) => {
    const value = (...labels) => {
      const normalizedLabels = labels.map((label) => normalizeHeader(label));
      const index = headers.findIndex((header) => normalizedLabels.includes(header));
      return index >= 0 ? clean(row[index]) : "";
    };

    const record = {
      fc: value("Destination FC", "FC", "Destination"),
      appointmentId: value("Appointment ID", "ISA", "Appointment Id"),
      trailer: value("Trailer Number", "Trailer"),
      referenceCode: value("Appointment Reference Code", "Reference Code", "Reference"),
      crdd: value("Carrier Requested Delivery Date", "CRDD", "Requested Delivery Date"),
      status: value("Status", "Appointment Status"),
      scheduleTime: value("Scheduled Time", "Schedule Time", "Appointment Time"),
      loadType: normalizeLoadType(value("Load Type", "Freight Load Type")),
      source: sourceName,
      lastUpdated: new Date().toISOString(),
      notes: "",
      changeLog: [],
    };
    record.key = makeKey(record);
    return record;
  }).filter((record) => record.fc || record.appointmentId || record.referenceCode || record.scheduleTime);
}

function mergeRecords(incoming) {
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const changes = [];
  const addedRecords = [];
  const updatedRecords = [];
  const byIsa = new Map(state.records.filter((record) => record.appointmentId).map((record) => [record.appointmentId, record]));
  const byKey = new Map(state.records.map((record) => [record.key, record]));

  incoming.forEach((record) => {
    const existing = record.appointmentId ? byIsa.get(record.appointmentId) : byKey.get(record.key);
    if (existing) {
      const recordChanges = collectImportChanges(existing, record);
      const previousLoadType = existing.loadType;
      const previousNotes = existing.notes;
      const previousChangeLog = Array.isArray(existing.changeLog) ? existing.changeLog : [];
      if (recordChanges.length) {
        const importedAt = new Date().toISOString();
        const logEntry = {
          id: `${importedAt}-${existing.appointmentId || existing.key}`,
          type: "import",
          source: record.source,
          changedAt: importedAt,
          changes: recordChanges,
        };
        existing.changeLog = [logEntry, ...previousChangeLog].slice(0, 200);
        changes.push({ isa: existing.appointmentId || record.appointmentId || record.referenceCode, fc: record.fc || existing.fc, changes: recordChanges });
        updatedRecords.push({
          isa: existing.appointmentId || record.appointmentId || record.referenceCode,
          fc: record.fc || existing.fc,
          changes: recordChanges,
        });
        updated += 1;
      } else {
        unchanged += 1;
      }
      Object.assign(existing, {
        ...record,
        key: makeKey(record),
        loadType: previousLoadType || record.loadType,
        notes: previousNotes || "",
        changeLog: existing.changeLog || previousChangeLog,
        lastUpdated: new Date().toISOString(),
      });
    } else {
      state.records.push(record);
      if (record.appointmentId) byIsa.set(record.appointmentId, record);
      byKey.set(record.key, record);
      addedRecords.push(record);
      added += 1;
    }
  });

  return { added, updated, unchanged, changes, addedRecords, updatedRecords };
}

function collectImportChanges(existing, incoming) {
  const fields = [
    ["fc", "FC"],
    ["status", "Status"],
    ["scheduleTime", "Schedule Time"],
    ["crdd", "CRDD"],
    ["trailer", "Trailer"],
    ["referenceCode", "Reference"],
  ];

  const changes = fields
    .map(([field, label]) => ({ field, label, oldValue: clean(existing[field]), newValue: clean(incoming[field]) }))
    .filter((change) => change.oldValue !== change.newValue && change.newValue !== "");

  if (!clean(existing.loadType) && clean(incoming.loadType)) {
    changes.push({ field: "loadType", label: "Load Type", oldValue: "", newValue: clean(incoming.loadType) });
  }

  return changes;
}

function makeKey(record) {
  return clean(record.appointmentId)
    || clean(record.referenceCode)
    || [record.fc, record.crdd, record.scheduleTime, record.loadType].map(clean).join("|");
}

function normalizeHeader(value) {
  return clean(value).replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function clean(value) {
  return String(value ?? "").trim();
}

function setFilter(name, value) {
  state.filters[name] = value;
  render();
}

function clearFilters() {
  state.filters = { search: "", fc: "", status: "", loadType: "", from: "", to: "" };
  els.searchInput.value = "";
  els.fcFilter.value = "";
  els.statusFilter.value = "";
  els.loadTypeFilter.value = "";
  els.fromDate.value = "";
  els.toDate.value = "";
  render();
}

function setViewMode(mode) {
  if (!["table", "calendar", "timeline", "map"].includes(mode)) return;
  state.viewMode = mode;
  if (mode === "timeline") state.timelineAutoScrollPending = true;
  render();
}

function setTimeDisplayMode(mode) {
  if (!["appointment", "latestDeparture", "soloSafeTransit"].includes(mode)) return;
  state.timeDisplayMode = mode;
  state.sortKey = "scheduleTime";
  state.sortDirection = "asc";
  render();
}

function setCalendarSubview(subview) {
  if (!["day", "week", "month"].includes(subview)) return;
  state.calendarSubview = subview;
  renderCalendar();
}

function shiftCalendarPeriod(offset) {
  const current = new Date(state.calendarDate);
  if (state.calendarSubview === "day") {
    current.setDate(current.getDate() + offset);
  } else if (state.calendarSubview === "week") {
    current.setDate(current.getDate() + offset * 7);
  } else {
    current.setMonth(current.getMonth() + offset);
    current.setDate(1);
  }
  state.calendarDate = startOfDay(current);
  renderCalendar();
}

function jumpCalendarToToday() {
  state.calendarDate = startOfDay(new Date());
  renderCalendar();
}

function getFilteredRecords() {
  const search = state.filters.search.toLowerCase().trim();
  const from = state.filters.from ? new Date(`${state.filters.from}T00:00:00`) : null;
  const to = state.filters.to ? new Date(`${state.filters.to}T23:59:59`) : null;

  return state.records.filter((record) => {
    const haystack = [
      record.fc,
      record.appointmentId,
      record.referenceCode,
      record.crdd,
      record.scheduleTime,
      record.loadType,
      record.status,
      record.trailer,
      record.notes,
    ].join(" ").toLowerCase();
    const scheduleDate = filterDateForRecord(record);

    return (!search || haystack.includes(search))
      && (!state.filters.fc || record.fc === state.filters.fc)
      && (!state.filters.status || record.status === state.filters.status)
      && (!state.filters.loadType || record.loadType === state.filters.loadType)
      && (!from || (scheduleDate && scheduleDate >= from))
      && (!to || (scheduleDate && scheduleDate <= to));
  }).sort((a, b) => compareRecords(a, b));
}

function compareRecords(a, b) {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  let left = a[state.sortKey] || "";
  let right = b[state.sortKey] || "";
  if (state.sortKey === "scheduleTime" || state.sortKey === "crdd") {
    left = (state.sortKey === "scheduleTime" ? displayDateForRecord(a) : parseAppointmentDate(left))?.getTime() || 0;
    right = (state.sortKey === "scheduleTime" ? displayDateForRecord(b) : parseAppointmentDate(right))?.getTime() || 0;
    return (left - right) * direction;
  }
  if (state.sortKey === "laTime") {
    left = displayDateForRecord(a)?.getTime() || 0;
    right = displayDateForRecord(b)?.getTime() || 0;
    return (left - right) * direction;
  }
  return String(left).localeCompare(String(right), undefined, { numeric: true }) * direction;
}

function parseAppointmentDate(value) {
  const text = clean(value);
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?:\s+([A-Z]{2,4}))?/);
  if (!match) {
    const fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, month, day, year, hour, minute, zone] = match;
  const offset = timezoneOffsets[zone];
  if (typeof offset === "number") {
    const utcMillis = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) - offset * 60000;
    return new Date(utcMillis);
  }
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

function fcForRecord(record) {
  return state.fcsByCode.get(clean(record && record.fc));
}

function legalTransitHoursForRecord(record) {
  const fc = fcForRecord(record);
  const legalHours = numberOrNull(fc && fc.legal_transit_hours);
  if (legalHours !== null) return legalHours;
  const transitDays = numberOrNull(fc && fc.transit_days);
  return transitDays === null ? null : transitDays * 24;
}

function routeDistanceMilesForRecord(record) {
  const fc = fcForRecord(record);
  return numberOrNull(fc && fc.distance_miles);
}

function soloSafeTransitBufferPercent(record) {
  const miles = routeDistanceMilesForRecord(record);
  if (miles === null) return null;
  if (miles < 500) return 0.10;
  if (miles <= 1500) return 0.15;
  return 0.25;
}

function soloSafeTransitHoursForRecord(record) {
  const legalHours = legalTransitHoursForRecord(record);
  const bufferPercent = soloSafeTransitBufferPercent(record);
  if (legalHours === null || bufferPercent === null) return null;
  return legalHours * (1 + bufferPercent);
}

function departureDateFromTransitHours(record, transitHours) {
  const appointmentDate = parseAppointmentDate(record && record.scheduleTime);
  if (!appointmentDate || transitHours === null) return null;
  return new Date(appointmentDate.getTime() - transitHours * 3600000);
}

function latestDepartureDate(record) {
  return departureDateFromTransitHours(record, legalTransitHoursForRecord(record));
}

function soloSafeDepartureDate(record) {
  return departureDateFromTransitHours(record, soloSafeTransitHoursForRecord(record));
}

function displayDateForRecord(record) {
  if (state.timeDisplayMode === "latestDeparture") return latestDepartureDate(record);
  if (state.timeDisplayMode === "soloSafeTransit") return soloSafeDepartureDate(record);
  return parseAppointmentDate(record && record.scheduleTime);
}

function filterDateForRecord(record) {
  return displayDateForRecord(record);
}

function displayTimeText(record) {
  if (state.timeDisplayMode === "appointment") return clean(record.scheduleTime) || "-";
  const date = displayDateForRecord(record);
  if (!date) return state.timeDisplayMode === "soloSafeTransit" ? "No safe time" : "No legal time";
  return formatDateTimeWithZone(date);
}

function displayLosAngelesTime(record) {
  const date = displayDateForRecord(record);
  if (!date) return "-";
  return formatLosAngelesDate(date);
}

function secondaryTimeText(record) {
  if (state.timeDisplayMode === "latestDeparture") {
    return `Appt ${formatLosAngelesTime(record.scheduleTime)}`;
  }
  if (state.timeDisplayMode === "soloSafeTransit") {
    const safeHours = soloSafeTransitHoursForRecord(record);
    const bufferPercent = soloSafeTransitBufferPercent(record);
    if (safeHours === null || bufferPercent === null) return `Appt ${formatLosAngelesTime(record.scheduleTime)}`;
    return `Safe ${formatHours(safeHours)} (+${Math.round(bufferPercent * 100)}%)`;
  }
  const latest = latestDepartureDate(record);
  return latest ? `Latest ${formatLosAngelesDate(latest)}` : "";
}

function displayDateKey(record) {
  const date = displayDateForRecord(record);
  if (date) return dateKey(date);
  return state.timeDisplayMode === "appointment" ? scheduleDateKey(record && record.scheduleTime) : "";
}

function displayHourForRecord(record) {
  const date = displayDateForRecord(record);
  return date ? date.getHours() : "all";
}

function displayCalendarTimeLabel(record) {
  const date = displayDateForRecord(record);
  if (!date) return state.timeDisplayMode === "appointment" ? calendarTimeLabel(record.scheduleTime) : "No departure";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Los_Angeles",
  }).format(date);
}

function currentTimeModeLabel() {
  if (state.timeDisplayMode === "latestDeparture") return "latest departure";
  if (state.timeDisplayMode === "soloSafeTransit") return "solo safe transit";
  return "appointment";
}

const timezoneOffsets = {
  PST: -480,
  PDT: -420,
  MST: -420,
  MDT: -360,
  CST: -360,
  CDT: -300,
  EST: -300,
  EDT: -240,
};

function render() {
  renderStats();
  renderFilterOptions();
  renderRows();
  renderViewMode();
  renderCalendar();
  renderTimeline();
  renderMapView();
  renderDetail();
}

function renderStats() {
  if (!els.totalCount || !els.upcomingCount || !els.todayCount || !els.issueCount) return;
  const now = new Date();
  const todayKey = dateKey(now);
  els.totalCount.textContent = state.records.length;
  els.upcomingCount.textContent = state.records.filter((record) => {
    const date = parseAppointmentDate(record.scheduleTime);
    return date && date >= startOfDay(now);
  }).length;
  els.todayCount.textContent = state.records.filter((record) => {
    const key = scheduleDateKey(record.scheduleTime);
    return key && key === todayKey;
  }).length;
  els.issueCount.textContent = state.records.filter((record) => isIssueStatus(record.status)).length;
}

function renderFilterOptions() {
  setSelectOptions(els.fcFilter, "All FCs", uniqueValues("fc"), state.filters.fc);
  setSelectOptions(els.statusFilter, "All statuses", uniqueValues("status"), state.filters.status);
  setSelectOptions(els.loadTypeFilter, "All load types", LOAD_TYPE_VALUES, state.filters.loadType);
}

function setSelectOptions(select, firstLabel, values, selected) {
  const current = selected || select.value;
  select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>`
    + values.map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join("");
  select.value = current;
}

function uniqueValues(field) {
  return [...new Set(state.records.map((record) => clean(record[field])).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function compactUnique(values) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function renderRows() {
  const records = getFilteredRecords();
  renderTimeDisplayMode();
  els.resultCount.textContent = `${records.length} visible of ${state.records.length} records`;
  if (!state.records.length) {
    els.emptyState.innerHTML = `
      <h3>No appointments loaded</h3>
      <p>Upload an Amazon Carrier Central CSV or XLSX download to begin.</p>
    `;
    els.emptyState.style.display = "block";
  } else if (!records.length) {
    els.emptyState.innerHTML = `
      <h3>No matching appointments</h3>
      <p>Adjust search or clear filters to see more results.</p>
    `;
    els.emptyState.style.display = "block";
  } else {
    els.emptyState.style.display = "none";
  }
  els.appointmentRows.innerHTML = records.map((record) => {
    const selected = record.key === state.selectedKey ? "selected" : "";
    const loadTypeMeta = getLoadTypeMeta(record.loadType);
    const matchedPlan = tripPlanForRecord(record);
    const tripStatus = matchedPlan ? `
      <small class="trip-status-hint status-${escapeAttr(tripPlanStatusClass(matchedPlan.status))}">
        ${escapeHtml(matchedPlan.status)}
      </small>
    ` : "";
    return `
      <tr class="${selected}" data-key="${escapeAttr(record.key)}">
        <td>
          <span class="isa-text">${escapeHtml(record.appointmentId || record.referenceCode || "-")}</span>
          ${tripStatus}
        </td>
        <td><strong>${escapeHtml(record.fc || "-")}</strong></td>
        <td><span class="status-pill ${statusClass(record.status)}">${escapeHtml(record.status || "Unknown")}</span></td>
        <td>
          <span class="time-primary">${escapeHtml(displayTimeText(record))}</span>
          ${secondaryTimeText(record) ? `<small class="time-secondary">${escapeHtml(secondaryTimeText(record))}</small>` : ""}
        </td>
        <td>${escapeHtml(displayLosAngelesTime(record))}</td>
        <td>${escapeHtml(record.crdd || "-")}</td>
        <td>
          <select class="load-type-select load-type-${escapeAttr(loadTypeMeta.className)}" data-load-type-key="${escapeAttr(record.key)}" aria-label="Load type for ${escapeAttr(record.appointmentId || record.referenceCode || record.fc || "appointment")}">
            ${loadTypeOptionsHtml(record.loadType, "Unassigned")}
          </select>
        </td>
      </tr>
    `;
  }).join("");

  els.appointmentRows.querySelectorAll("tr[data-key]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedKey = row.dataset.key;
      render();
    });
  });
  els.appointmentRows.querySelectorAll("select[data-load-type-key]").forEach((select) => {
    select.addEventListener("click", (event) => event.stopPropagation());
    select.addEventListener("change", async (event) => {
      event.stopPropagation();
      const record = state.records.find((item) => item.key === select.dataset.loadTypeKey);
      if (!record) return;
      state.selectedKey = record.key;
      await updateRecordField(record, "loadType", event.target.value, "Appointment list");
    });
  });
}

function renderViewMode() {
  const isCalendar = state.viewMode === "calendar";
  const isTimeline = state.viewMode === "timeline";
  const isMap = state.viewMode === "map";
  els.tableView.classList.toggle("hidden", isCalendar || isTimeline || isMap);
  els.calendarView.classList.toggle("hidden", !isCalendar);
  els.timelineView.classList.toggle("hidden", !isTimeline);
  els.mapView.classList.toggle("hidden", !isMap);
  els.tableViewButton.classList.toggle("active", !isCalendar && !isTimeline && !isMap);
  els.calendarViewButton.classList.toggle("active", isCalendar);
  els.timelineViewButton.classList.toggle("active", isTimeline);
  els.mapViewButton.classList.toggle("active", isMap);
}

function renderTimeDisplayMode() {
  const latestMode = state.timeDisplayMode === "latestDeparture";
  const soloSafeMode = state.timeDisplayMode === "soloSafeTransit";
  els.appointmentTimeViewButton.classList.toggle("active", state.timeDisplayMode === "appointment");
  els.latestDepartureViewButton.classList.toggle("active", latestMode);
  els.soloSafeTransitViewButton.classList.toggle("active", soloSafeMode);
  els.scheduleColumnHeader.textContent = soloSafeMode ? "Solo Safe Departure" : latestMode ? "Latest Departure" : "Schedule Time";
  els.laTimeColumnHeader.textContent = latestMode || soloSafeMode ? "LA Departure" : "Los Angeles Time";
}

function renderCalendar() {
  const records = getFilteredRecords();
  const isWeekSubview = state.calendarSubview === "week";
  els.exportWeekImageButton.classList.toggle("hidden", !isWeekSubview);
  els.exportWeekImageButton.disabled = !isWeekSubview;
  els.calendarSubviewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.calendarSubview === state.calendarSubview);
  });
  if (state.calendarSubview === "month") {
    renderMonthCalendar(records);
  } else {
    renderCalendarTimeGrid(records);
  }
}

function renderMonthCalendar(records) {
  els.calendarGrid.className = "calendar-grid calendar-month-grid";
  const monthStart = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth(), 1);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const monthKey = `${monthStart.getFullYear()}-${pad2(monthStart.getMonth() + 1)}`;
  const recordsByDay = new Map();

  records.forEach((record) => {
    const key = displayDateKey(record);
    if (!key) return;
    const items = recordsByDay.get(key) || [];
    items.push(record);
    recordsByDay.set(key, items);
  });

  els.calendarTitle.textContent = `${formatCalendarTitle(monthStart, monthEnd)} · ${currentTimeModeLabel()}`;

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((day) => `<div class="calendar-weekday">${day}</div>`)
    .join("");

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = dateKey(date);
    const isCurrentMonth = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}` === monthKey;
    const isToday = key === dateKey(new Date());
    const appointments = (recordsByDay.get(key) || []).sort(compareRecords);
    const items = appointments.map((record) => {
      const selected = record.key === state.selectedKey ? " selected" : "";
      const loadTypeMeta = getLoadTypeMeta(record.loadType);
      const appointmentClass = ` appt-status-${escapeAttr(appointmentStatusClass(record.status))}`;
      const matchedPlan = tripPlanForRecord(record);
      const tripClass = matchedPlan ? ` trip-bound status-${escapeAttr(tripPlanStatusClass(matchedPlan.status))}` : "";
      const title = `${record.fc || "-"} ${record.appointmentId || record.referenceCode || "-"}`;
      return `
        <button class="calendar-appointment load-type-${escapeAttr(loadTypeMeta.className)}${appointmentClass}${tripClass}${selected}" type="button" data-key="${escapeAttr(record.key)}" title="${escapeAttr(title)}">
          <strong>${escapeHtml(calendarPrimaryLabel(record))}</strong>
          <small>
            <span>${escapeHtml(displayCalendarTimeLabel(record))}</span>
            <em>${escapeHtml(calendarTypeLabel(record))}</em>
          </small>
        </button>
      `;
    }).join("");
    return `
      <div class="calendar-day-cell ${isCurrentMonth ? "" : "muted"} ${isToday ? "today" : ""}">
        <div class="calendar-date">${date.getDate()}</div>
        <div class="calendar-items">${items}</div>
      </div>
    `;
  }).join("");

  els.calendarGrid.innerHTML = dayLabels + days;
  els.calendarGrid.querySelectorAll("button[data-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedKey = button.dataset.key;
      render();
    });
  });
}

function renderCalendarTimeGrid(records) {
  els.calendarGrid.className = "calendar-grid calendar-time-scroll";
  const dayCount = state.calendarSubview === "day" ? 1 : 7;
  const rangeStart = state.calendarSubview === "day" ? startOfDay(state.calendarDate) : startOfWeek(state.calendarDate);
  const rangeEnd = addDays(rangeStart, dayCount - 1);
  const days = Array.from({ length: dayCount }, (_, index) => addDays(rangeStart, index));
  const recordsByDay = recordsByDateKey(records);

  els.calendarTitle.textContent = `${formatCalendarTitle(rangeStart, rangeEnd)} · ${currentTimeModeLabel()}`;

  const dayHeaders = days.map((day) => {
    const key = dateKey(day);
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day);
    const isToday = key === dateKey(new Date());
    return `
      <div class="calendar-time-day-head ${isToday ? "today" : ""}">
        <span>${escapeHtml(weekday)}</span>
        <strong>${day.getDate()}</strong>
      </div>
    `;
  }).join("");

  const allDayItems = days.map((day) => {
    const appointments = (recordsByDay.get(dateKey(day)) || []).filter((record) => !displayDateForRecord(record));
    return `<div class="calendar-all-day-cell">${appointments.map(renderCalendarPill).join("")}</div>`;
  }).join("");

  const hourRows = Array.from({ length: 24 }, (_, hour) => {
    const cells = days.map((day) => {
      const appointments = (recordsByDay.get(dateKey(day)) || []).filter((record) => {
        const date = displayDateForRecord(record);
        return date && date.getHours() === hour && (date.getHours() !== 0 || date.getMinutes() !== 0);
      });
      return `<div class="calendar-hour-cell">${appointments.map(renderCalendarTimeItem).join("")}</div>`;
    }).join("");
    return `
      <div class="calendar-hour-label">${pad2(hour)}:00</div>
      ${cells}
    `;
  }).join("");

  els.calendarGrid.innerHTML = `
    <div class="calendar-time-grid ${state.calendarSubview === "day" ? "day-mode" : ""}" style="--calendar-days: ${dayCount}">
      <div class="calendar-time-corner"></div>
      ${dayHeaders}
      <div class="calendar-all-day-label">All day</div>
      ${allDayItems}
      ${hourRows}
    </div>
  `;
  bindCalendarRecordButtons();
}

function recordsByDateKey(records) {
  const groups = new Map();
  records.forEach((record) => {
    const key = displayDateKey(record);
    if (!key) return;
    const items = groups.get(key) || [];
    items.push(record);
    groups.set(key, items.sort(compareRecords));
  });
  return groups;
}

function renderCalendarPill(record) {
  const selected = record.key === state.selectedKey ? " selected" : "";
  const loadTypeMeta = getLoadTypeMeta(record.loadType);
  const appointmentClass = ` appt-status-${escapeAttr(appointmentStatusClass(record.status))}`;
  const matchedPlan = tripPlanForRecord(record);
  const tripClass = matchedPlan ? ` trip-bound status-${escapeAttr(tripPlanStatusClass(matchedPlan.status))}` : "";
  const title = `${record.fc || "-"} ${record.appointmentId || record.referenceCode || "-"}`;
  return `
    <button class="calendar-appointment load-type-${escapeAttr(loadTypeMeta.className)}${appointmentClass}${tripClass}${selected}" type="button" data-key="${escapeAttr(record.key)}" title="${escapeAttr(title)}">
      <strong>${escapeHtml(calendarPrimaryLabel(record))}</strong>
    </button>
  `;
}

function renderCalendarTimeItem(record) {
  const selected = record.key === state.selectedKey ? " selected" : "";
  const loadTypeMeta = getLoadTypeMeta(record.loadType);
  const appointmentClass = ` appt-status-${escapeAttr(appointmentStatusClass(record.status))}`;
  const matchedPlan = tripPlanForRecord(record);
  const tripClass = matchedPlan ? ` trip-bound status-${escapeAttr(tripPlanStatusClass(matchedPlan.status))}` : "";
  const title = `${record.fc || "-"} ${record.appointmentId || record.referenceCode || "-"}`;
  return `
    <button class="calendar-time-appointment load-type-${escapeAttr(loadTypeMeta.className)}${appointmentClass}${tripClass}${selected}" type="button" data-key="${escapeAttr(record.key)}" title="${escapeAttr(title)}">
      <span>${escapeHtml(displayCalendarTimeLabel(record))}</span>
      <strong>${escapeHtml(calendarPrimaryLabel(record))}</strong>
    </button>
  `;
}

function bindCalendarRecordButtons() {
  els.calendarGrid.querySelectorAll("button[data-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedKey = button.dataset.key;
      render();
    });
  });
}

function startOfWeek(date) {
  const value = startOfDay(date);
  value.setDate(value.getDate() - value.getDay());
  return value;
}

function addDays(date, days) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function formatCalendarTitle(start, end) {
  if (state.calendarSubview === "month") {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(start);
  }
  if (dateKey(start) === dateKey(end)) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(start);
  }
  const sameMonth = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${new Intl.DateTimeFormat("en-US", { month: "long" }).format(start)} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start)} - ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(end)}`;
}

async function exportWeekImage() {
  if (state.calendarSubview !== "week") return;
  els.exportWeekImageButton.disabled = true;
  const originalText = els.exportWeekImageButton.textContent;
  els.exportWeekImageButton.textContent = "Exporting...";

  try {
    const weekStart = startOfWeek(state.calendarDate);
    const canvas = drawWeekCalendarImage(weekStart, getFilteredRecords());
    downloadDataUrl(canvas.toDataURL("image/png"), `appointments-week-${dateKey(weekStart)}.png`);
    setImportStatus("Week calendar image exported.");
  } catch (error) {
    console.error(error);
    setImportStatus(`Week image export failed: ${error.message}`);
  } finally {
    els.exportWeekImageButton.textContent = originalText;
    els.exportWeekImageButton.disabled = state.calendarSubview !== "week";
  }
}

function drawWeekCalendarImage(weekStart, records) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const dayKeys = days.map(dateKey);
  const left = 82;
  const dayWidth = 184;
  const rowHeight = 56;
  const titleHeight = 52;
  const headerHeight = 62;
  const allDayHeight = 38;
  const padding = 22;
  const width = left + dayWidth * 7 + padding * 2;
  const height = titleHeight + headerHeight + allDayHeight + rowHeight * 24 + padding * 2;
  const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.fillStyle = "#f6f7f9";
  context.fillRect(0, 0, width, height);

  const gridX = padding + left;
  const gridY = padding + titleHeight;
  const hourStartY = gridY + headerHeight + allDayHeight;
  context.fillStyle = "#18202a";
  context.font = "800 24px Inter, system-ui, sans-serif";
  context.fillText(`${currentTimeModeLabel()} - ${formatCalendarTitle(weekStart, addDays(weekStart, 6))}`, padding, padding + 30);

  context.fillStyle = "#fbfcfd";
  context.fillRect(padding, gridY, left + dayWidth * 7, headerHeight + allDayHeight);
  context.strokeStyle = "#d9dee7";
  context.lineWidth = 1;
  context.strokeRect(padding, gridY, left + dayWidth * 7, headerHeight + allDayHeight + rowHeight * 24);

  days.forEach((day, index) => {
    const x = gridX + index * dayWidth;
    const isToday = dateKey(day) === dateKey(new Date());
    context.strokeStyle = "#d9dee7";
    context.beginPath();
    context.moveTo(x, gridY);
    context.lineTo(x, hourStartY + rowHeight * 24);
    context.stroke();
    context.fillStyle = "#697382";
    context.font = "800 12px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.fillText(new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day).toUpperCase(), x + dayWidth / 2, gridY + 22);
    if (isToday) {
      context.fillStyle = "#1468d8";
      drawRoundRect(context, x + dayWidth / 2 - 15, gridY + 30, 30, 30, 15);
      context.fill();
      context.fillStyle = "#ffffff";
    } else {
      context.fillStyle = "#18202a";
    }
    context.font = "800 16px Inter, system-ui, sans-serif";
    context.fillText(String(day.getDate()), x + dayWidth / 2, gridY + 50);
  });
  context.textAlign = "left";

  context.fillStyle = "#697382";
  context.font = "800 11px Inter, system-ui, sans-serif";
  context.textAlign = "right";
  context.fillText("All day", padding + left - 8, gridY + headerHeight + 24);

  for (let hour = 0; hour < 24; hour += 1) {
    const y = hourStartY + hour * rowHeight;
    context.strokeStyle = "#d9dee7";
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(padding + left + dayWidth * 7, y);
    context.stroke();
    context.fillStyle = "#697382";
    context.font = "800 11px Inter, system-ui, sans-serif";
    context.textAlign = "right";
    context.fillText(`${pad2(hour)}:00`, padding + left - 8, y + 16);
  }
  context.textAlign = "left";

  const weekRecords = records.filter((record) => {
    const key = displayDateKey(record);
    return dayKeys.includes(key);
  });
  const groups = new Map();
  weekRecords.forEach((record) => {
    const key = displayDateKey(record);
    const hour = displayHourForRecord(record);
    const groupKey = `${key}|${hour}`;
    const items = groups.get(groupKey) || [];
    items.push(record);
    groups.set(groupKey, items);
  });

  dayKeys.forEach((key, dayIndex) => {
    for (let hour = 0; hour < 24; hour += 1) {
      const items = groups.get(`${key}|${hour}`) || [];
      items.slice(0, 5).forEach((record, itemIndex) => {
        const x = gridX + dayIndex * dayWidth + 5;
        const y = hourStartY + hour * rowHeight + 5 + itemIndex * 16;
        drawWeekExportCard(context, record, x, y, dayWidth - 10, 15);
      });
      if (items.length > 5) {
        context.fillStyle = "#697382";
        context.font = "800 10px Inter, system-ui, sans-serif";
        context.fillText(`+${items.length - 3} more`, gridX + dayIndex * dayWidth + 8, hourStartY + hour * rowHeight + 53);
      }
    }
    const allDayItems = groups.get(`${key}|all`) || [];
    allDayItems.slice(0, 2).forEach((record, itemIndex) => {
      const x = gridX + dayIndex * dayWidth + 5;
      const y = gridY + headerHeight + 5 + itemIndex * 16;
      drawWeekExportCard(context, record, x, y, dayWidth - 10, 15);
    });
  });

  context.strokeStyle = "#d9dee7";
  context.beginPath();
  context.moveTo(padding, hourStartY + rowHeight * 24);
  context.lineTo(padding + left + dayWidth * 7, hourStartY + rowHeight * 24);
  context.stroke();
  return canvas;
}

function drawWeekExportCard(context, record, x, y, width, height) {
  const tripPlan = tripPlanForRecord(record);
  const colors = weekExportCardColors(record, tripPlan);
  context.fillStyle = colors.background;
  context.strokeStyle = colors.border;
  drawRoundRect(context, x, y, width, height, 5);
  context.fill();
  context.stroke();
  context.fillStyle = colors.status;
  drawRoundRect(context, x, y, 5, height, 4);
  context.fill();
  context.fillStyle = colors.text;
  context.font = "800 10px Inter, system-ui, sans-serif";
  drawTextEllipsis(context, `${displayCalendarTimeLabel(record)} ${calendarPrimaryLabel(record)}`, x + 8, y + 11, width - 12);
}

function weekExportCardColors(record, tripPlan) {
  const statusColors = {
    normal: "#7ddf9a",
    pending: "#ffbd73",
    done: "#9aa4b2",
    issue: "#f97066",
  };
  const base = {
    background: "#eef5ff",
    border: "#c7d7ef",
    text: "#163b69",
    status: statusColors[appointmentStatusClass(record.status)] || statusColors.normal,
  };
  if (!tripPlan) return base;
  const tripStatus = tripPlanStatusClass(tripPlan.status);
  const tripColors = {
    planned: ["#bfdbfe", "#0b3b85"],
    scheduled: ["#fed7aa", "#5a2a07"],
    pending: ["#fed7aa", "#5a2a07"],
    loading: ["#fed7aa", "#5a2a07"],
    "in-transit": ["#bbf7d0", "#06452c"],
    delivered: ["#cbd5e1", "#344054"],
    locked: ["#cbd5e1", "#344054"],
    cancelled: ["#e4e4e7", "#697382"],
    "at-risk": ["#fecaca", "#b42318"],
  };
  const [background, text] = tripColors[tripStatus] || [base.background, base.text];
  return { ...base, background, text, border: "rgba(15, 23, 42, 0.12)" };
}

function drawRoundRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawTextEllipsis(context, text, x, y, maxWidth) {
  if (context.measureText(text).width <= maxWidth) {
    context.fillText(text, x, y);
    return;
  }
  let value = text;
  while (value.length > 1 && context.measureText(`${value}...`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  context.fillText(`${value}...`, x, y);
}

function downloadDataUrl(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
}

function renderTimeline() {
  const records = getFilteredRecords()
    .filter((record) => displayDateForRecord(record))
    .sort((a, b) => (displayDateForRecord(a)?.getTime() || 0) - (displayDateForRecord(b)?.getTime() || 0));
  const groups = new Map();
  records.forEach((record) => {
    const key = displayDateKey(record);
    const items = groups.get(key) || [];
    items.push(record);
    groups.set(key, items);
  });

  if (!records.length) {
    els.timelineView.innerHTML = `<div class="timeline-empty">No ${escapeHtml(currentTimeModeLabel())} records match the current filters.</div>`;
    return;
  }

  els.timelineView.innerHTML = `
    <div class="timeline-track" aria-label="Horizontal appointment timeline">
      ${Array.from(groups.entries()).map(([key, items]) => `
        <section class="timeline-day" data-date-key="${escapeAttr(key)}">
          <header class="timeline-day-head">
            <strong>${escapeHtml(formatTimelineDate(key))}</strong>
            <span>${items.length} ${escapeHtml(currentTimeModeLabel())}${items.length === 1 ? "" : "s"}</span>
          </header>
          <div class="timeline-axis" aria-hidden="true"></div>
          <div class="timeline-items">
            ${items.map(renderTimelineItem).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;

  els.timelineView.querySelectorAll("button[data-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedKey = button.dataset.key;
      render();
    });
  });
  if (state.viewMode === "timeline" && state.timelineAutoScrollPending) {
    state.timelineAutoScrollPending = false;
    scrollTimelineToToday(els.timelineView);
  }
}

function scrollTimelineToToday(container) {
  requestAnimationFrame(() => {
    const todayKey = dateKey(new Date());
    const days = [...container.querySelectorAll(".timeline-day[data-date-key]")];
    const target = days.find((day) => day.dataset.dateKey === todayKey)
      || days.find((day) => day.dataset.dateKey > todayKey)
      || days[0];
    if (!target) return;
    container.scrollLeft = Math.max(target.offsetLeft - 16, 0);
  });
}

function renderTimelineItem(record) {
  const selected = record.key === state.selectedKey ? " selected" : "";
  const loadTypeMeta = getLoadTypeMeta(record.loadType);
  const matchedPlan = tripPlanForRecord(record);
  const tripClass = matchedPlan ? ` trip-bound status-${escapeAttr(tripPlanStatusClass(matchedPlan.status))}` : "";
  const tripStatus = matchedPlan ? `
    <span class="timeline-trip status-${escapeAttr(tripPlanStatusClass(matchedPlan.status))}">
      ${escapeHtml(matchedPlan.status)}
    </span>
  ` : "";
  return `
    <button class="timeline-item appt-status-${escapeAttr(appointmentStatusClass(record.status))}${tripClass}${selected}" type="button" data-key="${escapeAttr(record.key)}">
      <time>${escapeHtml(displayCalendarTimeLabel(record))}</time>
      <div class="timeline-item-body">
        <div class="timeline-item-main">
          <strong>${escapeHtml(record.fc || "-")}</strong>
          <span class="timeline-isa">${escapeHtml(record.appointmentId || record.referenceCode || "-")}</span>
        </div>
        <div class="timeline-item-meta">
          <span class="status-pill ${statusClass(record.status)}">${escapeHtml(record.status || "Unknown")}</span>
          <span class="timeline-load load-type-${escapeAttr(loadTypeMeta.className)}">${escapeHtml(record.loadType || "Unassigned")}</span>
          ${tripStatus}
        </div>
      </div>
    </button>
  `;
}

function renderMapView() {
  const records = getFilteredRecords();
  const aggregation = buildMapAggregation(records);
  els.mapResultCount.textContent = `${aggregation.mappedRecordCount} mapped of ${records.length} visible records`;
  renderMapMissingCoordinates(aggregation.missing);
  renderMapSummary(aggregation);

  if (state.viewMode !== "map") return;
  if (!records.length) {
    setMapProviderMessage(state.records.length ? "No appointments match the current filters." : "Upload appointments to view FC markers.");
  } else if (!aggregation.groups.length && aggregation.missing.length) {
    setMapProviderMessage("No matching appointments have FC coordinates. See the missing coordinates summary.");
  } else {
    setMapProviderMessage("");
  }

  if (!ensureMapProviderReady()) return;
  if (!state.map.initialized) {
    initializeMapboxMap(aggregation);
    return;
  }
  updateMapMarkers(aggregation);
  fitMapToAggregation(aggregation, false);
}

function buildMapAggregation(records) {
  const groupsByFc = new Map();
  const missingByFc = new Map();

  records.forEach((record) => {
    const fcCode = clean(record.fc) || "Unknown FC";
    const fc = fcForRecord(record);
    const latitude = numberOrNull(fc && fc.latitude);
    const longitude = numberOrNull(fc && fc.longitude);
    if (!fc || latitude === null || longitude === null) {
      const missing = missingByFc.get(fcCode) || { fc: fcCode, count: 0 };
      missing.count += 1;
      missingByFc.set(fcCode, missing);
      return;
    }

    const group = groupsByFc.get(fcCode) || {
      fc: fcCode,
      city: clean(fc.city),
      state: clean(fc.state),
      address: clean(fc.address),
      latitude,
      longitude,
      records: [],
      statusCounts: new Map(),
      loadTypeCounts: new Map(),
      earliestRecord: null,
      earliestDate: null,
      statusClass: "normal",
    };
    group.records.push(record);
    incrementCount(group.statusCounts, clean(record.status) || "Unknown");
    incrementCount(group.loadTypeCounts, clean(record.loadType) || "Unassigned");
    const date = displayDateForRecord(record);
    if (date && (!group.earliestDate || date < group.earliestDate)) {
      group.earliestDate = date;
      group.earliestRecord = record;
    }
    if (!group.earliestRecord) group.earliestRecord = record;
    group.statusClass = mostUrgentStatusClass(group.records);
    groupsByFc.set(fcCode, group);
  });

  const groups = [...groupsByFc.values()]
    .map((group) => ({ ...group, count: group.records.length }))
    .sort((a, b) => b.count - a.count || a.fc.localeCompare(b.fc, undefined, { numeric: true }));
  const missing = [...missingByFc.values()].sort((a, b) => b.count - a.count || a.fc.localeCompare(b.fc, undefined, { numeric: true }));
  return {
    groups,
    missing,
    totalRecordCount: records.length,
    mappedRecordCount: groups.reduce((total, group) => total + group.count, 0),
  };
}

function incrementCount(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function mostUrgentStatusClass(records) {
  const classes = records.map((record) => appointmentStatusClass(record.status));
  if (classes.includes("issue")) return "issue";
  if (classes.includes("pending")) return "pending";
  if (classes.includes("normal")) return "normal";
  return "done";
}

function renderMapMissingCoordinates(missing) {
  els.mapMissingCoordinates.classList.toggle("hidden", !missing.length);
  if (!missing.length) {
    els.mapMissingCoordinates.innerHTML = "";
    return;
  }
  els.mapMissingCoordinates.innerHTML = `
    <h3>Missing Coordinates</h3>
    <p>${escapeHtml(missing.reduce((total, item) => total + item.count, 0))} visible appointments are not plotted.</p>
    <div class="map-missing-list">
      ${missing.map((item) => `
        <div>
          <strong>${escapeHtml(item.fc)}</strong>
          <span>${escapeHtml(item.count)} ${item.count === 1 ? "appointment" : "appointments"}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderMapSummary(aggregation) {
  const selected = aggregation.groups.find((group) => group.fc === state.map.selectedFc) || aggregation.groups[0] || null;
  if (!selected) {
    els.mapSelectedSummary.innerHTML = `
      <h3>No FC selected</h3>
      <p>${aggregation.totalRecordCount ? "No matching mapped appointments." : "Click a marker to inspect appointments for that FC."}</p>
    `;
    return;
  }

  if (state.map.selectedFc !== selected.fc) state.map.selectedFc = selected.fc;
  els.mapSelectedSummary.innerHTML = `
    <h3>${escapeHtml(selected.fc)} <span>${escapeHtml(selected.count)}</span></h3>
    <p>${escapeHtml(compactUnique([selected.city, selected.state]).join(", ") || selected.address || "FC coordinates available")}</p>
    <dl class="map-summary-meta">
      <div><dt>Earliest ${escapeHtml(currentTimeModeLabel())}</dt><dd>${escapeHtml(selected.earliestRecord ? displayTimeText(selected.earliestRecord) : "-")}</dd></div>
      <div><dt>Status Mix</dt><dd>${escapeHtml(countMapText(selected.statusCounts))}</dd></div>
      <div><dt>Load Type Mix</dt><dd>${escapeHtml(countMapText(selected.loadTypeCounts))}</dd></div>
    </dl>
    <div class="map-fc-records">
      ${selected.records.slice(0, 8).map((record) => `
        <button class="${record.key === state.selectedKey ? "selected" : ""}" type="button" data-map-record-key="${escapeAttr(record.key)}">
          <strong>${escapeHtml(record.appointmentId || record.referenceCode || "-")}</strong>
          <span>${escapeHtml(displayTimeText(record))}</span>
        </button>
      `).join("")}
    </div>
  `;
  els.mapSelectedSummary.querySelectorAll("[data-map-record-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedKey = button.dataset.mapRecordKey;
      render();
    });
  });
}

function countMapText(counts) {
  return [...counts.entries()].map(([label, count]) => `${label}: ${count}`).join(", ") || "-";
}

function ensureMapProviderReady() {
  const config = mapConfig();
  const token = mapboxToken();
  if (!token) {
    setMapProviderMessage("Mapbox token is not configured. Copy map-config.example.js to map-config.js, set mapboxToken locally, and configure Mapbox account usage limits or billing alerts.");
    return false;
  }
  if (!window.mapboxgl) {
    setMapProviderMessage("Mapbox GL JS did not load. Table, Calendar, Timeline, import, export, and detail workflows remain available.");
    return false;
  }
  if (state.map.providerError) {
    setMapProviderMessage(state.map.providerError);
    return false;
  }
  return true;
}

function initializeMapboxMap(aggregation) {
  if (state.map.initializing || state.map.initialized) return;
  if (dailyMapboxUsage().count >= MAPBOX_DAILY_LIMIT) {
    setMapProviderMessage(`Daily local Mapbox initialization limit reached (${MAPBOX_DAILY_LIMIT}). Non-map appointment workflows remain available.`);
    return;
  }

  state.map.initializing = true;
  try {
    window.mapboxgl.accessToken = mapboxToken();
    const config = mapConfig();
    state.map.instance = new window.mapboxgl.Map({
      container: els.appointmentMapCanvas,
      style: clean(config.mapStyle) || "mapbox://styles/mapbox/satellite-streets-v12",
      projection: "globe",
      center: aggregation.groups.length ? [aggregation.groups[0].longitude, aggregation.groups[0].latitude] : CONTINENTAL_US_CAMERA.center,
      zoom: aggregation.groups.length ? 4 : CONTINENTAL_US_CAMERA.zoom,
      pitch: aggregation.groups.length ? 35 : CONTINENTAL_US_CAMERA.pitch,
      bearing: aggregation.groups.length ? -12 : CONTINENTAL_US_CAMERA.bearing,
      maxZoom: 21,
      antialias: true,
    });
    state.map.initialized = true;
    incrementDailyMapboxUsage();
    state.map.instance.addControl(new window.mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    state.map.instance.on("style.load", () => {
      state.map.instance.setFog({});
      updateMapMarkers(aggregation);
      fitMapToAggregation(aggregation, true);
    });
    state.map.instance.on("error", (event) => {
      const message = event && event.error && event.error.message ? event.error.message : "Mapbox map error.";
      state.map.providerError = message;
      setMapProviderMessage(message);
    });
    requestAnimationFrame(() => state.map.instance.resize());
    setMapProviderMessage("");
  } catch (error) {
    state.map.providerError = `Map initialization failed: ${error.message}`;
    setMapProviderMessage(state.map.providerError);
  } finally {
    state.map.initializing = false;
  }
}

function updateMapMarkers(aggregation) {
  if (!state.map.instance) return;
  state.map.markers.forEach((marker, fc) => {
    marker.remove();
    state.map.markers.delete(fc);
  });

  aggregation.groups.forEach((group) => {
    const element = buildMapMarkerElement(group);
    const marker = new window.mapboxgl.Marker({ element, anchor: "bottom" })
      .setLngLat([group.longitude, group.latitude])
      .addTo(state.map.instance);
    state.map.markers.set(group.fc, marker);
  });
}

function buildMapMarkerElement(group) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `map-marker status-${group.statusClass}${group.fc === state.map.selectedFc ? " selected" : ""}`;
  element.style.setProperty("--marker-scale", String(Math.min(1.8, 1 + Math.log10(group.count) * 0.35)));
  element.title = `${group.fc} - ${group.count} appointments`;
  element.innerHTML = `<strong>${escapeHtml(group.fc)}</strong><span>${escapeHtml(group.count)}</span>`;
  element.addEventListener("click", (event) => {
    event.stopPropagation();
    selectMapFc(group);
  });
  return element;
}

function selectMapFc(group) {
  state.map.selectedFc = group.fc;
  state.selectedKey = (group.earliestRecord || group.records[0]).key;
  render();
}

function fitMapToAggregation(aggregation, force) {
  if (!state.map.instance || !state.map.initialized) return;
  if (!force && state.map.instance.getZoom() > 5) return;
  if (!aggregation.groups.length) {
    state.map.instance.easeTo({ ...CONTINENTAL_US_CAMERA, duration: force ? 0 : 500 });
    return;
  }
  if (aggregation.groups.length === 1) {
    const group = aggregation.groups[0];
    state.map.instance.easeTo({
      center: [group.longitude, group.latitude],
      zoom: Math.max(8, state.map.instance.getZoom()),
      pitch: 45,
      bearing: -12,
      duration: force ? 0 : 500,
    });
    return;
  }
  const bounds = new window.mapboxgl.LngLatBounds();
  aggregation.groups.forEach((group) => bounds.extend([group.longitude, group.latitude]));
  state.map.instance.fitBounds(bounds, { padding: 80, maxZoom: 12, duration: force ? 0 : 500 });
}

function flyMapToSouthernCalifornia() {
  if (!state.map.instance) return;
  state.map.instance.easeTo({ ...SOUTHERN_CALIFORNIA_CAMERA, duration: 700 });
}

function setMapProviderMessage(message) {
  els.mapProviderMessage.textContent = message;
  els.mapProviderMessage.classList.toggle("hidden", !message);
}

function mapConfig() {
  return window.TMS_MAP_CONFIG || {};
}

function mapboxToken() {
  const config = mapConfig();
  return clean(config.mapboxToken || config.accessToken || config.mapboxAccessToken);
}

function dailyMapboxUsage() {
  const today = dateKey(new Date());
  try {
    const usage = JSON.parse(localStorage.getItem(MAPBOX_USAGE_STORAGE_KEY) || "{}");
    if (usage.date === today) return { date: today, count: Number(usage.count) || 0 };
  } catch (error) {
    console.warn("Mapbox usage counter unavailable.", error);
  }
  return { date: today, count: 0 };
}

function incrementDailyMapboxUsage() {
  const usage = dailyMapboxUsage();
  const next = { date: usage.date, count: usage.count + 1 };
  try {
    localStorage.setItem(MAPBOX_USAGE_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("Mapbox usage counter could not be saved.", error);
  }
  return next;
}

function calendarPrimaryLabel(record) {
  return `${record.fc || "-"} ${record.appointmentId || record.referenceCode || "-"}`;
}

function formatTimelineDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const today = dateKey(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (key === today) return "Today";
  if (key === dateKey(tomorrowDate)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function calendarTypeLabel(record) {
  return record.loadType || "Unassigned";
}

function calendarTimeLabel(value) {
  const text = clean(value);
  const match = text.match(/^\d{1,2}\/\d{1,2}\/\d{4}\s+(\d{1,2}):(\d{2})(?:\s+([A-Z]{2,4}))?/);
  if (match) {
    const [, hour, minute, zone] = match;
    const time = `${pad2(hour)}:${minute}`;
    return zone ? `${time} ${zone}` : time;
  }
  const date = parseAppointmentDate(value);
  if (!date) return text || "-";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatLosAngelesTime(value) {
  const date = parseAppointmentDate(value);
  if (!date) return "-";
  return formatLosAngelesDate(date);
}

function formatLosAngelesDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

function formatDateTimeWithZone(date) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

function renderDetail() {
  const record = getSelectedRecord();
  els.detailEmpty.classList.toggle("hidden", Boolean(record));
  els.detailForm.classList.toggle("hidden", !record);
  if (!record) return;

  els.detailFc.textContent = record.fc || "FC";
  els.detailId.textContent = record.appointmentId || record.referenceCode || "No appointment ID";
  els.detailStatus.value = record.status || "";
  els.detailLoadType.value = record.loadType || "";
  const loadTypeMeta = getLoadTypeMeta(record.loadType);
  els.detailLoadType.className = `load-type-field load-type-${loadTypeMeta.className}`;
  els.detailCrdd.value = record.crdd || "";
  els.detailSchedule.value = record.scheduleTime || "";
  els.detailNotes.value = record.notes || "";
  els.detailReference.textContent = record.referenceCode || "-";
  els.detailTrailer.textContent = record.trailer || "-";
  els.detailSource.textContent = record.source || "-";
  els.detailUpdated.textContent = record.lastUpdated ? new Date(record.lastUpdated).toLocaleString() : "-";
  renderDetailTripPlan(record);
  renderDetailChangeLog(record);
}

function renderDetailTripPlan(record) {
  const plan = tripPlanForRecord(record);
  els.detailTripPlan.classList.toggle("hidden", !plan);
  if (!plan) {
    els.detailTripPlanSummary.innerHTML = "";
    return;
  }
  const stop = plan.matchedStop || {};
  const planHref = plan.id ? `./pages/trip-plan-detail.html?id=${encodeURIComponent(plan.id)}` : "./pages/trip-plans.html";
  els.detailTripPlanSummary.innerHTML = `
    <div class="matched-plan-head">
      <span class="plan-status-dot status-${escapeAttr(tripPlanStatusClass(plan.status))}">${escapeHtml(plan.status)}</span>
      <a href="${escapeAttr(planHref)}" class="matched-plan-link">${escapeHtml(plan.name)}</a>
    </div>
    <dl class="matched-plan-meta">
      <div><dt>Type</dt><dd>${escapeHtml(plan.type || "-")}</dd></div>
      <div><dt>ETD</dt><dd>${escapeHtml(formatTripPlanEta(plan))}</dd></div>
      <div><dt>Stop</dt><dd>${escapeHtml(stop.stop_number || "-")}</dd></div>
      <div><dt>Destination</dt><dd>${escapeHtml(stop.destination || "-")}</dd></div>
      <div><dt>Transport</dt><dd>${escapeHtml(plan.transport || "-")}</dd></div>
    </dl>
  `;
}

function renderDetailChangeLog(record) {
  const logs = Array.isArray(record.changeLog) ? record.changeLog : [];
  if (!logs.length) {
    els.detailChangeLog.textContent = "No changes recorded.";
    return;
  }

  els.detailChangeLog.innerHTML = `<ul>${logs.slice(0, 20).map((entry) => {
    const when = entry.changedAt ? new Date(entry.changedAt).toLocaleString() : "-";
    const changes = (entry.changes || []).map((change) => `${change.label}: ${change.oldValue || "-"} -> ${change.newValue || "-"}`).join("; ");
    return `<li>${escapeHtml(when)} - ${escapeHtml(entry.type || "change")} - ${escapeHtml(changes)}</li>`;
  }).join("")}</ul>`;
}

function getSelectedRecord() {
  return state.records.find((record) => record.key === state.selectedKey) || null;
}

async function updateSelectedRecord(field, value) {
  const record = getSelectedRecord();
  if (!record) return;
  await updateRecordField(record, field, value, "Detail panel");
}

async function updateRecordField(record, field, value, source) {
  const previousValue = clean(record[field]);
  const nextValue = field === "loadType" ? normalizeLoadType(value) : value;
  const nextCleanValue = clean(nextValue);
  if (previousValue !== nextCleanValue) {
    const changedAt = new Date().toISOString();
    record.changeLog = [{
      id: `${changedAt}-${record.appointmentId || record.key}`,
      type: "manual",
      source,
      changedAt,
      changes: [{ field, label: fieldLabel(field), oldValue: previousValue, newValue: nextCleanValue }],
    }, ...(Array.isArray(record.changeLog) ? record.changeLog : [])].slice(0, 200);
  }
  record[field] = nextValue;
  record.lastUpdated = new Date().toISOString();
  if (["fc", "crdd", "scheduleTime", "loadType"].includes(field) && !record.appointmentId && !record.referenceCode) {
    record.key = makeKey(record);
    state.selectedKey = record.key;
  }
  await saveRecords();
  renderStats();
  renderFilterOptions();
  renderRows();
  renderViewMode();
  renderCalendar();
  renderMapView();
  renderDetail();
}

function fieldLabel(field) {
  return ({
    fc: "FC",
    status: "Status",
    scheduleTime: "Schedule Time",
    crdd: "CRDD",
    loadType: "Load Type",
    notes: "Notes",
  })[field] || field;
}

function normalizeLoadType(value) {
  const normalized = clean(value).toLowerCase();
  if (normalized === "floorload" || normalized === "floor load" || normalized === "floor loaded") return "Floorload";
  if (normalized === "palletized" || normalized === "palletizzed" || normalized === "palletised") return "Palletized";
  return "";
}

function renderLoadTypeOptions(select, firstLabel) {
  select.innerHTML = loadTypeOptionsHtml(select.value, firstLabel);
}

function loadTypeOptionsHtml(selected, firstLabel) {
  const current = normalizeLoadType(selected);
  return `<option value="">${escapeHtml(firstLabel)}</option>`
    + LOAD_TYPES.map((type) => {
      const isSelected = type.value === current ? " selected" : "";
      return `<option value="${escapeAttr(type.value)}"${isSelected}>${escapeHtml(type.label)}</option>`;
    }).join("");
}

function getLoadTypeMeta(value) {
  const normalized = normalizeLoadType(value);
  return LOAD_TYPES.find((type) => type.value === normalized) || { value: "", label: "Unassigned", className: "unassigned" };
}

async function deleteSelectedRecord() {
  const record = getSelectedRecord();
  if (!record) return;
  try {
    await deleteRecordFromApi(record);
  } catch (error) {
    console.error(error);
    setImportStatus(`TMS API delete failed: ${error.message}`);
    return;
  }
  state.records = state.records.filter((item) => item.key !== record.key);
  state.selectedKey = null;
  await saveRecords();
  render();
}

function statusClass(status) {
  const normalized = clean(status).toLowerCase();
  if (normalized.includes("defect") || normalized.includes("cancel") || normalized.includes("reject") || normalized.includes("issue") || normalized.includes("delete") || normalized.includes("removed")) return "issue";
  if (normalized.includes("close") || normalized.includes("complete") || normalized.includes("unloaded")) return "done";
  if (normalized.includes("request") || normalized.includes("pending")) return "pending";
  return "";
}

function appointmentStatusClass(status) {
  return statusClass(status) || "normal";
}

function tripPlanForRecord(record) {
  return state.tripPlansByIsa.get(clean(record.appointmentId)) || null;
}

function normalizeTripPlanStatus(status) {
  const value = clean(status);
  if (value === "Waiting") return "Pending";
  if (value === "voided" || value === "Voided") return "Cancelled";
  if (value === "Active" || !value) return "Planned";
  return TRIP_PLAN_EXECUTION_STATUSES.includes(value) || TRIP_PLAN_CONTROL_STATUSES.includes(value) ? value : value;
}

function normalizeExecutionStatus(row) {
  const value = clean(row.execution_status);
  if (TRIP_PLAN_EXECUTION_STATUSES.includes(value)) return value;
  const legacy = normalizeTripPlanStatus(row.plan_status);
  if (legacy === "Locked") return "Delivered";
  return TRIP_PLAN_EXECUTION_STATUSES.includes(legacy) ? legacy : "Planned";
}

function normalizeControlStatus(row) {
  const value = clean(row.control_status);
  if (TRIP_PLAN_CONTROL_STATUSES.includes(value)) return value;
  const legacy = clean(row.plan_status);
  if (legacy === "At Risk") return "At Risk";
  if (legacy === "Cancelled" || legacy === "voided" || legacy === "Voided") return "Cancelled";
  if (legacy === "Locked") return "Locked";
  return "Active";
}

function tripPlanStatusClass(status) {
  return clean(status).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "unknown";
}

function formatTripPlanEta(plan) {
  if (!plan.etaDate) return "-";
  const period = ETD_PERIODS[plan.etaPeriod]?.label || plan.etaPeriod || "";
  return `${plan.etaDate} ${period}`.trim();
}

function isIssueStatus(status) {
  return statusClass(status) === "issue";
}

function dateKey(date) {
  return [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate())].join("-");
}

function scheduleDateKey(value) {
  const match = clean(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return "";
  const [, month, day, year] = match;
  return [year, pad2(month), pad2(day)].join("-");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function setImportStatus(message) {
  els.importStatus.textContent = message;
}

function exportCsv() {
  const headers = ["ISA", "FC", "Status", "Schedule Time", "Los Angeles Time", "Latest Departure", "Legal Transit Hours", "CRDD", "Load Type", "Reference Code", "Trailer", "Notes", "Source", "Last Updated"];
  const rows = getFilteredRecords().map((record) => [
    record.appointmentId,
    record.fc,
    record.status,
    record.scheduleTime,
    formatLosAngelesTime(record.scheduleTime),
    latestDepartureDate(record) ? formatLosAngelesDate(latestDepartureDate(record)) : "",
    legalTransitHoursForRecord(record) ?? "",
    record.crdd,
    record.loadType,
    record.referenceCode,
    record.trailer,
    record.notes,
    record.source,
    record.lastUpdated,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `carrier-appointments-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function csvCell(value) {
  const text = clean(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((items) => items.some((item) => clean(item)));
}

async function parseXlsx(file) {
  if (!("DecompressionStream" in window)) {
    throw new Error("This browser cannot unpack XLSX files. Please use Chrome or upload CSV.");
  }

  const files = await unzipXlsx(await file.arrayBuffer());
  const sheetName = Object.keys(files).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  if (!sheetName) throw new Error("No worksheet found in XLSX.");

  const sharedStrings = parseSharedStrings(files["xl/sharedStrings.xml"]);
  return parseWorksheet(files[sheetName], sharedStrings);
}

async function unzipXlsx(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder();
  const files = {};
  let offset = centralOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Invalid XLSX central directory.");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
    offset += 46 + fileNameLength + extraLength + commentLength;

    if (!name.endsWith(".xml")) continue;
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("Invalid XLSX local file header.");
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : await inflateRaw(compressed);
    files[name] = decoder.decode(data);
  }

  return files;
}

function findEndOfCentralDirectory(view) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("Invalid XLSX file.");
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return [...doc.querySelectorAll("si")].map((item) => [...item.querySelectorAll("t")].map((part) => part.textContent || "").join(""));
}

function parseWorksheet(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const table = [];
  doc.querySelectorAll("sheetData row").forEach((rowNode) => {
    const row = [];
    rowNode.querySelectorAll("c").forEach((cellNode) => {
      const ref = cellNode.getAttribute("r") || "";
      const column = columnIndex(ref.replace(/\d+/g, "")) - 1;
      row[column] = readCellValue(cellNode, sharedStrings);
    });
    table.push(row.map((value) => value ?? ""));
  });
  return table.filter((row) => row.some((cell) => clean(cell)));
}

function readCellValue(cellNode, sharedStrings) {
  const type = cellNode.getAttribute("t");
  if (type === "inlineStr") {
    return [...cellNode.querySelectorAll("is t")].map((node) => node.textContent || "").join("");
  }
  const value = cellNode.querySelector("v")?.textContent || "";
  if (type === "s") return sharedStrings[Number(value)] || "";
  return value;
}

function columnIndex(letters) {
  return letters.split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatHours(value) {
  const hours = numberOrNull(value);
  if (hours === null) return "-";
  return `${hours.toFixed(hours >= 10 ? 1 : 2)}h`;
}

function escapeHtml(value) {
  return clean(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

boot();
