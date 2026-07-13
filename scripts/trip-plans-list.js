(function () {
  "use strict";

  const TRIP_TABLE = "trip_plans";
  const CARRIER_BILLS_TABLE = "carrier_bills";
  const EXECUTION_STATUSES = ["Planned", "Scheduled", "Pending", "Loading", "In Transit", "Delivered"];
  const CONTROL_STATUSES = ["Active", "At Risk", "Cancelled", "Locked"];
  const ETD_PERIODS = {
    "00-03": { label: "00:00-03:00", end: "03:00" },
    "03-06": { label: "03:00-06:00", end: "06:00" },
    "06-09": { label: "06:00-09:00", end: "09:00" },
    "09-12": { label: "09:00-12:00", end: "12:00" },
    "12-15": { label: "12:00-15:00", end: "15:00" },
    "15-18": { label: "15:00-18:00", end: "18:00" },
    "18-21": { label: "18:00-21:00", end: "21:00" },
    "21-24": { label: "21:00-24:00", end: "24:00" },
    AM: { label: "AM", end: "12:00" },
    PM: { label: "PM", end: "18:00" },
  };
  const els = {
    totalCount: document.getElementById("totalCount"),
    activeCount: document.getElementById("activeCount"),
    inTransitCount: document.getElementById("inTransitCount"),
    issueCount: document.getElementById("issueCount"),
    searchInput: document.getElementById("searchInput"),
    executionStatusFilter: document.getElementById("executionStatusFilter"),
    controlStatusFilter: document.getElementById("controlStatusFilter"),
    typeFilter: document.getElementById("typeFilter"),
    fromDate: document.getElementById("fromDate"),
    toDate: document.getElementById("toDate"),
    clearFilters: document.getElementById("clearFilters"),
    cloudStatus: document.getElementById("cloudStatus"),
    resultCount: document.getElementById("resultCount"),
    planRows: document.getElementById("planRows"),
    emptyState: document.getElementById("emptyState"),
    detailEmpty: document.getElementById("detailEmpty"),
    detailView: document.getElementById("detailView"),
  };

  const state = {
    apiEnabled: false,
    plans: [],
    selectedId: "",
    refreshTimer: null,
  };

  boot();

  async function boot() {
    loadApiConfig();
    bindEvents();
    fillStatusFilters();
    if (!state.apiEnabled) {
      setCloudStatus("TMS API is unavailable", "error");
      render();
      return;
    }
    await loadPlans();
  }

  function bindEvents() {
    [els.searchInput, els.executionStatusFilter, els.controlStatusFilter, els.typeFilter, els.fromDate, els.toDate].forEach((element) => {
      element.addEventListener("input", render);
      element.addEventListener("change", render);
    });
    els.clearFilters.addEventListener("click", () => {
      els.searchInput.value = "";
      els.executionStatusFilter.value = "";
      els.controlStatusFilter.value = "";
      els.typeFilter.value = "";
      els.fromDate.value = "";
      els.toDate.value = "";
      render();
    });
    els.planRows.addEventListener("click", (event) => {
      if (event.target.closest("a, button, select")) return;
      const row = event.target.closest("[data-plan-id]");
      if (!row) return;
      state.selectedId = row.dataset.planId;
      render();
    });
    els.planRows.addEventListener("change", (event) => {
      const select = event.target.closest("[data-status-plan]");
      if (select) updatePlanStatus(select.dataset.statusPlan, select.dataset.statusField, select.value);
    });
    state.refreshTimer = window.setInterval(render, 60000);
  }

  function loadApiConfig() {
    state.apiEnabled = Boolean(window.TmsApi && window.TmsApi.isConfigured());
  }

  async function loadPlans() {
    try {
      setCloudStatus("Loading TMS data", "");
      const rows = await apiRequest(`${TRIP_TABLE}?select=*&order=etd_at.desc`);
      state.plans = rows.map(normalizePlan);
      fillTypeFilter();
      if (!state.selectedId && state.plans.length) state.selectedId = state.plans[0].id;
      setCloudStatus("Connected", "connected");
      render();
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
      render();
    }
  }

  function render() {
    const filtered = filteredPlans();
    renderStats();
    renderRows(filtered);
    renderDetail();
  }

  function renderStats() {
    if (!els.totalCount || !els.activeCount || !els.inTransitCount || !els.issueCount) return;
    const activePlans = state.plans.filter((plan) => plan.controlStatus !== "Cancelled");
    els.totalCount.textContent = state.plans.length;
    els.activeCount.textContent = activePlans.length;
    els.inTransitCount.textContent = state.plans.filter((plan) => plan.executionStatus === "In Transit").length;
    els.issueCount.textContent = activePlans.filter((plan) => plan.controlStatus === "At Risk" || (minBuffer(plan) !== null && minBuffer(plan) < 0)).length;
  }

  function renderRows(plans) {
    els.resultCount.textContent = plans.length ? `${plans.length} visible of ${state.plans.length} plans` : resultEmptyLabel();
    els.emptyState.innerHTML = state.plans.length ? `
      <h3>No matching trip plans</h3>
      <p>Adjust search or clear filters to see more results.</p>
    ` : `
      <h3>No trip plans loaded</h3>
      <p>Create a trip plan to start tracking outbound dispatches.</p>
    `;
    els.emptyState.classList.toggle("hidden", plans.length > 0);
    els.planRows.innerHTML = plans.map((plan) => {
      const stops = Array.isArray(plan.stops) ? plan.stops : [];
      return `
        <tr class="${plan.id === state.selectedId ? "selected-row" : ""}" data-plan-id="${escapeAttr(plan.id)}">
          <td>
            <strong>${escapeHtml(plan.name)}</strong>
            <small>${escapeHtml(plan.planDate || "No plan date")}</small>
          </td>
          <td>
            <select class="status-select status-${statusClass(plan.executionStatus)}" data-status-plan="${escapeAttr(plan.id)}" data-status-field="execution_status" aria-label="Execution status">
              ${executionStatusOptions(plan.executionStatus)}
            </select>
          </td>
          <td>
            <select class="status-select status-${statusClass(plan.controlStatus)}" data-status-plan="${escapeAttr(plan.id)}" data-status-field="control_status" aria-label="Control status">
              ${controlStatusOptions(plan.controlStatus)}
            </select>
          </td>
          <td>${escapeHtml(plan.type || "-")}</td>
          <td>${escapeHtml(formatEta(plan))}</td>
          <td>${stops.length}</td>
          <td>${renderDestinationLines(stops)}</td>
          <td>${escapeHtml(plan.transport || "-")}</td>
          <td>${renderEquipmentLines(plan)}</td>
          <td>${renderCountdownLines(stops)}</td>
          <td>
            <div class="row-actions">
              <a class="button compact view-plan-link" href="./trip-plan-detail.html?id=${encodeURIComponent(plan.id)}">View</a>
              <a class="button compact edit-button" href="./create-trip-plans.html?edit=${encodeURIComponent(plan.id)}">Edit</a>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function resultEmptyLabel() {
    return state.plans.length ? "No matching plans" : "No plans loaded";
  }

  function renderDestinationLines(stops) {
    if (!stops.length) return "-";
    return `<div class="cell-lines">${stops.map((stop) => `
      <div class="cell-line">${escapeHtml(stop.destination || "-")}</div>
    `).join("")}</div>`;
  }

  function renderEquipmentLines(plan) {
    if (!plan.truckNumber && !plan.trailerNumber) return "-";
    return `
      <div class="cell-lines">
        <div class="cell-line">Truck: ${escapeHtml(plan.truckNumber || "-")}</div>
        <div class="cell-line">Trailer: ${escapeHtml(plan.trailerNumber || "-")}</div>
      </div>
    `;
  }

  function renderCountdownLines(stops) {
    if (!stops.length) return "-";
    return `<div class="cell-lines countdown-lines">${stops.map((stop) => {
      const countdown = stopCountdown(stop);
      return `
        <div class="cell-line countdown-line">
          <small>${escapeHtml(clean(stop.schedule_time) || "-")}</small>
          <span class="${countdownClass(countdown)}">${escapeHtml(formatCountdown(countdown))}</span>
        </div>
      `;
    }).join("")}</div>`;
  }

  function renderDetail() {
    const plan = state.plans.find((item) => item.id === state.selectedId);
    els.detailEmpty.classList.toggle("hidden", Boolean(plan));
    els.detailView.classList.toggle("hidden", !plan);
    if (!plan) {
      els.detailView.innerHTML = "";
      return;
    }
    const stops = Array.isArray(plan.stops) ? plan.stops : [];
    els.detailView.innerHTML = `
      <div class="detail-title">
        <div>
          <span class="fc-badge">${escapeHtml(plan.executionStatus)} / ${escapeHtml(plan.controlStatus)}</span>
          <h2>${escapeHtml(plan.name)}</h2>
        </div>
        <div class="detail-actions">
          <a class="button compact view-plan-link" href="./trip-plan-detail.html?id=${encodeURIComponent(plan.id)}">View</a>
          <a class="button compact edit-button" href="./create-trip-plans.html?edit=${encodeURIComponent(plan.id)}">Edit</a>
        </div>
      </div>
      <dl class="meta">
        <div><dt>Plan Type</dt><dd>${escapeHtml(plan.type || "-")}</dd></div>
        <div><dt>Execution</dt><dd>${escapeHtml(plan.executionStatus)}</dd></div>
        <div><dt>Control</dt><dd>${escapeHtml(plan.controlStatus)}</dd></div>
        <div><dt>ETD</dt><dd>${escapeHtml(formatEta(plan))}</dd></div>
        <div><dt>Plan Date</dt><dd>${escapeHtml(plan.planDate || "-")}</dd></div>
        <div><dt>Transport</dt><dd>${escapeHtml(plan.transport || "-")}</dd></div>
        <div><dt>Truck</dt><dd>${escapeHtml(plan.truckNumber || "-")}</dd></div>
        <div><dt>Trailer</dt><dd>${escapeHtml(plan.trailerNumber || "-")}</dd></div>
        <div><dt>Countdown</dt><dd>${escapeHtml(formatCountdown(nextAppointmentCountdown(plan)))}</dd></div>
        <div><dt>Updated</dt><dd>${escapeHtml(formatDateTime(plan.updatedAt))}</dd></div>
      </dl>
      <section class="trip-stops">
        <h3>Stops</h3>
        ${stops.map(renderStop).join("") || '<p class="muted-note">No stops saved.</p>'}
      </section>
      <section class="trip-log">
        <h3>Change Log</h3>
        ${renderChangeLog(plan.changeLog)}
      </section>
      ${plan.notes ? `<section class="trip-notes"><h3>Notes</h3><p>${escapeHtml(plan.notes)}</p></section>` : ""}
    `;
  }

  function renderStop(stop) {
    return `
      <article class="trip-stop">
        <header>
          <strong>Stop ${escapeHtml(stop.stop_number || "-")}</strong>
          <span class="${bufferClass(stop.time_buffer_hours)}">${escapeHtml(formatBuffer(stop.time_buffer_hours))}</span>
        </header>
        <dl>
          <div><dt>ISA / Ref</dt><dd>${escapeHtml(stop.isa || "-")}</dd></div>
          <div><dt>Destination</dt><dd>${escapeHtml(stop.destination || "-")}</dd></div>
          <div><dt>Appointment</dt><dd>${escapeHtml(stop.schedule_time || "-")}</dd></div>
          <div><dt>Countdown</dt><dd>${escapeHtml(formatCountdown(stopCountdown(stop)))}</dd></div>
          <div><dt>Legal Transit</dt><dd>${escapeHtml(formatDays(stop.transit_days))}</dd></div>
        </dl>
      </article>
    `;
  }

  function renderChangeLog(changeLog) {
    const entries = Array.isArray(changeLog) ? changeLog : [];
    if (!entries.length) return '<p class="muted-note">No changes recorded.</p>';
    return `
      <div class="trip-log-list">
        ${entries.slice().reverse().map((entry) => `
          <div class="trip-log-entry">
            <strong>${escapeHtml(entry.action || "Change")}</strong>
            <span>${escapeHtml(formatDateTime(entry.at))}</span>
            <p>${escapeHtml(entry.message || "")}</p>
          </div>
        `).join("")}
      </div>
    `;
  }

  function filteredPlans() {
    const query = clean(els.searchInput.value).toLowerCase();
    const executionStatus = els.executionStatusFilter.value;
    const controlStatus = els.controlStatusFilter.value;
    const type = els.typeFilter.value;
    const from = els.fromDate.value;
    const to = els.toDate.value;
    return state.plans.filter((plan) => {
      if (executionStatus && plan.executionStatus !== executionStatus) return false;
      if (controlStatus && plan.controlStatus !== controlStatus) return false;
      if (type && plan.type !== type) return false;
      if (from && plan.etaDate < from) return false;
      if (to && plan.etaDate > to) return false;
      if (!query) return true;
      return searchableText(plan).includes(query);
    });
  }

  function fillStatusFilters() {
    els.executionStatusFilter.innerHTML = '<option value="">All execution statuses</option>' + EXECUTION_STATUSES.map((status) => (
      `<option value="${escapeAttr(status)}">${escapeHtml(status)}</option>`
    )).join("");
    els.controlStatusFilter.innerHTML = '<option value="">All control statuses</option>' + CONTROL_STATUSES.map((status) => (
      `<option value="${escapeAttr(status)}">${escapeHtml(status)}</option>`
    )).join("");
  }

  function fillTypeFilter() {
    const types = compactUnique(state.plans.map((plan) => plan.type));
    els.typeFilter.innerHTML = '<option value="">All types</option>' + types.map((type) => (
      `<option value="${escapeAttr(type)}">${escapeHtml(type)}</option>`
    )).join("");
  }

  function normalizePlan(row) {
    return {
      id: clean(row.id),
      name: clean(row.plan_name) || clean(row.plan_type) || "Untitled Plan",
      type: clean(row.plan_type),
      executionStatus: normalizeExecutionStatus(row),
      controlStatus: normalizeControlStatus(row),
      planDate: clean(row.plan_date),
      etaDate: clean(row.etd_date),
      etaPeriod: clean(row.etd_period),
      etaAt: clean(row.etd_at),
      transport: clean(row.transport_mode),
      truckNumber: clean(row.truck_number),
      trailerNumber: clean(row.trailer_number),
      notes: clean(row.notes),
      stops: Array.isArray(row.stops) ? row.stops : [],
      changeLog: Array.isArray(row.change_log) ? row.change_log : [],
      updatedAt: clean(row.updated_at),
    };
  }

  function normalizeExecutionStatus(row) {
    const value = clean(row.execution_status);
    if (EXECUTION_STATUSES.includes(value)) return value;
    const legacy = clean(row.plan_status);
    if (legacy === "Waiting") return "Pending";
    if (legacy === "Locked") return "Delivered";
    if (EXECUTION_STATUSES.includes(legacy)) return legacy;
    return "Planned";
  }

  function normalizeControlStatus(row) {
    const value = clean(row.control_status);
    if (CONTROL_STATUSES.includes(value)) return value;
    const legacy = clean(row.plan_status);
    if (legacy === "At Risk") return "At Risk";
    if (legacy === "Cancelled" || legacy === "voided" || legacy === "Voided") return "Cancelled";
    if (legacy === "Locked") return "Locked";
    return "Active";
  }

  function searchableText(plan) {
    const stopText = (Array.isArray(plan.stops) ? plan.stops : [])
      .map((stop) => [stop.isa, stop.destination, stop.schedule_time].join(" "))
      .join(" ");
    return [plan.name, plan.type, plan.executionStatus, plan.controlStatus, plan.planDate, plan.etaDate, plan.transport, plan.truckNumber, plan.trailerNumber, stopText].join(" ").toLowerCase();
  }

  function minBuffer(plan) {
    const values = (Array.isArray(plan.stops) ? plan.stops : [])
      .map((stop) => Number(stop.time_buffer_hours))
      .filter((value) => Number.isFinite(value));
    return values.length ? Math.min(...values) : null;
  }

  async function updatePlanStatus(planId, field, nextStatus) {
    if (!state.apiEnabled || !planId) return;
    const plan = state.plans.find((item) => item.id === planId);
    const currentStatus = field === "control_status" ? plan?.controlStatus : plan?.executionStatus;
    if (!plan || currentStatus === nextStatus) return;
    const validation = validateStatusChange(plan, field, nextStatus);
    if (!validation.ok) {
      window.alert(validation.message);
      render();
      return;
    }
    const previousStatus = currentStatus;
    const reason = reasonForStatus(field, nextStatus);
    if (reason === null) {
      render();
      return;
    }
    const logEntry = {
      at: new Date().toISOString(),
      action: "Status updated",
      field,
      from: previousStatus,
      to: nextStatus,
      message: reason ? `Status changed from ${previousStatus} to ${nextStatus}. Reason: ${reason}` : `Status changed from ${previousStatus} to ${nextStatus}`,
    };
    const changeLog = [...plan.changeLog, logEntry];
    try {
      setCloudStatus("Updating status", "");
      await apiRequest(`${TRIP_TABLE}?id=eq.${encodeURIComponent(planId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          [field]: nextStatus,
          plan_status: compatibilityPlanStatus(field === "execution_status" ? nextStatus : plan.executionStatus, field === "control_status" ? nextStatus : plan.controlStatus),
          change_log: changeLog,
          updated_at: new Date().toISOString(),
        }),
      });
      if (field === "execution_status" && nextStatus === "Scheduled") await ensureDraftCarrierBill(plan);
      if (field === "execution_status") plan.executionStatus = nextStatus;
      if (field === "control_status") plan.controlStatus = nextStatus;
      plan.changeLog = changeLog;
      plan.updatedAt = logEntry.at;
      setCloudStatus("Status updated", "connected");
      render();
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
      render();
    }
  }

  function validateStatusChange(plan, field, nextStatus) {
    if (field === "execution_status" && !EXECUTION_STATUSES.includes(nextStatus)) return { ok: false, message: "Unsupported execution status." };
    if (field === "control_status" && !CONTROL_STATUSES.includes(nextStatus)) return { ok: false, message: "Unsupported control status." };
    if (field === "execution_status" && nextStatus === "Scheduled" && !planHasIsa(plan)) {
      return { ok: false, message: "Planned to Scheduled requires at least one ISA and ETD." };
    }
    if (field === "execution_status" && nextStatus === "Pending") {
      return { ok: window.confirm("Scheduled to Pending should have a carrier assignment. Continue without confirming carrier assignment?"), message: "Carrier assignment prompt cancelled." };
    }
    if (field === "execution_status" && nextStatus === "Loading") {
      return { ok: false, message: "Pending to Loading requires dock and loading crew assignment. Open the detail page to assign resources." };
    }
    if (field === "execution_status" && nextStatus === "In Transit" && (!clean(plan.truckNumber) || !clean(plan.trailerNumber))) {
      return { ok: false, message: "Loading to In Transit requires truck and trailer numbers." };
    }
    if (field === "control_status" && nextStatus === "Locked") {
      return { ok: false, message: "Locked requires Delivered execution status, POD, and paid/settled carrier bill. Use the Trip Plan detail page for this validation." };
    }
    return { ok: true, message: "" };
  }

  function reasonForStatus(field, status) {
    if (field !== "control_status" || (status !== "Cancelled" && status !== "At Risk")) return "";
    const label = status === "Cancelled" ? "cancellation reason" : "risk reason";
    const reason = clean(window.prompt(`Enter ${label}:`));
    if (!reason) {
      window.alert(`${status} requires a ${label}.`);
      return null;
    }
    return reason;
  }

  function planHasIsa(plan) {
    return (Array.isArray(plan.stops) ? plan.stops : []).some((stop) => clean(stop.isa));
  }

  async function ensureDraftCarrierBill(plan) {
    const existing = await apiRequest(`${CARRIER_BILLS_TABLE}?trip_plan_id=eq.${encodeURIComponent(plan.id)}&select=id,billing_status&limit=1`);
    if (existing.length) return;
    await apiRequest(CARRIER_BILLS_TABLE, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        trip_plan_id: plan.id,
        billing_status: "Draft",
        carrier_name: "",
        notes: "Auto-created when trip plan was scheduled.",
        updated_at: new Date().toISOString(),
      }),
    });
  }

  function apiRequest(path, options = {}) {
    return window.TmsApi.request(path, options);
  }

  function setCloudStatus(message, type) {
    els.cloudStatus.textContent = message;
    els.cloudStatus.classList.toggle("connected-text", type === "connected");
    els.cloudStatus.classList.toggle("error-text", type === "error");
  }

  function formatEta(plan) {
    if (!plan.etaDate) return "--";
    const period = ETD_PERIODS[plan.etaPeriod];
    if (!period) return `${plan.etaDate} ${plan.etaPeriod || ""}`.trim();
    return `${plan.etaDate} ${period.label}`;
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatDays(value) {
    if (value === null || value === undefined || value === "") return "-";
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return `${number.toFixed(number % 1 ? 2 : 0)}d`;
  }

  function formatBuffer(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
    const number = Number(value);
    return `${number >= 0 ? "+" : ""}${number.toFixed(1)}h`;
  }

  function nextAppointmentCountdown(plan) {
    const countdowns = (Array.isArray(plan.stops) ? plan.stops : [])
      .map(stopCountdown)
      .filter((value) => value !== null);
    if (!countdowns.length) return null;
    return countdowns.reduce((nearest, current) => Math.abs(current) < Math.abs(nearest) ? current : nearest);
  }

  function stopCountdown(stop) {
    const date = parseCarrierTime(stop.schedule_time);
    if (!date) return null;
    return date.getTime() - Date.now();
  }

  function formatCountdown(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
    const milliseconds = Number(value);
    const absoluteMinutes = Math.max(0, Math.round(Math.abs(milliseconds) / 60000));
    const days = Math.floor(absoluteMinutes / 1440);
    const hours = Math.floor((absoluteMinutes % 1440) / 60);
    const minutes = absoluteMinutes % 60;
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    return milliseconds < 0 ? `Overdue ${parts.join(" ")}` : parts.join(" ");
  }

  function countdownClass(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "countdown-neutral";
    const hours = Number(value) / 3600000;
    if (hours < 0) return "countdown-overdue";
    if (hours <= 24) return "countdown-warning";
    return "countdown-ok";
  }

  function parseCarrierTime(value) {
    const text = clean(value);
    if (!text) return null;
    const normalized = text.replace(/\b(MST|MDT|PST|PDT|CST|CDT|EST|EDT)\b/g, (tz) => ({
      MST: "-07:00",
      MDT: "-06:00",
      PST: "-08:00",
      PDT: "-07:00",
      CST: "-06:00",
      CDT: "-05:00",
      EST: "-05:00",
      EDT: "-04:00",
    })[tz] || tz);
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([+-]\d{2}:\d{2})?$/.exec(normalized);
    if (!match) return null;
    const [, month, day, year, hour, minute, offset = "-07:00"] = match;
    return new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00${offset}`);
  }

  function bufferClass(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "buffer-neutral";
    const number = Number(value);
    if (number >= 24) return "buffer-ok";
    if (number >= 0) return "buffer-warning";
    return "buffer-issue";
  }

  function statusClass(status) {
    return clean(status).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "unknown";
  }

  function executionStatusOptions(selectedStatus) {
    return EXECUTION_STATUSES.map((status) => (
      `<option value="${escapeAttr(status)}" ${status === selectedStatus ? "selected" : ""}>${escapeHtml(status)}</option>`
    )).join("");
  }

  function controlStatusOptions(selectedStatus) {
    return CONTROL_STATUSES.map((status) => (
      `<option value="${escapeAttr(status)}" ${status === selectedStatus ? "selected" : ""}>${escapeHtml(status)}</option>`
    )).join("");
  }

  function compatibilityPlanStatus(executionStatus, controlStatus) {
    if (controlStatus === "Cancelled" || controlStatus === "At Risk" || controlStatus === "Locked") return controlStatus;
    return executionStatus || "Planned";
  }

  function compactUnique(values) {
    return Array.from(new Set(values.map(clean).filter(Boolean)));
  }

  function clean(value) {
    return value === null || value === undefined ? "" : String(value).trim();
  }

  function escapeHtml(value) {
    return clean(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[char]);
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }
})();
