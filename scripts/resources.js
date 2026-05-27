(function () {
  "use strict";

  const TRIP_TABLE = "trip_plans";
  const RESOURCE_TYPES = {
    fleet: {
      title: "Carrier",
      baseTable: "fleet_resources",
      assignmentTable: "fleet_assignments",
      resourceIdKey: "fleet_id",
      nameKey: "fleet_name",
      assignedLabel: "Assigned",
      availableLabel: "Available",
      detailKeys: ["fleet_type", "capacity_mode", "equipment_type", "home_base"],
    },
    dock: {
      title: "Dock",
      baseTable: "dock_resources",
      assignmentTable: "dock_assignments",
      resourceIdKey: "dock_id",
      nameKey: "dock_name",
      assignedLabel: "Occupied",
      availableLabel: "Available",
      detailKeys: ["dock_type", "fc", "location_note"],
    },
    crew: {
      title: "Loading Crew",
      baseTable: "loading_crews",
      assignmentTable: "loading_crew_assignments",
      resourceIdKey: "crew_id",
      nameKey: "crew_name",
      assignedLabel: "Assigned",
      availableLabel: "Available",
      detailKeys: ["lead_name", "crew_size", "shift"],
    },
  };

  const els = {
    cloudStatus: document.getElementById("cloudStatus"),
    refreshButton: document.getElementById("refreshButton"),
    totalCount: document.getElementById("totalCount"),
    availableCount: document.getElementById("availableCount"),
    inUseCount: document.getElementById("inUseCount"),
    inactiveCount: document.getElementById("inactiveCount"),
    resourceDashboard: document.getElementById("resourceDashboard"),
    viewTabs: Array.from(document.querySelectorAll("[data-view]")),
  };

  const state = {
    supabase: { url: "", key: "", enabled: false },
    resources: { fleet: [], dock: [], crew: [] },
    assignments: { fleet: [], dock: [], crew: [] },
    tripPlans: [],
    activeView: "fleet",
  };

  boot();

  async function boot() {
    loadSupabaseConfig();
    els.refreshButton.addEventListener("click", loadAll);
    els.viewTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        state.activeView = clean(tab.dataset.view) || "fleet";
        render();
      });
    });
    if (!state.supabase.enabled) {
      setCloudStatus("Add anon key in supabase-config.js", "error");
      render();
      return;
    }
    await loadAll();
  }

  function loadSupabaseConfig() {
    const config = window.CARRIER_APPT_SUPABASE || {};
    state.supabase.url = clean(config.url).replace(/\/+$/, "");
    state.supabase.key = clean(config.anonKey || config.key);
    state.supabase.enabled = Boolean(state.supabase.url && state.supabase.key);
  }

  async function loadAll() {
    try {
      setCloudStatus("Loading Supabase", "");
      const [
        fleetResources,
        fleetAssignments,
        dockResources,
        dockAssignments,
        crewResources,
        crewAssignments,
        tripPlans,
      ] = await Promise.all([
        supabaseRequest(`${RESOURCE_TYPES.fleet.baseTable}?select=*&order=created_at.desc`),
        supabaseRequest(`${RESOURCE_TYPES.fleet.assignmentTable}?select=*&order=created_at.desc`),
        supabaseRequest(`${RESOURCE_TYPES.dock.baseTable}?select=*&order=created_at.desc`),
        supabaseRequest(`${RESOURCE_TYPES.dock.assignmentTable}?select=*&order=created_at.desc`),
        supabaseRequest(`${RESOURCE_TYPES.crew.baseTable}?select=*&order=created_at.desc`),
        supabaseRequest(`${RESOURCE_TYPES.crew.assignmentTable}?select=*&order=created_at.desc`),
        supabaseRequest(`${TRIP_TABLE}?select=id,plan_name,plan_type,plan_status,etd_date,etd_period,stops&order=etd_at.asc`),
      ]);
      state.resources.fleet = fleetResources;
      state.assignments.fleet = fleetAssignments;
      state.resources.dock = dockResources;
      state.assignments.dock = dockAssignments;
      state.resources.crew = crewResources;
      state.assignments.crew = crewAssignments;
      state.tripPlans = tripPlans.map(normalizePlan);
      setCloudStatus("Connected", "connected");
      render();
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
      render();
    }
  }

  function render() {
    renderStats();
    renderTabs();
    if (state.activeView === "crew") {
      els.resourceDashboard.innerHTML = renderCrewCalendar();
      return;
    }
    if (state.activeView === "dock") {
      els.resourceDashboard.innerHTML = renderDockGrid();
      return;
    }
    els.resourceDashboard.innerHTML = renderFleetCalendar();
  }

  function renderTabs() {
    els.viewTabs.forEach((tab) => {
      tab.classList.toggle("active", clean(tab.dataset.view) === state.activeView);
    });
  }

  function renderStats() {
    const allResources = Object.keys(RESOURCE_TYPES).flatMap((type) => state.resources[type]);
    const allComputed = Object.keys(RESOURCE_TYPES).flatMap((type) => state.resources[type].map((resource) => computedStatus(type, resource)));
    els.totalCount.textContent = allResources.length;
    els.availableCount.textContent = allComputed.filter((status) => status === "Available").length;
    els.inUseCount.textContent = allComputed.filter((status) => status === "Assigned" || status === "Occupied").length;
    els.inactiveCount.textContent = allComputed.filter((status) => status === "Inactive" || status === "Maintenance").length;
  }

  function renderPanel(type) {
    const config = RESOURCE_TYPES[type];
    const resources = state.resources[type] || [];
    const available = resources.filter((resource) => computedStatus(type, resource) === "Available").length;
    const inUse = resources.filter((resource) => ["Assigned", "Occupied"].includes(computedStatus(type, resource))).length;
    return `
      <article class="resource-dashboard-panel">
        <header class="resource-panel-head">
          <div>
            <h2>${escapeHtml(config.title)}</h2>
            <p>${resources.length} total · ${available} available · ${inUse} in use</p>
          </div>
          <a class="button compact neutral" href="./resource-maintain.html?type=${escapeAttr(type)}">Maintain</a>
        </header>
        <div class="resource-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Status</th>
                <th>Planning / Occupancy</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${resources.length ? resources.map((resource) => renderResourceRow(type, resource)).join("") : `<tr><td class="empty-row" colspan="4">No ${escapeHtml(config.title.toLowerCase())} resources saved.</td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }

  function renderFleetCalendar() {
    const days = weekDays(new Date());
    const assignmentsByDay = groupAssignmentsByDay("fleet", days);
    return `
      <article class="resource-dashboard-panel">
        <header class="resource-panel-head">
          <div>
            <h2>Carrier Weekly Tasks</h2>
            <p>${formatDate(days[0])} - ${formatDate(days[6])} · Active carrier assignments by trip ETD.</p>
          </div>
          <a class="button compact neutral" href="./resource-maintain.html?type=carrier">Maintain Carrier</a>
        </header>
        <div class="resource-week-calendar">
          ${days.map((day) => renderCalendarDay("fleet", day, assignmentsByDay.get(dateKey(day)) || [])).join("")}
        </div>
      </article>
    `;
  }

  function renderCrewCalendar() {
    const days = nextDays(new Date(), 7);
    const assignmentsByDay = groupAssignmentsByDay("crew", days);
    return `
      <article class="resource-dashboard-panel">
        <header class="resource-panel-head">
          <div>
            <h2>Crew Daily Tasks</h2>
            <p>Next 7 days · Active loading crew assignments by trip ETD.</p>
          </div>
          <a class="button compact neutral" href="./resource-maintain.html?type=crew">Maintain Crew</a>
        </header>
        <div class="resource-day-list">
          ${days.map((day) => renderDailyAssignmentRow("crew", day, assignmentsByDay.get(dateKey(day)) || [])).join("")}
        </div>
      </article>
    `;
  }

  function renderDockGrid() {
    const inbound = dockSlots("inbound");
    const outbound = dockSlots("outbound");
    return `
      <article class="resource-dashboard-panel">
        <header class="resource-panel-head">
          <div>
            <h2>Dock Occupancy</h2>
            <p>10 inbound docks and 10 outbound docks. Occupied cells show the active trip plan.</p>
          </div>
          <a class="button compact neutral" href="./resource-maintain.html?type=dock">Maintain Dock</a>
        </header>
        <div class="dock-board">
          ${renderDockSection("Inbound", inbound)}
          ${renderDockSection("Outbound", outbound)}
        </div>
      </article>
    `;
  }

  function renderCalendarDay(type, day, assignments) {
    return `
      <section class="calendar-day-card">
        <header>
          <span>${weekdayLabel(day)}</span>
          <strong>${formatMonthDay(day)}</strong>
        </header>
        <div class="task-stack">
          ${assignments.length ? assignments.map((assignment) => renderTaskItem(type, assignment)).join("") : `<div class="empty-task">No tasks</div>`}
        </div>
      </section>
    `;
  }

  function renderDailyAssignmentRow(type, day, assignments) {
    return `
      <section class="daily-task-row">
        <div class="daily-task-date">
          <strong>${weekdayLabel(day)}</strong>
          <span>${formatDate(day)}</span>
        </div>
        <div class="daily-task-items">
          ${assignments.length ? assignments.map((assignment) => renderTaskItem(type, assignment)).join("") : `<div class="empty-task">No crew tasks</div>`}
        </div>
      </section>
    `;
  }

  function renderTaskItem(type, assignment) {
    const config = RESOURCE_TYPES[type];
    const resource = findResource(type, assignment[config.resourceIdKey]);
    const plan = findPlan(assignment.trip_plan_id);
    const slot = type === "crew" ? formatCrewSlot(clean(assignment.task_slot)) : "";
    return `
      <article class="resource-task-item">
        <strong>${escapeHtml(plan ? plan.name : "Unmatched Trip Plan")}</strong>
        <span>${escapeHtml(compactUnique([resource ? resourceName(type, resource) : "Unknown Resource", slot]).join(" · "))}</span>
        <small>${escapeHtml(plan ? taskPlanDetails(plan) : clean(assignment.trip_plan_id))}</small>
      </article>
    `;
  }

  function formatCrewSlot(value) {
    const slot = clean(value);
    if (!slot) return "";
    const labels = {
      "09-11": "09:00-11:00",
      "11-13": "11:00-13:00",
      "13-15": "13:00-15:00",
      "15-17": "15:00-17:00",
      "17-19": "17:00-19:00",
      "19-21": "19:00-21:00",
    };
    return labels[slot] || slot;
  }

  function renderDockSection(title, docks) {
    return `
      <section class="dock-section">
        <h3>${escapeHtml(title)}</h3>
        <div class="dock-grid">
          ${docks.map((dock, index) => renderDockCell(dock, index)).join("")}
        </div>
      </section>
    `;
  }

  function renderDockCell(dock, index) {
    if (!dock) {
      return `
        <article class="dock-cell missing">
          <strong>Dock ${index + 1}</strong>
          <span>Not created</span>
        </article>
      `;
    }
    const status = computedStatus("dock", dock);
    const assignment = activeAssignmentsForResource("dock", dock.id)[0];
    const plan = assignment ? findPlan(assignment.trip_plan_id) : null;
    return `
      <article class="dock-cell ${statusClass(status)}">
        <div>
          <strong>${escapeHtml(resourceName("dock", dock))}</strong>
          <span>${escapeHtml(clean(dock.fc) || clean(dock.dock_type) || "-")}</span>
        </div>
        <small>${escapeHtml(plan ? taskPlanDetails(plan) : status)}</small>
      </article>
    `;
  }

  function renderResourceRow(type, resource) {
    const status = computedStatus(type, resource);
    const activeAssignments = activeAssignmentsForResource(type, resource.id);
    const planning = activeAssignments.length
      ? activeAssignments.map((assignment) => {
        const plan = findPlan(assignment.trip_plan_id);
        return plan ? planLabel(plan) : clean(assignment.trip_plan_id);
      }).join("; ")
      : "No active trip plan";
    return `
      <tr>
        <td class="resource-name-cell">
          <strong>${escapeHtml(resourceName(type, resource))}</strong>
          <small>${escapeHtml(clean(resource.resource_status) || "Active")}</small>
        </td>
        <td>${statusChip(status)}</td>
        <td>${escapeHtml(planning)}</td>
        <td>${escapeHtml(resourceDetails(type, resource))}</td>
      </tr>
    `;
  }

  function computedStatus(type, resource) {
    const baseStatus = clean(resource.resource_status) || "Active";
    if (baseStatus !== "Active") return baseStatus;
    if (type === "fleet" && (clean(resource.capacity_mode) || "unlimited") === "unlimited") return RESOURCE_TYPES[type].availableLabel;
    return activeAssignmentsForResource(type, resource.id).length
      ? RESOURCE_TYPES[type].assignedLabel
      : RESOURCE_TYPES[type].availableLabel;
  }

  function activeAssignmentsForResource(type, resourceId) {
    const config = RESOURCE_TYPES[type];
    return (state.assignments[type] || []).filter((assignment) => (
      clean(assignment.assignment_status) === "Active" && clean(assignment[config.resourceIdKey]) === clean(resourceId)
    ));
  }

  function resourceName(type, resource) {
    return clean(resource[RESOURCE_TYPES[type].nameKey]) || "Unnamed Resource";
  }

  function resourceDetails(type, resource) {
    const details = RESOURCE_TYPES[type].detailKeys.map((key) => {
      if (key === "crew_size" && resource[key]) return `${resource[key]} people`;
      return clean(resource[key]);
    }).filter(Boolean);
    return details.join(" · ") || "-";
  }

  function statusChip(status) {
    return `<span class="status-chip ${statusClass(status)}">${escapeHtml(status)}</span>`;
  }

  function findPlan(planId) {
    return state.tripPlans.find((plan) => plan.id === clean(planId)) || null;
  }

  function findResource(type, resourceId) {
    return (state.resources[type] || []).find((resource) => clean(resource.id) === clean(resourceId)) || null;
  }

  function planLabel(plan) {
    const destinations = compactUnique(plan.stops.map((stop) => stop.destination)).join(", ");
    return compactUnique([plan.name, plan.status, destinations, formatEta(plan)]).join(" · ");
  }

  function taskPlanDetails(plan) {
    const destinations = compactUnique(plan.stops.map((stop) => stop.destination)).join(", ");
    return compactUnique([plan.status, destinations, formatEta(plan)]).join(" · ");
  }

  function normalizePlan(row) {
    return {
      id: clean(row.id),
      name: clean(row.plan_name) || clean(row.plan_type) || "Untitled Plan",
      type: clean(row.plan_type),
      status: clean(row.plan_status) || "Planned",
      etaDate: clean(row.etd_date),
      etaPeriod: clean(row.etd_period),
      stops: Array.isArray(row.stops) ? row.stops : [],
    };
  }

  function formatEta(plan) {
    if (!plan.etaDate) return "";
    const labels = {
      "00-03": "00:00-03:00",
      "03-06": "03:00-06:00",
      "06-09": "06:00-09:00",
      "09-12": "09:00-12:00",
      "12-15": "12:00-15:00",
      "15-18": "15:00-18:00",
      "18-21": "18:00-21:00",
      "21-24": "21:00-24:00",
      AM: "AM",
      PM: "PM",
    };
    return `${plan.etaDate} ${labels[plan.etaPeriod] || plan.etaPeriod || ""}`.trim();
  }

  function groupAssignmentsByDay(type, days) {
    const allowedDates = new Set(days.map(dateKey));
    const grouped = new Map(days.map((day) => [dateKey(day), []]));
    activeAssignments(type).forEach((assignment) => {
      const plan = findPlan(assignment.trip_plan_id);
      if (!plan || !plan.etaDate || !allowedDates.has(plan.etaDate)) return;
      grouped.get(plan.etaDate).push(assignment);
    });
    grouped.forEach((items) => {
      items.sort((a, b) => {
        const planA = findPlan(a.trip_plan_id);
        const planB = findPlan(b.trip_plan_id);
        return formatEta(planA || {}).localeCompare(formatEta(planB || {}));
      });
    });
    return grouped;
  }

  function activeAssignments(type) {
    return (state.assignments[type] || []).filter((assignment) => clean(assignment.assignment_status) === "Active");
  }

  function dockSlots(type) {
    const resources = (state.resources.dock || [])
      .filter((dock) => clean(dock.dock_type).toLowerCase() === type)
      .sort((a, b) => resourceName("dock", a).localeCompare(resourceName("dock", b), undefined, { numeric: true }));
    return Array.from({ length: 10 }, (_, index) => resources[index] || null);
  }

  function weekDays(date) {
    const start = startOfWeek(date);
    return nextDays(start, 7);
  }

  function nextDays(date, count) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: count }, (_, index) => {
      const next = new Date(start);
      next.setDate(start.getDate() + index);
      return next;
    });
  }

  function startOfWeek(date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    return start;
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function formatDate(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function formatMonthDay(date) {
    return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
  }

  function weekdayLabel(date) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
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

  function compactUnique(values) {
    return Array.from(new Set(values.map(clean).filter(Boolean)));
  }

  function statusClass(status) {
    return clean(status).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "unknown";
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
