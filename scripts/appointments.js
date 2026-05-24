const DB_NAME = "carrier-appt-manager";
const DB_VERSION = 1;
const RECORD_STORE = "appointments";
const SUPABASE_TABLE = "appointments";

const state = {
  records: [],
  lastImportChanges: [],
  supabase: {
    url: "",
    key: "",
    enabled: false,
  },
  selectedKey: null,
  viewMode: "table",
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
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
  chinaClock: document.getElementById("chinaClock"),
  laClock: document.getElementById("laClock"),
  nyClock: document.getElementById("nyClock"),
  upcomingCount: document.getElementById("upcomingCount"),
  todayCount: document.getElementById("todayCount"),
  issueCount: document.getElementById("issueCount"),
  resultCount: document.getElementById("resultCount"),
  importStatus: document.getElementById("importStatus"),
  importChanges: document.getElementById("importChanges"),
  tableViewButton: document.getElementById("tableViewButton"),
  calendarViewButton: document.getElementById("calendarViewButton"),
  tableView: document.getElementById("tableView"),
  calendarView: document.getElementById("calendarView"),
  prevMonthButton: document.getElementById("prevMonthButton"),
  nextMonthButton: document.getElementById("nextMonthButton"),
  calendarTitle: document.getElementById("calendarTitle"),
  calendarGrid: document.getElementById("calendarGrid"),
  appointmentRows: document.getElementById("appointmentRows"),
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
};

async function boot() {
  renderLoadTypeOptions(els.detailLoadType, "Unassigned");
  renderLoadTypeOptions(els.manualLoadType, "Unassigned");
  loadSupabaseConfig();
  await loadRecords();
  bindEvents();
  renderClocks();
  setInterval(renderClocks, 1000);
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
  });
  els.exportButton.addEventListener("click", exportCsv);
  els.tableViewButton.addEventListener("click", () => setViewMode("table"));
  els.calendarViewButton.addEventListener("click", () => setViewMode("calendar"));
  els.prevMonthButton.addEventListener("click", () => shiftCalendarMonth(-1));
  els.nextMonthButton.addEventListener("click", () => shiftCalendarMonth(1));
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
  if (state.supabase.enabled) {
    try {
      state.records = await loadRecordsFromSupabase();
      await saveRecordsToDb(state.records);
      setImportStatus("Loaded from Supabase. Changes are synced to cloud.");
      updateCloudStatus("Connected");
      return;
    } catch (error) {
      console.error("Supabase load failed.", error);
      setImportStatus(`Supabase load failed: ${error.message}. Loaded local backup instead.`);
      updateCloudStatus("Cloud error");
    }
  }

  try {
    state.records = await loadRecordsFromDb();
    setImportStatus("Loaded from local IndexedDB. Configure Supabase for multi-device sync.");
  } catch (error) {
    console.error("IndexedDB unavailable.", error);
    state.records = [];
    setImportStatus("IndexedDB is unavailable in this browser. Records cannot be saved.");
  }
}

async function saveRecords() {
  if (state.supabase.enabled) {
    try {
      await upsertRecordsToSupabase(state.records);
      await saveRecordsToDb(state.records);
      setImportStatus("Saved to Supabase.");
      updateCloudStatus("Connected");
      return;
    } catch (error) {
      console.error("Supabase save failed.", error);
      setImportStatus(`Supabase save failed: ${error.message}. Saved local backup only.`);
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

function loadSupabaseConfig() {
  const config = window.CARRIER_APPT_SUPABASE || {};
  state.supabase.url = clean(config.url).replace(/\/+$/, "");
  state.supabase.key = clean(config.anonKey || config.key);
  state.supabase.enabled = Boolean(state.supabase.url && state.supabase.key);
  updateCloudStatus(state.supabase.enabled ? "Configured from file" : "Local mode");
}

async function syncSupabaseNow() {
  if (!state.supabase.enabled) return;

  try {
    setImportStatus("Syncing with Supabase...");
    const remoteRecords = await loadRecordsFromSupabase();
    const remoteResult = mergeRecords(remoteRecords);
    await upsertRecordsToSupabase(state.records);
    await saveRecordsToDb(state.records);
    state.lastImportChanges = remoteResult.changes;
    setImportStatus(`Synced with Supabase. Pulled ${remoteResult.added} new, updated ${remoteResult.updated}.`);
    updateCloudStatus("Connected");
    render();
  } catch (error) {
    console.error(error);
    setImportStatus(`Supabase sync failed: ${error.message}`);
    updateCloudStatus("Cloud error");
  }
}

function updateCloudStatus(message) {
  console.info(state.supabase.enabled ? `Supabase: ${message}` : message);
}

function supabaseHeaders(extra = {}) {
  const headers = {
    apikey: state.supabase.key,
    "Content-Type": "application/json",
    ...extra,
  };
  if (state.supabase.key.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${state.supabase.key}`;
  }
  return headers;
}

function supabaseEndpoint(query = "") {
  return `${state.supabase.url}/rest/v1/${SUPABASE_TABLE}${query}`;
}

async function supabaseRequest(path, options = {}) {
  const response = await fetch(supabaseEndpoint(path), {
    ...options,
    headers: supabaseHeaders(options.headers || {}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function loadRecordsFromSupabase() {
  const rows = await supabaseRequest("?select=*&order=schedule_time_raw.asc", { method: "GET" });
  return (rows || []).map(recordFromSupabaseRow);
}

async function upsertRecordsToSupabase(records) {
  const rows = records
    .filter((record) => clean(record.appointmentId))
    .map(recordToSupabaseRow);
  if (!rows.length) return;
  await supabaseRequest("?on_conflict=isa", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
}

async function deleteRecordFromSupabase(record) {
  if (!state.supabase.enabled || !record.appointmentId) return;
  await supabaseRequest(`?isa=eq.${encodeURIComponent(record.appointmentId)}`, { method: "DELETE" });
}

function recordToSupabaseRow(record) {
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

function recordFromSupabaseRow(row) {
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
    setImportStatus(`Imported ${result.added} new, updated ${result.updated} from ${file.name}. Records are saved ${state.supabase.enabled ? "to Supabase" : "locally"}.`);
    render();
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
    const value = (label) => {
      const index = headers.indexOf(normalizeHeader(label));
      return index >= 0 ? clean(row[index]) : "";
    };

    const record = {
      fc: value("Destination FC") || value("FC"),
      appointmentId: value("Appointment ID") || value("ISA"),
      trailer: value("Trailer Number") || value("Trailer"),
      referenceCode: value("Appointment Reference Code") || value("Reference Code"),
      crdd: value("Carrier Requested Delivery Date") || value("CRDD"),
      status: value("Status"),
      scheduleTime: value("Scheduled Time") || value("Schedule Time"),
      loadType: normalizeLoadType(value("Load Type")),
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
  const changes = [];
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
        changes.push({ isa: existing.appointmentId || record.appointmentId || record.referenceCode, fc: existing.fc || record.fc, changes: recordChanges });
        updated += 1;
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
      added += 1;
    }
  });

  return { added, updated, changes };
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
  return clean(value).toLowerCase().replace(/\s+/g, " ");
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
  state.viewMode = mode;
  render();
}

function shiftCalendarMonth(offset) {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + offset, 1);
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
    const scheduleDate = parseAppointmentDate(record.scheduleTime);

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
    left = parseAppointmentDate(left)?.getTime() || 0;
    right = parseAppointmentDate(right)?.getTime() || 0;
    return (left - right) * direction;
  }
  if (state.sortKey === "laTime") {
    left = parseAppointmentDate(a.scheduleTime)?.getTime() || 0;
    right = parseAppointmentDate(b.scheduleTime)?.getTime() || 0;
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
  renderImportChanges();
  renderRows();
  renderViewMode();
  renderCalendar();
  renderDetail();
}

function renderImportChanges() {
  if (!state.lastImportChanges.length) {
    els.importChanges.classList.add("hidden");
    els.importChanges.innerHTML = "";
    return;
  }

  const items = state.lastImportChanges.slice(0, 12).map((item) => {
    const summary = item.changes.map((change) => `${change.label}: ${change.oldValue || "-"} -> ${change.newValue || "-"}`).join("; ");
    return `<li><strong>${escapeHtml(item.isa || "-")}</strong> ${escapeHtml(item.fc || "")}: ${escapeHtml(summary)}</li>`;
  }).join("");
  const more = state.lastImportChanges.length > 12 ? `<p>${state.lastImportChanges.length - 12} more updated records not shown.</p>` : "";
  els.importChanges.innerHTML = `<strong>Updated existing appointments in last import</strong><ul>${items}</ul>${more}`;
  els.importChanges.classList.remove("hidden");
}

function renderClocks() {
  const now = new Date();
  els.chinaClock.textContent = formatClock(now, "Asia/Shanghai");
  els.laClock.textContent = formatClock(now, "America/Los_Angeles");
  els.nyClock.textContent = formatClock(now, "America/New_York");
}

function formatClock(date, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

function renderStats() {
  const now = new Date();
  const todayKey = dateKey(now);
  els.totalCount.textContent = state.records.length;
  els.upcomingCount.textContent = state.records.filter((record) => {
    const date = parseAppointmentDate(record.scheduleTime);
    return date && date >= startOfDay(now);
  }).length;
  els.todayCount.textContent = state.records.filter((record) => {
    const date = parseAppointmentDate(record.scheduleTime);
    return date && dateKey(date) === todayKey;
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

function renderRows() {
  const records = getFilteredRecords();
  els.resultCount.textContent = `${records.length} visible of ${state.records.length} records`;
  els.emptyState.style.display = state.records.length ? "none" : "block";
  els.appointmentRows.innerHTML = records.map((record) => {
    const selected = record.key === state.selectedKey ? "selected" : "";
    const loadTypeMeta = getLoadTypeMeta(record.loadType);
    return `
      <tr class="${selected}" data-key="${escapeAttr(record.key)}">
        <td>${escapeHtml(record.appointmentId || record.referenceCode || "-")}</td>
        <td><strong>${escapeHtml(record.fc || "-")}</strong></td>
        <td><span class="status-pill ${statusClass(record.status)}">${escapeHtml(record.status || "Unknown")}</span></td>
        <td>${escapeHtml(record.scheduleTime || "-")}</td>
        <td>${escapeHtml(formatLosAngelesTime(record.scheduleTime))}</td>
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
  els.tableView.classList.toggle("hidden", isCalendar);
  els.calendarView.classList.toggle("hidden", !isCalendar);
  els.tableViewButton.classList.toggle("active", !isCalendar);
  els.calendarViewButton.classList.toggle("active", isCalendar);
}

function renderCalendar() {
  const records = getFilteredRecords();
  const monthStart = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth(), 1);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const monthKey = `${monthStart.getFullYear()}-${monthStart.getMonth()}`;
  const recordsByDay = new Map();

  records.forEach((record) => {
    const date = parseAppointmentDate(record.scheduleTime);
    if (!date) return;
    const key = dateKey(date);
    const items = recordsByDay.get(key) || [];
    items.push(record);
    recordsByDay.set(key, items);
  });

  els.calendarTitle.textContent = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(monthStart);

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((day) => `<div class="calendar-weekday">${day}</div>`)
    .join("");

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = dateKey(date);
    const isCurrentMonth = `${date.getFullYear()}-${date.getMonth()}` === monthKey;
    const isToday = key === dateKey(new Date());
    const appointments = (recordsByDay.get(key) || []).sort(compareRecords);
    const items = appointments.map((record) => {
      const selected = record.key === state.selectedKey ? " selected" : "";
      const loadTypeMeta = getLoadTypeMeta(record.loadType);
      const title = `${record.fc || "-"} ${record.appointmentId || record.referenceCode || "-"}`;
      return `
        <button class="calendar-appointment load-type-${escapeAttr(loadTypeMeta.className)}${selected}" type="button" data-key="${escapeAttr(record.key)}" title="${escapeAttr(title)}">
          <strong>${escapeHtml(calendarPrimaryLabel(record))}</strong>
          <small>
            <span>${escapeHtml(calendarTimeLabel(record.scheduleTime))}</span>
            <em>${escapeHtml(calendarTypeLabel(record))}</em>
          </small>
        </button>
      `;
    }).join("");
    return `
      <div class="calendar-day ${isCurrentMonth ? "" : "muted"} ${isToday ? "today" : ""}">
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

function calendarPrimaryLabel(record) {
  return `${record.fc || "-"} ${record.appointmentId || record.referenceCode || "-"}`;
}

function calendarTypeLabel(record) {
  return record.loadType || "Unassigned";
}

function calendarTimeLabel(value) {
  const text = clean(value);
  const date = parseAppointmentDate(value);
  if (!date) return text || "-";
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const zone = text.match(/\b([A-Z]{2,4})\b\s*$/)?.[1] || "";
  return zone ? `${time} ${zone}` : time;
}

function formatLosAngelesTime(value) {
  const date = parseAppointmentDate(value);
  if (!date) return "-";
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
  renderDetailChangeLog(record);
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
    await deleteRecordFromSupabase(record);
  } catch (error) {
    console.error(error);
    setImportStatus(`Supabase delete failed: ${error.message}`);
    return;
  }
  state.records = state.records.filter((item) => item.key !== record.key);
  state.selectedKey = null;
  await saveRecords();
  render();
}

function statusClass(status) {
  const normalized = clean(status).toLowerCase();
  if (normalized.includes("defect") || normalized.includes("cancel") || normalized.includes("reject") || normalized.includes("issue")) return "issue";
  if (normalized.includes("close") || normalized.includes("complete") || normalized.includes("unloaded")) return "done";
  if (normalized.includes("request") || normalized.includes("pending")) return "pending";
  return "";
}

function isIssueStatus(status) {
  return statusClass(status) === "issue";
}

function dateKey(date) {
  return [date.getFullYear(), date.getMonth(), date.getDate()].join("-");
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function setImportStatus(message) {
  els.importStatus.textContent = message;
}

function exportCsv() {
  const headers = ["ISA", "FC", "Status", "Schedule Time", "Los Angeles Time", "CRDD", "Load Type", "Reference Code", "Trailer", "Notes", "Source", "Last Updated"];
  const rows = getFilteredRecords().map((record) => [
    record.appointmentId,
    record.fc,
    record.status,
    record.scheduleTime,
    formatLosAngelesTime(record.scheduleTime),
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
