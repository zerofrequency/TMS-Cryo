(function () {
  "use strict";

  const TRIP_TABLE = "trip_plans";
  const PLAN_STATUSES = ["Planned", "Waiting", "Loading", "In Transit", "Delivered", "voided"];
  const els = {
    totalCount: document.getElementById("totalCount"),
    activeCount: document.getElementById("activeCount"),
    inTransitCount: document.getElementById("inTransitCount"),
    issueCount: document.getElementById("issueCount"),
    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),
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
    supabase: { url: "", key: "", enabled: false },
    plans: [],
    selectedId: "",
  };

  boot();

  async function boot() {
    loadSupabaseConfig();
    bindEvents();
    fillStatusFilter();
    if (!state.supabase.enabled) {
      setCloudStatus("Add anon key in supabase-config.js", "error");
      render();
      return;
    }
    await loadPlans();
  }

  function bindEvents() {
    [els.searchInput, els.statusFilter, els.typeFilter, els.fromDate, els.toDate].forEach((element) => {
      element.addEventListener("input", render);
      element.addEventListener("change", render);
    });
    els.clearFilters.addEventListener("click", () => {
      els.searchInput.value = "";
      els.statusFilter.value = "";
      els.typeFilter.value = "";
      els.fromDate.value = "";
      els.toDate.value = "";
      render();
    });
    els.planRows.addEventListener("click", (event) => {
      const row = event.target.closest("[data-plan-id]");
      if (!row) return;
      state.selectedId = row.dataset.planId;
      render();
    });
  }

  function loadSupabaseConfig() {
    const config = window.CARRIER_APPT_SUPABASE || {};
    state.supabase.url = clean(config.url).replace(/\/+$/, "");
    state.supabase.key = clean(config.anonKey || config.key);
    state.supabase.enabled = Boolean(state.supabase.url && state.supabase.key);
  }

  async function loadPlans() {
    try {
      setCloudStatus("Loading Supabase", "");
      const rows = await supabaseRequest(`${TRIP_TABLE}?select=*&order=eta_at.desc`);
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
    const activePlans = state.plans.filter((plan) => plan.status !== "voided");
    els.totalCount.textContent = state.plans.length;
    els.activeCount.textContent = activePlans.length;
    els.inTransitCount.textContent = state.plans.filter((plan) => plan.status === "In Transit").length;
    els.issueCount.textContent = activePlans.filter((plan) => minBuffer(plan) !== null && minBuffer(plan) < 0).length;
  }

  function renderRows(plans) {
    els.resultCount.textContent = plans.length ? `${plans.length} visible of ${state.plans.length} plans` : "No matching plans";
    els.emptyState.classList.toggle("hidden", plans.length > 0);
    els.planRows.innerHTML = plans.map((plan) => {
      const stops = Array.isArray(plan.stops) ? plan.stops : [];
      const destinations = compactUnique(stops.map((stop) => stop.destination)).join(", ") || "-";
      const buffer = minBuffer(plan);
      return `
        <tr class="${plan.id === state.selectedId ? "selected-row" : ""}" data-plan-id="${escapeAttr(plan.id)}">
          <td>
            <strong>${escapeHtml(plan.name)}</strong>
            <small>${escapeHtml(plan.planDate || "No plan date")}</small>
          </td>
          <td><span class="plan-status status-${statusClass(plan.status)}">${escapeHtml(plan.status)}</span></td>
          <td>${escapeHtml(plan.type || "-")}</td>
          <td>${escapeHtml(formatEta(plan))}</td>
          <td>${stops.length}</td>
          <td>${escapeHtml(destinations)}</td>
          <td>${escapeHtml(plan.transport || "-")}</td>
          <td><span class="${bufferClass(buffer)}">${escapeHtml(formatBuffer(buffer))}</span></td>
        </tr>
      `;
    }).join("");
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
          <span class="fc-badge">${escapeHtml(plan.status)}</span>
          <h2>${escapeHtml(plan.name)}</h2>
        </div>
      </div>
      <dl class="meta">
        <div><dt>Plan Type</dt><dd>${escapeHtml(plan.type || "-")}</dd></div>
        <div><dt>ETA</dt><dd>${escapeHtml(formatEta(plan))}</dd></div>
        <div><dt>Plan Date</dt><dd>${escapeHtml(plan.planDate || "-")}</dd></div>
        <div><dt>Transport</dt><dd>${escapeHtml(plan.transport || "-")}</dd></div>
        <div><dt>Min Buffer</dt><dd>${escapeHtml(formatBuffer(minBuffer(plan)))}</dd></div>
        <div><dt>Updated</dt><dd>${escapeHtml(formatDateTime(plan.updatedAt))}</dd></div>
      </dl>
      <section class="trip-stops">
        <h3>Stops</h3>
        ${stops.map(renderStop).join("") || '<p class="muted-note">No stops saved.</p>'}
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
          <div><dt>Transit</dt><dd>${escapeHtml(formatDays(stop.transit_days))}</dd></div>
        </dl>
      </article>
    `;
  }

  function filteredPlans() {
    const query = clean(els.searchInput.value).toLowerCase();
    const status = els.statusFilter.value;
    const type = els.typeFilter.value;
    const from = els.fromDate.value;
    const to = els.toDate.value;
    return state.plans.filter((plan) => {
      if (status && plan.status !== status) return false;
      if (type && plan.type !== type) return false;
      if (from && plan.etaDate < from) return false;
      if (to && plan.etaDate > to) return false;
      if (!query) return true;
      return searchableText(plan).includes(query);
    });
  }

  function fillStatusFilter() {
    els.statusFilter.innerHTML = '<option value="">All statuses</option>' + PLAN_STATUSES.map((status) => (
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
      status: normalizeStatus(row.plan_status),
      planDate: clean(row.plan_date),
      etaDate: clean(row.eta_date),
      etaPeriod: clean(row.eta_period),
      etaAt: clean(row.eta_at),
      transport: clean(row.transport_mode),
      notes: clean(row.notes),
      stops: Array.isArray(row.stops) ? row.stops : [],
      updatedAt: clean(row.updated_at),
    };
  }

  function normalizeStatus(status) {
    const value = clean(status);
    if (value === "Voided") return "voided";
    if (value === "Active" || !value) return "Planned";
    return value;
  }

  function searchableText(plan) {
    const stopText = (Array.isArray(plan.stops) ? plan.stops : [])
      .map((stop) => [stop.isa, stop.destination, stop.schedule_time].join(" "))
      .join(" ");
    return [plan.name, plan.type, plan.status, plan.planDate, plan.etaDate, plan.transport, stopText].join(" ").toLowerCase();
  }

  function minBuffer(plan) {
    const values = (Array.isArray(plan.stops) ? plan.stops : [])
      .map((stop) => Number(stop.time_buffer_hours))
      .filter((value) => Number.isFinite(value));
    return values.length ? Math.min(...values) : null;
  }

  async function supabaseRequest(path, options = {}) {
    const response = await fetch(`${state.supabase.url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: state.supabase.key,
        Authorization: `Bearer ${state.supabase.key}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Supabase request failed: ${response.status}`);
    }
    if (response.status === 204) return [];
    const text = await response.text();
    return text ? JSON.parse(text) : [];
  }

  function setCloudStatus(message, type) {
    els.cloudStatus.textContent = message;
    els.cloudStatus.classList.toggle("connected-text", type === "connected");
    els.cloudStatus.classList.toggle("error-text", type === "error");
  }

  function formatEta(plan) {
    if (!plan.etaDate) return "--";
    const time = plan.etaPeriod === "PM" ? "18:00" : "12:00";
    return `${plan.etaDate} ${plan.etaPeriod || ""} ${time}`.trim();
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
