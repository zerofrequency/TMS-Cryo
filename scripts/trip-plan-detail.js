(function () {
  "use strict";

  const APPOINTMENTS_TABLE = "appointments";
  const TRIP_TABLE = "trip_plans";
  const PLAN_STATUSES = ["Planned", "Waiting", "Loading", "In Transit", "Delivered", "voided"];
  const LOAD_TYPES = [
    { value: "Floorload", label: "Floorload", className: "floorload" },
    { value: "Palletized", label: "Palletized", className: "palletized" },
  ];
  const STAGES = [
    {
      key: "planned",
      status: "Planned",
      label: "planned",
      description: "Bind ISA records and prepare inventory and carrier records before dispatch.",
    },
    {
      key: "waiting",
      status: "Waiting",
      label: "waiting",
      description: "Assign dock and loading crew resources while the truck waits for loading.",
    },
    {
      key: "loading",
      status: "Loading",
      label: "loading",
      description: "Confirm loading and release the vehicle from dock when outbound.",
    },
    {
      key: "in-transit",
      status: "In Transit",
      label: "in transit",
      description: "Review route timing now. Live transportation progress is reserved for the next workflow.",
    },
    {
      key: "delivered",
      status: "Delivered",
      label: "delivered",
      description: "Review final plan timing, stops, and notes after delivery.",
    },
    {
      key: "voided",
      status: "voided",
      label: "voided",
      description: "Review the change log and optional void reason.",
    },
  ];
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
  const RESOURCE_ENDPOINTS = {
    fleet: {
      resourceTable: "fleet_resources",
      assignmentTable: "fleet_assignments",
      resourceIdKey: "fleet_id",
      nameKey: "fleet_name",
      timeKey: "assigned_at",
    },
    dock: {
      resourceTable: "dock_resources",
      assignmentTable: "dock_assignments",
      resourceIdKey: "dock_id",
      nameKey: "dock_name",
      timeKey: "occupied_from",
    },
    crew: {
      resourceTable: "loading_crews",
      assignmentTable: "loading_crew_assignments",
      resourceIdKey: "crew_id",
      nameKey: "crew_name",
      timeKey: "assigned_at",
    },
  };

  const CREW_TASK_SLOTS = [
    { value: "09-11", label: "09:00-11:00" },
    { value: "11-13", label: "11:00-13:00" },
    { value: "13-15", label: "13:00-15:00" },
    { value: "15-17", label: "15:00-17:00" },
    { value: "17-19", label: "17:00-19:00 (Emergency)" },
    { value: "19-21", label: "19:00-21:00 (Emergency)" },
  ];

  const els = {
    planTitle: document.getElementById("planTitle"),
    planSubtitle: document.getElementById("planSubtitle"),
    editPlanLink: document.getElementById("editPlanLink"),
    cloudStatus: document.getElementById("cloudStatus"),
    stageFlow: document.getElementById("stageFlow"),
    errorState: document.getElementById("errorState"),
    errorMessage: document.getElementById("errorMessage"),
    detailContent: document.getElementById("detailContent"),
    statusBadge: document.getElementById("statusBadge"),
    overviewName: document.getElementById("overviewName"),
    overviewMeta: document.getElementById("overviewMeta"),
    stageEyebrow: document.getElementById("stageEyebrow"),
    stageTitle: document.getElementById("stageTitle"),
    stageDescription: document.getElementById("stageDescription"),
    stageBody: document.getElementById("stageBody"),
  };

  const state = {
    supabase: { url: "", key: "", enabled: false },
    planId: "",
    plan: null,
    selectedStage: "planned",
    selectedCrewSlot: "09-11",
    resources: {
      fleet: { items: [], assignments: [] },
      dock: { items: [], assignments: [] },
      crew: { items: [], assignments: [] },
    },
    appointmentsByIsa: new Map(),
    resourceError: "",
  };

  boot();

  async function boot() {
    loadSupabaseConfig();
    bindEvents();
    state.planId = new URLSearchParams(window.location.search).get("id") || "";
    if (!state.planId) {
      showError("Missing trip plan id. Open this page from Trip Plans.");
      return;
    }
    els.editPlanLink.href = `./create-trip-plans.html?edit=${encodeURIComponent(state.planId)}`;
    if (!state.supabase.enabled) {
      showError("Add Supabase URL and anon key in supabase-config.js.");
      setCloudStatus("Supabase not configured", "error");
      return;
    }
    await loadPlan();
  }

  function bindEvents() {
    els.stageFlow.addEventListener("click", (event) => {
      const button = event.target.closest("[data-stage]");
      if (!button || !state.plan) return;
      state.selectedStage = button.dataset.stage;
      render();
    });
    els.stageBody.addEventListener("click", (event) => {
      const assignButton = event.target.closest("[data-assign-resource]");
      const releaseButton = event.target.closest("[data-release-resource]");
      const cancelButton = event.target.closest("[data-cancel-resource]");
      const departButton = event.target.closest("[data-depart-loading]");
      if (assignButton) assignResource(assignButton.dataset.assignResource);
      if (releaseButton) updateResourceAssignment(releaseButton.dataset.releaseType, releaseButton.dataset.releaseResource, "Completed");
      if (cancelButton) updateResourceAssignment(cancelButton.dataset.cancelType, cancelButton.dataset.cancelResource, "Cancelled");
      if (departButton) departFromLoading();
    });

    els.stageBody.addEventListener("change", (event) => {
      if (event.target && event.target.matches("[data-crew-slot-select]")) {
        state.selectedCrewSlot = clean(event.target.value) || "09-11";
        render();
      }
    });
  }

  function loadSupabaseConfig() {
    const config = window.CARRIER_APPT_SUPABASE || {};
    state.supabase.url = clean(config.url).replace(/\/+$/, "");
    state.supabase.key = clean(config.anonKey || config.key);
    state.supabase.enabled = Boolean(state.supabase.url && state.supabase.key);
  }

  async function loadPlan() {
    try {
      setCloudStatus("Loading Supabase", "");
      const rows = await supabaseRequest(`${TRIP_TABLE}?id=eq.${encodeURIComponent(state.planId)}&select=*&limit=1`);
      if (!rows.length) {
        showError("Trip plan not found in Supabase.");
        setCloudStatus("Not found", "error");
        return;
      }
      state.plan = normalizePlan(rows[0]);
      try {
        await loadStageResources();
      } catch (resourceError) {
        console.warn(resourceError);
        state.resourceError = resourceError.message;
      }
      state.selectedStage = statusToStageKey(state.plan.status);
      setCloudStatus("Connected", "connected");
      render();
    } catch (error) {
      console.error(error);
      showError(error.message);
      setCloudStatus("Load failed", "error");
    }
  }

  async function loadStageResources() {
    const [fleetItems, fleetAssignments, dockItems, dockAssignments, crewItems, crewAssignments, appointments] = await Promise.all([
      supabaseRequest(`${RESOURCE_ENDPOINTS.fleet.resourceTable}?select=*`),
      supabaseRequest(`${RESOURCE_ENDPOINTS.fleet.assignmentTable}?select=*&order=created_at.desc`),
      supabaseRequest(`${RESOURCE_ENDPOINTS.dock.resourceTable}?select=*`),
      supabaseRequest(`${RESOURCE_ENDPOINTS.dock.assignmentTable}?select=*&order=created_at.desc`),
      supabaseRequest(`${RESOURCE_ENDPOINTS.crew.resourceTable}?select=*`),
      supabaseRequest(`${RESOURCE_ENDPOINTS.crew.assignmentTable}?select=*&order=created_at.desc`),
      supabaseRequest(`${APPOINTMENTS_TABLE}?select=isa,fc,schedule_time_raw,load_type`),
    ]);
    state.resources = {
      fleet: { items: fleetItems, assignments: fleetAssignments },
      dock: { items: dockItems, assignments: dockAssignments },
      crew: { items: crewItems, assignments: crewAssignments },
    };
    state.appointmentsByIsa = new Map(appointments.map((appointment) => [clean(appointment.isa), appointment]));
    state.resourceError = "";
  }

  function render() {
    const plan = state.plan;
    if (!plan) return;
    els.errorState.classList.add("hidden");
    els.detailContent.classList.remove("hidden");
    els.planTitle.textContent = plan.name;
    els.planSubtitle.textContent = `${plan.type || "Trip Plan"} · ${formatEta(plan)} · ${plan.stops.length} stop${plan.stops.length === 1 ? "" : "s"}`;
    els.statusBadge.textContent = plan.status;
    els.statusBadge.className = `plan-status status-${statusClass(plan.status)}`;
    els.overviewName.textContent = plan.name;
    els.overviewMeta.innerHTML = renderOverview(plan);
    renderStageFlow(plan);
    renderStageDetail(plan);
  }

  function renderStageFlow(plan) {
    const currentKey = statusToStageKey(plan.status);
    const selectedKey = state.selectedStage;
    const currentIndex = STAGES.findIndex((stage) => stage.key === currentKey);
    els.stageFlow.innerHTML = STAGES.map((stage, index) => {
      const isCurrent = stage.key === currentKey;
      const isSelected = stage.key === selectedKey;
      const isCompleted = currentKey !== "voided" && currentIndex > -1 && index < currentIndex;
      const classes = [
        "stage-step",
        stage.key === "voided" ? "voided-stage" : "",
        isCurrent ? "current" : "",
        isSelected ? "active" : "",
        isCompleted ? "completed" : "",
      ].filter(Boolean).join(" ");
      return `
        <button class="${classes}" type="button" data-stage="${escapeAttr(stage.key)}">
          <strong>${escapeHtml(stage.label)}</strong>
          <span>${isCurrent ? "current stage" : isCompleted ? "passed" : "view detail"}</span>
        </button>
      `;
    }).join("");
  }

  function renderStageDetail(plan) {
    const stage = STAGES.find((item) => item.key === state.selectedStage) || STAGES[0];
    els.stageEyebrow.textContent = stage.key === statusToStageKey(plan.status) ? "Current Stage" : "Stage Detail";
    els.stageTitle.textContent = stage.label;
    els.stageDescription.textContent = stage.description;
    if (stage.key === "planned") {
      els.stageBody.innerHTML = renderPlannedStage(plan);
      return;
    }
    if (stage.key === "waiting") {
      els.stageBody.innerHTML = renderWaitingStage(plan);
      return;
    }
    if (stage.key === "loading") {
      els.stageBody.innerHTML = renderLoadingStage(plan);
      return;
    }
    if (stage.key === "in-transit") {
      els.stageBody.innerHTML = renderInTransitStage(plan);
      return;
    }
    if (stage.key === "delivered") {
      els.stageBody.innerHTML = renderDeliveredStage(plan);
      return;
    }
    els.stageBody.innerHTML = renderVoidedStage(plan);
  }

  function renderOverview(plan) {
    return `
      ${metaRow("Status", plan.status)}
      ${metaRow("Plan Type", plan.type || "-")}
      ${metaRow("ETD", formatEta(plan))}
      ${metaRow("Plan Date", plan.planDate || "-")}
      ${metaRow("Stops", String(plan.stops.length))}
      ${metaRowHtml("Destination", renderOverviewStops(plan), "overview-destination-row")}
      ${metaRow("Carrier", activeCarrierLabel() || "-")}
      ${metaRow("Transport", plan.transport || "-")}
      ${metaRow("Truck Number", plan.truckNumber || "-")}
      ${metaRow("Trailer Number", plan.trailerNumber || "-")}
      ${metaRow("Min Buffer", formatBuffer(minBuffer(plan)))}
      ${metaRow("Updated", formatDateTime(plan.updatedAt))}
    `;
  }

  function renderPlannedStage(plan) {
    return `
      <section class="stage-section">
        <header>
          <h3>Required Records</h3>
          <span>Planned stage checklist</span>
        </header>
        <div class="requirement-grid">
          <article class="requirement-item">
            <span class="todo-chip">Pending table</span>
            <strong>Inventory</strong>
            <span>Inventory binding will be connected after the inventory module is created.</span>
          </article>
          ${renderResourceRequirement("fleet", "Carrier")}
        </div>
      </section>
      ${renderResourceAssignmentControl("fleet", "Carrier")}
      ${renderResourceAssignmentSection("fleet", "Carrier Assignment")}
    `;
  }

  function renderWaitingStage(plan) {
    return `
      <section class="stage-section">
        <header>
          <h3>Dock and Loading Crew</h3>
          <span>Waiting assignments</span>
        </header>
        <div class="requirement-grid">
          ${renderResourceRequirement("dock", "Dock Assignment")}
          ${renderResourceRequirement("crew", "Loading Crew Assignment")}
        </div>
      </section>
      ${renderResourceAssignmentControl("dock", "Dock")}
      ${renderResourceAssignmentControl("crew", "Loading Crew")}
      ${renderResourceAssignmentSection("dock", "Dock Assignment")}
      ${renderResourceAssignmentSection("crew", "Loading Crew Assignment")}
    `;
  }

  function renderLoadingStage(plan) {
    return `
      <section class="stage-section">
        <header>
          <h3>Loading</h3>
          <span>Outbound release</span>
        </header>
        <p class="muted-copy">Loading crew is assigned during the waiting stage. Release the vehicle when loading is complete.</p>
      </section>
      ${renderLoadingDepartureControl(plan)}
      ${renderResourceAssignmentSection("crew", "Loading Crew Assignment")}
    `;
  }

  function renderLoadingDepartureControl(plan) {
    const activeDock = activeResourceAssignment("dock");
    const activeCrew = activeResourceAssignment("crew");
    const alreadyDeparted = ["In Transit", "Delivered"].includes(plan.status);
    const disabled = plan.status === "voided" || alreadyDeparted;
    return `
      <section class="stage-section departure-control">
        <header>
          <h3>Outbound Release</h3>
          <span>Vehicle departure</span>
        </header>
        <div class="departure-card">
          <div>
            <strong>${alreadyDeparted ? "Vehicle already departed" : "Release vehicle from dock"}</strong>
            <span>
              ${activeDock ? "Dock will be released." : "No active dock assignment."}
              ${activeCrew ? "Crew will be released." : "No active crew assignment."}
              Trip status will move to In Transit.
            </span>
          </div>
          <button class="button primary" type="button" data-depart-loading ${disabled ? "disabled" : ""}>Depart Dock</button>
        </div>
      </section>
    `;
  }

  function renderInTransitStage(plan) {
    return `
      <section class="stage-section">
        <header>
          <h3>Transportation Progress</h3>
          <span>Pending workflow</span>
        </header>
        <dl class="stage-metrics">
          ${metaRow("Transport", plan.transport || "-")}
          ${metaRow("Truck Number", plan.truckNumber || "-")}
          ${metaRow("Trailer Number", plan.trailerNumber || "-")}
          ${metaRow("ETD", formatEta(plan))}
          ${metaRow("Destinations", compactUnique(plan.stops.map((stop) => stop.destination)).join(", ") || "-")}
          ${metaRow("Min Buffer", formatBuffer(minBuffer(plan)))}
        </dl>
        <p class="muted-copy">Live progress, check calls, and exception milestones will be added in the transportation workflow.</p>
      </section>
    `;
  }

  function renderDeliveredStage(plan) {
    return `
      <section class="stage-section">
        <header>
          <h3>Plan Review</h3>
          <span>Delivery summary</span>
        </header>
        <div class="review-list">
          <div><span>Status</span><strong>${escapeHtml(plan.status)}</strong></div>
          <div><span>ETD</span><strong>${escapeHtml(formatEta(plan))}</strong></div>
          <div><span>Stops</span><strong>${escapeHtml(String(plan.stops.length))}</strong></div>
          <div><span>Min Buffer</span><strong>${escapeHtml(formatBuffer(minBuffer(plan)))}</strong></div>
          <div><span>Transport</span><strong>${escapeHtml(plan.transport || "-")}</strong></div>
          <div><span>Truck Number</span><strong>${escapeHtml(plan.truckNumber || "-")}</strong></div>
          <div><span>Trailer Number</span><strong>${escapeHtml(plan.trailerNumber || "-")}</strong></div>
          <div><span>Notes</span><strong>${escapeHtml(plan.notes || "-")}</strong></div>
        </div>
      </section>
    `;
  }

  function renderVoidedStage(plan) {
    return `
      <section class="stage-section">
        <header>
          <h3>Void Reason</h3>
          <span>Optional</span>
        </header>
        <div class="requirement-item">
          <strong>${escapeHtml(plan.voidReason || "Not provided")}</strong>
          <span>Void reason is optional and can be added later when the void workflow is expanded.</span>
        </div>
      </section>
      <section class="stage-section">
        <header>
          <h3>Change Log</h3>
          <span>${plan.changeLog.length} entries</span>
        </header>
        ${renderChangeLog(plan.changeLog)}
      </section>
    `;
  }

  function renderOverviewStops(plan) {
    const stops = Array.isArray(plan.stops) ? plan.stops : [];
    if (!stops.length) return "-";
    return `
      <div class="overview-stop-list">
        ${stops.map((stop) => {
          const appointment = state.appointmentsByIsa.get(clean(stop.isa)) || {};
          const fc = clean(appointment.fc) || clean(stop.fc) || clean(stop.destination);
          const scheduleTime = clean(appointment.schedule_time_raw) || clean(stop.schedule_time);
          const loadType = clean(appointment.load_type) || clean(stop.load_type);
          const loadTypeMeta = getLoadTypeMeta(loadType);
          return `
            <article class="sidebar-stop-card load-type-${escapeAttr(loadTypeMeta.className)}">
              <div class="sidebar-stop-cell">
                <strong>${escapeHtml(fc || "-")}</strong>
              </div>
              <div class="sidebar-stop-cell">
                <strong class="overview-load-type">${escapeHtml(loadTypeMeta.label)}</strong>
              </div>
              <div class="sidebar-stop-cell">
                <strong>${escapeHtml(stop.isa || "-")}</strong>
              </div>
              <div class="sidebar-stop-cell">
                <strong>${escapeHtml(scheduleTime || "-")}</strong>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderResourceRequirement(type, title) {
    if (state.resourceError) {
      return `
        <article class="requirement-item">
          <span class="todo-chip">Setup needed</span>
          <strong>${escapeHtml(title)}</strong>
          <span>Run sql/supabase-resources-schema.sql to enable this resource table.</span>
        </article>
      `;
    }
    const assignment = activeResourceAssignment(type);
    const resource = assignment ? resourceForAssignment(type, assignment) : null;
    return `
      <article class="requirement-item">
        <span class="${assignment ? "ready-chip" : "todo-chip"}">${assignment ? "Assigned" : "Not assigned"}</span>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(resource ? resourceLabel(type, resource) : "No active assignment for this trip plan.")}</span>
      </article>
    `;
  }

  function renderResourceAssignmentControl(type, title) {
    if (state.resourceError) return "";
    const activeAssignment = activeResourceAssignment(type);
    if (activeAssignment) {
      const resource = resourceForAssignment(type, activeAssignment);
      return `
        <section class="stage-section assignment-control">
          <header>
            <h3>${escapeHtml(title)} Control</h3>
            <span>Active assignment</span>
          </header>
          <div class="assignment-control-card">
            <div>
              <strong>${escapeHtml(resource ? resourceLabel(type, resource) : "Assigned resource")}</strong>
              <span>${escapeHtml(formatDateTime(activeAssignment[RESOURCE_ENDPOINTS[type].timeKey] || activeAssignment.assigned_at || activeAssignment.occupied_from))}</span>
            </div>
            <div class="assignment-control-actions">
              <button class="button compact neutral" type="button" data-release-type="${escapeAttr(type)}" data-release-resource="${escapeAttr(activeAssignment.id)}">Release</button>
              <button class="button compact danger" type="button" data-cancel-type="${escapeAttr(type)}" data-cancel-resource="${escapeAttr(activeAssignment.id)}">Cancel</button>
            </div>
          </div>
        </section>
      `;
    }
    const availableResources = assignableResources(type);
    const crewSlotHtml = type === "crew" ? `
      <label>
        Task Slot
        <select data-crew-slot data-crew-slot-select>
          ${CREW_TASK_SLOTS.map((slot) => `<option value="${escapeAttr(slot.value)}"${clean(state.selectedCrewSlot) === slot.value ? " selected" : ""}>${escapeHtml(slot.label)}</option>`).join("")}
        </select>
      </label>
    ` : "";
    return `
      <section class="stage-section assignment-control">
        <header>
          <h3>Assign ${escapeHtml(title)}</h3>
          <span>${availableResources.length} available</span>
        </header>
        ${availableResources.length ? `
          <div class="assignment-form-row">
            <label>
              Resource
              <select data-resource-select="${escapeAttr(type)}">
                ${availableResources.map((resource) => `<option value="${escapeAttr(resource.id)}">${escapeHtml(resourceLabel(type, resource))}</option>`).join("")}
              </select>
            </label>
            ${crewSlotHtml}
            <label>
              Notes
              <input data-resource-notes="${escapeAttr(type)}" type="text" placeholder="Optional assignment note" />
            </label>
            <button class="button primary" type="button" data-assign-resource="${escapeAttr(type)}">Assign</button>
          </div>
        ` : `
          <p class="stage-empty">No available ${escapeHtml(title.toLowerCase())} resources. Add or reactivate resources in <a href="./resource-maintain.html?type=${escapeAttr(resourceTypeParam(type))}">Resource Maintain</a>.</p>
        `}
      </section>
    `;
  }

  function renderResourceAssignmentSection(type, title) {
    if (state.resourceError) return "";
    const assignments = planResourceAssignments(type);
    if (!assignments.length) {
      return `
        <section class="stage-section">
          <header><h3>${escapeHtml(title)}</h3><span>0 records</span></header>
          <p class="stage-empty">No ${escapeHtml(title.toLowerCase())} has been assigned to this trip plan.</p>
        </section>
      `;
    }
    return `
      <section class="stage-section">
        <header>
          <h3>${escapeHtml(title)}</h3>
          <span>${assignments.length} record${assignments.length === 1 ? "" : "s"}</span>
        </header>
        <div class="stage-record-list">
          ${assignments.map((assignment) => renderResourceAssignmentRow(type, assignment)).join("")}
        </div>
      </section>
    `;
  }

  function renderResourceAssignmentRow(type, assignment) {
    const config = RESOURCE_ENDPOINTS[type];
    const resource = resourceForAssignment(type, assignment);
    const assignedAt = clean(assignment[config.timeKey] || assignment.assigned_at || assignment.occupied_from);
    return `
      <div class="stage-record-row">
        <span>Resource</span>
        <strong>${escapeHtml(resource ? resourceLabel(type, resource) : clean(assignment[config.resourceIdKey]) || "-")}</strong>
      </div>
      <div class="stage-record-row">
        <span>Status</span>
        <strong>${escapeHtml(clean(assignment.assignment_status) || "-")} · ${escapeHtml(formatDateTime(assignedAt))}</strong>
      </div>
      <div class="stage-record-row">
        <span>Notes</span>
        <strong>${escapeHtml(clean(assignment.notes) || "-")}</strong>
      </div>
    `;
  }

  function activeResourceAssignment(type) {
    return planResourceAssignments(type).find((assignment) => clean(assignment.assignment_status) === "Active") || null;
  }

  function activeCarrierLabel() {
    const assignment = activeResourceAssignment("fleet");
    const resource = assignment ? resourceForAssignment("fleet", assignment) : null;
    return resource ? resourceLabel("fleet", resource) : "";
  }

  function resourceTypeParam(type) {
    return type === "fleet" ? "carrier" : type;
  }

  function planResourceAssignments(type) {
    return resourceAssignments(type).filter((assignment) => clean(assignment.trip_plan_id) === state.planId);
  }

  function resourceAssignments(type) {
    return (state.resources[type] && Array.isArray(state.resources[type].assignments))
      ? state.resources[type].assignments
      : [];
  }

  function resourceForAssignment(type, assignment) {
    const config = RESOURCE_ENDPOINTS[type];
    const resourceId = clean(assignment[config.resourceIdKey]);
    const items = state.resources[type] && Array.isArray(state.resources[type].items) ? state.resources[type].items : [];
    return items.find((item) => clean(item.id) === resourceId) || null;
  }

  function assignableResources(type) {
    const items = state.resources[type] && Array.isArray(state.resources[type].items) ? state.resources[type].items : [];
    const activeAssignments = resourceAssignments(type).filter((assignment) => clean(assignment.assignment_status) === "Active");
    const activeResourceIds = new Set(activeAssignments
      .filter((assignment) => clean(assignment.trip_plan_id) !== state.planId)
      .map((assignment) => clean(assignment[RESOURCE_ENDPOINTS[type].resourceIdKey])));

    // For loading crews we allow multiple active assignments as long as they are in different
    // (work_date, task_slot) pairs. So we only block crews that are already booked for the
    // current plan ETD date + selected slot.
    if (type === "crew") {
      const workDate = clean(state.plan?.etaDate);
      const slot = clean(state.selectedCrewSlot) || CREW_TASK_SLOTS[0].value;
      const booked = new Set(activeAssignments
        .filter((assignment) => clean(assignment.trip_plan_id) !== state.planId)
        .filter((assignment) => clean(assignment.work_date) === workDate && clean(assignment.task_slot) === slot)
        .map((assignment) => clean(assignment[RESOURCE_ENDPOINTS[type].resourceIdKey])));
      return items.filter((resource) => {
        if ((clean(resource.resource_status) || "Active") !== "Active") return false;
        return !booked.has(clean(resource.id));
      });
    }

    return items.filter((resource) => {
      if ((clean(resource.resource_status) || "Active") !== "Active") return false;
      if (type === "fleet") {
        const mode = clean(resource.capacity_mode) || "unlimited";
        if (mode === "unlimited") return true;
        return !activeResourceIds.has(clean(resource.id));
      }
      return !activeResourceIds.has(clean(resource.id));
    });
  }

  function resourceLabel(type, resource) {
    if (!resource) return "-";
    const config = RESOURCE_ENDPOINTS[type];
    const name = clean(resource[config.nameKey]) || "Unnamed Resource";
    if (type === "dock") return compactUnique([name, resource.dock_type, resource.fc]).join(" · ");
    if (type === "crew") return compactUnique([name, resource.lead_name, resource.shift]).join(" · ");
    return compactUnique([name, resource.fleet_type, resource.equipment_type]).join(" · ");
  }

  function renderChangeLog(changeLog) {
    const entries = Array.isArray(changeLog) ? changeLog : [];
    if (!entries.length) return '<p class="stage-empty">No changes recorded.</p>';
    return `
      <div class="log-list">
        ${entries.slice().reverse().map((entry) => `
          <article class="log-entry">
            <strong>${escapeHtml(entry.action || "Change")}</strong>
            <span>${escapeHtml(formatDateTime(entry.at))}</span>
            <p>${escapeHtml(entry.message || buildChangeMessage(entry))}</p>
          </article>
        `).join("")}
      </div>
    `;
  }

  function buildChangeMessage(entry) {
    if (entry.from || entry.to) return `${entry.from || "-"} to ${entry.to || "-"}`;
    return "";
  }

  function normalizePlan(row) {
    return {
      id: clean(row.id),
      name: clean(row.plan_name) || clean(row.plan_type) || "Untitled Plan",
      type: clean(row.plan_type),
      status: normalizeStatus(row.plan_status),
      planDate: clean(row.plan_date),
      etaDate: clean(row.etd_date),
      etaPeriod: clean(row.etd_period),
      etaAt: clean(row.etd_at),
      transport: clean(row.transport_mode),
      truckNumber: clean(row.truck_number),
      trailerNumber: clean(row.trailer_number),
      notes: clean(row.notes),
      voidReason: clean(row.void_reason || row.voided_reason || row.void_reason_text),
      stops: Array.isArray(row.stops) ? row.stops : [],
      changeLog: Array.isArray(row.change_log) ? row.change_log : [],
      updatedAt: clean(row.updated_at),
    };
  }

  function normalizeStatus(status) {
    const value = clean(status);
    if (value === "Voided") return "voided";
    if (value === "Active" || !value) return "Planned";
    return PLAN_STATUSES.includes(value) ? value : "Planned";
  }

  function statusToStageKey(status) {
    const normalized = normalizeStatus(status);
    if (normalized === "In Transit") return "in-transit";
    return normalized.toLowerCase();
  }

  async function assignResource(type) {
    const config = RESOURCE_ENDPOINTS[type];
    if (!config || !state.planId) return;
    const select = els.stageBody.querySelector(`[data-resource-select="${type}"]`);
    const notesInput = els.stageBody.querySelector(`[data-resource-notes="${type}"]`);
    const resourceId = clean(select && select.value);
    if (!resourceId) return;
    const crewSlot = type === "crew"
      ? clean(state.selectedCrewSlot)
      : "";
    const crewWorkDate = type === "crew" ? clean(state.plan?.etaDate) : "";
    if (type === "crew" && (!crewWorkDate || !crewSlot)) {
      setCloudStatus("Select a crew task slot (based on ETD date).", "error");
      return;
    }
    try {
      setCloudStatus("Assigning resource", "");
      const body = {
        trip_plan_id: state.planId,
        [config.resourceIdKey]: resourceId,
        assignment_status: "Active",
        notes: clean(notesInput && notesInput.value),
      };
      if (type === "crew") {
        body.work_date = crewWorkDate;
        body.task_slot = crewSlot;
      }
      await supabaseRequest(config.assignmentTable, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(body),
      });
      await loadStageResources();
      setCloudStatus("Resource assigned", "connected");
      render();
    } catch (error) {
      console.error(error);
      setCloudStatus(humanizeAssignmentError(type, error.message), "error");
    }
  }

  async function updateResourceAssignment(type, assignmentId, status) {
    const config = RESOURCE_ENDPOINTS[type];
    if (!config || !assignmentId) return;
    try {
      setCloudStatus("Updating assignment", "");
      await patchResourceAssignment(type, assignmentId, status);
      await loadStageResources();
      setCloudStatus("Assignment updated", "connected");
      render();
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
    }
  }

  async function departFromLoading() {
    if (!state.plan || !state.planId) return;
    const previousStatus = state.plan.status;
    const now = new Date().toISOString();
    const activeDock = activeResourceAssignment("dock");
    const activeCrew = activeResourceAssignment("crew");
    const logEntry = {
      at: now,
      action: "Vehicle departed",
      field: "plan_status",
      from: previousStatus,
      to: "In Transit",
      message: "Vehicle departed dock. Active dock and loading crew assignments were released.",
    };
    const changeLog = [...state.plan.changeLog, logEntry];
    const releaseRequests = [
      activeDock ? patchResourceAssignment("dock", activeDock.id, "Completed", now) : null,
      activeCrew ? patchResourceAssignment("crew", activeCrew.id, "Completed", now) : null,
    ].filter(Boolean);
    try {
      setCloudStatus("Departing vehicle", "");
      await Promise.all([
        ...releaseRequests,
        supabaseRequest(`${TRIP_TABLE}?id=eq.${encodeURIComponent(state.planId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            plan_status: "In Transit",
            change_log: changeLog,
            updated_at: now,
          }),
        }),
      ]);
      await loadPlan();
      state.selectedStage = "in-transit";
      setCloudStatus("Vehicle departed", "connected");
      render();
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
    }
  }

  function patchResourceAssignment(type, assignmentId, status, timestamp) {
    const config = RESOURCE_ENDPOINTS[type];
    return supabaseRequest(`${config.assignmentTable}?id=eq.${encodeURIComponent(assignmentId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        assignment_status: status,
        released_at: timestamp || new Date().toISOString(),
        updated_at: timestamp || new Date().toISOString(),
      }),
    });
  }

  function humanizeAssignmentError(type, message) {
    if (message.includes("duplicate key")) {
      if (type === "dock") return "This dock or trip plan already has an active assignment. Release the active assignment first.";
      if (type === "crew") return "This crew or trip plan already has an active assignment. Release the active assignment first.";
      return "This trip plan already has an active carrier assignment. Release the active assignment first.";
    }
    if (type === "crew" && message.toLowerCase().includes("occupied")) {
      return "This crew is already scheduled in the selected slot. Choose another slot or release the active assignment first.";
    }
    return message;
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

  function showError(message) {
    els.errorMessage.textContent = message;
    els.errorState.classList.remove("hidden");
    els.detailContent.classList.add("hidden");
    els.stageFlow.innerHTML = STAGES.map((stage) => `
      <button class="stage-step" type="button" disabled>
        <strong>${escapeHtml(stage.label)}</strong>
        <span>unavailable</span>
      </button>
    `).join("");
  }

  function metaRow(label, value) {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  function metaRowHtml(label, html, className = "") {
    return `<div class="${escapeAttr(className)}"><dt>${escapeHtml(label)}</dt><dd>${html}</dd></div>`;
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

  function minBuffer(plan) {
    const values = plan.stops
      .map((stop) => Number(stop.time_buffer_hours))
      .filter((value) => Number.isFinite(value));
    return values.length ? Math.min(...values) : null;
  }

  function statusClass(status) {
    return clean(status).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "unknown";
  }

  function normalizeLoadType(value) {
    const normalized = clean(value).toLowerCase();
    if (normalized === "floorload" || normalized === "floor load" || normalized === "floor loaded") return "Floorload";
    if (normalized === "palletized" || normalized === "palletizzed" || normalized === "palletised") return "Palletized";
    return "";
  }

  function getLoadTypeMeta(value) {
    const normalized = normalizeLoadType(value);
    return LOAD_TYPES.find((type) => type.value === normalized) || { value: "", label: "Unassigned", className: "unassigned" };
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
