(function () {
  "use strict";

  const APPOINTMENTS_TABLE = "appointments";
  const FC_TABLE = "fba_fcs";
  const TRIP_TABLE = "trip_plans";
  const BINDINGS_TABLE = "trip_plan_isa_bindings";
  const els = {
    cloudStatus: document.getElementById("cloudStatus"),
    tripForm: document.getElementById("tripForm"),
    planName: document.getElementById("planName"),
    planType: document.getElementById("planType"),
    planDate: document.getElementById("planDate"),
    etaDate: document.getElementById("etaDate"),
    etaPeriod: document.getElementById("etaPeriod"),
    transportMode: document.getElementById("transportMode"),
    truckNumber: document.getElementById("truckNumber"),
    trailerNumber: document.getElementById("trailerNumber"),
    stopsContainer: document.getElementById("stopsContainer"),
    planNotes: document.getElementById("planNotes"),
    saveTripPlanButton: document.getElementById("saveTripPlanButton"),
    clearFormButton: document.getElementById("clearFormButton"),
    calendarSummary: document.getElementById("calendarSummary"),
    calendarGrid: document.getElementById("calendarGrid"),
    stopTemplate: document.getElementById("stopTemplate"),
    appointmentModal: document.getElementById("appointmentModal"),
    appointmentModalTitle: document.getElementById("appointmentModalTitle"),
    appointmentModalSubtitle: document.getElementById("appointmentModalSubtitle"),
    appointmentModalBody: document.getElementById("appointmentModalBody"),
    closeAppointmentModal: document.getElementById("closeAppointmentModal"),
  };

  const state = {
    supabase: { url: "", key: "", enabled: false },
    appointments: [],
    fcs: new Map(),
    plans: [],
    calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    timelineAutoScrolled: false,
    editingPlanId: "",
    editApplied: false,
    planNameTouched: false,
    updatingPlanName: false,
    planNameSuffix: randomNameSuffix(),
  };
  const ETD_PERIODS = {
    "00-03": { label: "00:00-03:00", endHour: 3 },
    "03-06": { label: "03:00-06:00", endHour: 6 },
    "06-09": { label: "06:00-09:00", endHour: 9 },
    "09-12": { label: "09:00-12:00", endHour: 12 },
    "12-15": { label: "12:00-15:00", endHour: 15 },
    "15-18": { label: "15:00-18:00", endHour: 18 },
    "18-21": { label: "18:00-21:00", endHour: 21 },
    "21-24": { label: "21:00-24:00", endHour: 24 },
    AM: { label: "AM", endHour: 12 },
    PM: { label: "PM", endHour: 18 },
  };
  boot();

  async function boot() {
    loadSupabaseConfig();
    state.editingPlanId = new URLSearchParams(window.location.search).get("edit") || "";
    bindEvents();
    const today = new Date().toISOString().slice(0, 10);
    els.planDate.value = today;
    els.etaDate.value = today;
    renderStops();
    if (!state.supabase.enabled) {
      setCloudStatus("Add anon key in supabase-config.js", "error");
      renderAppointmentCalendar();
      return;
    }
    await loadData();
  }

  function bindEvents() {
    els.planType.addEventListener("change", renderStops);
    els.planName.addEventListener("input", () => {
      if (!state.updatingPlanName) {
        state.planNameTouched = Boolean(clean(els.planName.value));
        els.planName.dataset.autoName = "false";
      }
    });
    els.etaDate.addEventListener("change", () => {
      updateBuffers();
      updateDefaultPlanName();
    });
    els.etaPeriod.addEventListener("change", updateBuffers);
    els.tripForm.addEventListener("submit", saveTripPlan);
    els.clearFormButton.addEventListener("click", clearForm);
    els.closeAppointmentModal.addEventListener("click", closeAppointmentModal);
    els.appointmentModal.addEventListener("click", (event) => {
      if (event.target === els.appointmentModal) closeAppointmentModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.appointmentModal.classList.contains("hidden")) {
        closeAppointmentModal();
      }
    });
  }

  function loadSupabaseConfig() {
    const config = window.CARRIER_APPT_SUPABASE || {};
    state.supabase.url = clean(config.url).replace(/\/+$/, "");
    state.supabase.key = clean(config.anonKey || config.key);
    state.supabase.enabled = Boolean(state.supabase.url && state.supabase.key);
  }

  async function loadData() {
    try {
      setCloudStatus("Loading Supabase", "");
      const [appointments, fcs] = await Promise.all([
        supabaseRequest(`${APPOINTMENTS_TABLE}?select=*&order=schedule_time_raw.asc`),
        supabaseRequest(`${FC_TABLE}?select=*`),
      ]);
      state.appointments = appointments.map(recordFromAppointmentRow).filter((appt) => appt.isa);
      state.fcs = new Map(fcs.map((fc) => [clean(fc.fc), fc]));
      renderStops();
      renderAppointmentCalendar();
      await loadPlans();
      applyEditPlanFromUrl();
      setCloudStatus("Connected", "connected");
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
    }
  }

  async function loadPlans() {
    if (!state.supabase.enabled) return;
    try {
      state.plans = await supabaseRequest(`${TRIP_TABLE}?select=*&order=etd_at.desc`);
      applyEditPlanFromUrl();
      renderAppointmentCalendar();
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
    }
  }

  function renderStops() {
    const stopCount = selectedStopCount();
    els.stopsContainer.innerHTML = "";
    for (let index = 0; index < stopCount; index += 1) {
      const node = els.stopTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.index = String(index);
      node.querySelector("h3").textContent = `Stop ${index + 1}`;
      const isaInput = node.querySelector(".stop-isa");
      const isaOptions = node.querySelector(".stop-isa-options");
      const optionsId = `stopIsaOptions${index}`;
      isaInput.setAttribute("list", optionsId);
      isaOptions.id = optionsId;
      isaOptions.innerHTML = appointmentOptions();
      els.stopsContainer.appendChild(node);
      bindStopEvents(node);
      applyAppointmentToStop(node);
    }
    updateBuffers();
    updateDefaultPlanName();
  }

  function bindStopEvents(node) {
    node.addEventListener("dragover", (event) => {
      event.preventDefault();
      node.classList.add("drop-target");
    });
    node.addEventListener("dragleave", () => {
      node.classList.remove("drop-target");
    });
    node.addEventListener("drop", (event) => {
      event.preventDefault();
      node.classList.remove("drop-target");
      const isa = event.dataTransfer.getData("text/plain");
      bindAppointmentToStop(node, isa);
    });
    node.querySelector(".stop-source").addEventListener("change", () => {
      updateStopMode(node);
      updateBuffers();
      updateDefaultPlanName();
    });
    node.querySelector(".stop-isa").addEventListener("input", () => {
      applyAppointmentToStop(node);
      updateBuffers();
      updateDefaultPlanName();
    });
    node.querySelector(".stop-isa").addEventListener("change", () => {
      applyAppointmentToStop(node);
      updateBuffers();
      updateDefaultPlanName();
    });
    [".stop-schedule", ".stop-transit"].forEach((selector) => {
      node.querySelector(selector).addEventListener("input", updateBuffers);
    });
    [".manual-isa", ".stop-destination"].forEach((selector) => {
      node.querySelector(selector).addEventListener("input", updateDefaultPlanName);
    });
  }

  function updateStopMode(node) {
    const isPrivate = node.querySelector(".stop-source").value === "private";
    node.querySelector(".appointment-field").classList.toggle("hidden", isPrivate);
    node.querySelector(".private-field").classList.toggle("hidden", !isPrivate);
    node.querySelector(".stop-isa").required = !isPrivate;
    node.querySelector(".manual-isa").required = isPrivate;
    if (isPrivate) renderAppointmentContext(node, null);
    if (!isPrivate) applyAppointmentToStop(node);
  }

  function applyAppointmentToStop(node) {
    if (node.querySelector(".stop-source").value !== "appointment") return;
    const appt = appointmentByIsa(node.querySelector(".stop-isa").value);
    renderAppointmentContext(node, appt);
    if (!appt) return;
    const fc = state.fcs.get(appt.fc);
    node.querySelector(".stop-destination").value = appt.fc || "";
    node.querySelector(".stop-schedule").value = appt.scheduleTime || "";
    node.querySelector(".stop-transit").value = fc?.transit_days ?? "";
    updateDefaultPlanName();
  }

  function renderAppointmentContext(node, appt) {
    const context = node.querySelector(".appointment-context");
    if (!context) return;
    context.classList.toggle("hidden", !appt);
    if (!appt) {
      context.innerHTML = "";
      return;
    }
    context.innerHTML = `
      <div>
        <span>FC</span>
        <strong>${escapeHtml(appt.fc || "-")}</strong>
      </div>
      <div>
        <span>Schedule</span>
        <strong>${escapeHtml(appt.scheduleTime || "-")}</strong>
      </div>
      <div>
        <span>Load Type</span>
        <strong>${escapeHtml(appt.loadType || "-")}</strong>
      </div>
    `;
  }

  function bindAppointmentToStop(node, isa) {
    const appt = appointmentByIsa(isa);
    if (!appt) return;
    node.querySelector(".stop-source").value = "appointment";
    updateStopMode(node);
    node.querySelector(".stop-isa").value = appt.isa;
    applyAppointmentToStop(node);
    updateBuffers();
    updateDefaultPlanName();
    setCloudStatus(`Bound ISA ${appt.isa} to ${node.querySelector("h3").textContent}`, "connected");
  }

  function appointmentOptions() {
    if (!state.appointments.length) return "";
    return state.appointments.map((appt) => {
      const label = `${escapeHtml(appt.isa)} · ${escapeHtml(appt.fc || "No FC")} · ${escapeHtml(appt.scheduleTime || "No schedule")}`;
      return `<option value="${escapeAttr(appt.isa)}" label="${escapeAttr(label)}"></option>`;
    }).join("");
  }

  function selectedStopCount() {
    const option = els.planType.selectedOptions[0];
    return Number(option?.dataset.stops || 1);
  }

  async function saveTripPlan(event) {
    event.preventDefault();
    if (!state.supabase.enabled) {
      setCloudStatus("Supabase is required for trip plans", "error");
      return;
    }
    const stops = collectStops();
    if (!stops.length) return;
    const missingStop = stops.find((stop) => !stop.source || !stop.isa || !stop.destination || !stop.schedule_time);
    if (missingStop) {
      setCloudStatus(`Stop ${missingStop.stop_number} needs source, ISA, destination, and appointment time`, "error");
      return;
    }
    const invalidStop = stops.find((stop) => stop.source === "appointment" && !appointmentByIsa(stop.isa));
    if (invalidStop) {
      setCloudStatus(`Stop ${invalidStop.stop_number} needs a valid appointment ISA`, "error");
      return;
    }
    const duplicate = findActiveIsaConflict(stops);
    if (duplicate) {
      setCloudStatus(`ISA ${duplicate.isa} is already bound to active plan: ${duplicate.planName}`, "error");
      return;
    }
    const etaAt = etaDateTime().toISOString();
    const payload = {
      plan_name: clean(els.planName.value) || generateDefaultPlanName(stops),
      plan_type: els.planType.value,
      plan_status: currentEditingPlan()?.plan_status || "Planned",
      plan_date: els.planDate.value || null,
      etd_date: els.etaDate.value,
      etd_period: els.etaPeriod.value,
      etd_at: etaAt,
      transport_mode: clean(els.transportMode.value),
      truck_number: clean(els.truckNumber.value),
      trailer_number: clean(els.trailerNumber.value),
      notes: clean(els.planNotes.value),
      stops,
      updated_at: new Date().toISOString(),
    };

    try {
      if (state.editingPlanId) {
        await supabaseRequest(`${TRIP_TABLE}?id=eq.${encodeURIComponent(state.editingPlanId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });
        await syncIsaBindings(state.editingPlanId, stops, payload.plan_status);
        setCloudStatus("Trip plan updated", "connected");
      } else {
        const inserted = await supabaseRequest(TRIP_TABLE, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
        const planId = clean(inserted?.[0]?.id);
        if (planId) await syncIsaBindings(planId, stops, payload.plan_status);
        setCloudStatus("Trip plan saved", "connected");
      }
      await loadPlans();
      if (!state.editingPlanId) clearForm();
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
    }
  }

  async function syncIsaBindings(planId, stops, planStatus) {
    if (!state.supabase.enabled || !planId) return;
    if (normalizePlanStatus(planStatus) === "voided") return;

    const desiredIsas = compactUnique((Array.isArray(stops) ? stops : [])
      .filter((stop) => clean(stop.source) === "appointment")
      .map((stop) => clean(stop.isa))
      .filter(Boolean));

    const existing = await supabaseRequest(`${BINDINGS_TABLE}?trip_plan_id=eq.${encodeURIComponent(planId)}&select=*`);
    const byIsa = new Map(existing.map((row) => [clean(row.isa), row]));

    const toReleaseRows = existing.filter((row) => (
      clean(row.binding_status) === "active" && !desiredIsas.includes(clean(row.isa))
    ));
    for (const row of toReleaseRows) {
      await supabaseRequest(`${BINDINGS_TABLE}?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ binding_status: "released", updated_at: new Date().toISOString() }),
      });
    }

    for (const isa of desiredIsas) {
      const row = byIsa.get(isa);
      if (row) {
        if (clean(row.binding_status) !== "active") {
          await supabaseRequest(`${BINDINGS_TABLE}?id=eq.${encodeURIComponent(row.id)}`, {
            method: "PATCH",
            headers: { Prefer: "return=minimal" },
            body: JSON.stringify({ binding_status: "active", updated_at: new Date().toISOString() }),
          });
        }
        continue;
      }
      try {
        await supabaseRequest(BINDINGS_TABLE, {
          method: "POST",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ isa, trip_plan_id: planId, binding_status: "active", updated_at: new Date().toISOString() }),
        });
      } catch (error) {
        const msg = String(error && error.message ? error.message : error);
        if (msg.includes("trip_plan_isa_bindings_one_active_isa_idx") || msg.toLowerCase().includes("duplicate key")) {
          throw new Error(`ISA ${isa} is already bound to another active trip plan (void the plan to rebind).`);
        }
        throw error;
      }
    }
  }

  function collectStops() {
    return Array.from(els.stopsContainer.querySelectorAll(".stop-card")).map((node, index) => {
      const source = node.querySelector(".stop-source").value;
      const isa = source === "appointment" ? node.querySelector(".stop-isa").value : clean(node.querySelector(".manual-isa").value);
      const appointment = source === "appointment" ? appointmentByIsa(isa) : null;
      const destination = clean(node.querySelector(".stop-destination").value);
      const scheduleTime = clean(node.querySelector(".stop-schedule").value);
      const transitDays = numberOrNull(node.querySelector(".stop-transit").value);
      const bufferHours = calculateBufferHours(scheduleTime, transitDays);
      return {
        stop_number: index + 1,
        source,
        isa,
        destination,
        schedule_time: scheduleTime,
        load_type: appointment ? clean(appointment.loadType) : "",
        transit_days: transitDays,
        etd_at: etaDateTime().toISOString(),
        time_buffer_hours: bufferHours,
      };
    });
  }

  function updateDefaultPlanName() {
    if (state.planNameTouched && els.planName.dataset.autoName !== "true") return;
    const name = generateDefaultPlanName();
    state.updatingPlanName = true;
    els.planName.value = name;
    els.planName.dataset.autoName = "true";
    state.updatingPlanName = false;
  }

  function generateDefaultPlanName(stops = null) {
    const stopCodes = stops
      ? stops.map((stop) => defaultStopCodeFromStop(stop))
      : Array.from(els.stopsContainer.querySelectorAll(".stop-card")).map(defaultStopCodeFromNode);
    return [formatEtdMonthDay(), ...stopCodes, state.planNameSuffix].map(clean).filter(Boolean).join("-");
  }

  function defaultStopCodeFromNode(node) {
    const source = clean(node.querySelector(".stop-source").value);
    if (source === "appointment") {
      const appt = appointmentByIsa(node.querySelector(".stop-isa").value);
      return clean(appt && appt.fc) || clean(node.querySelector(".stop-destination").value);
    }
    return stateCodeFromText(node.querySelector(".stop-destination").value)
      || stateCodeFromText(node.querySelector(".manual-isa").value)
      || `Stop${Number(node.dataset.index || 0) + 1}`;
  }

  function defaultStopCodeFromStop(stop) {
    if (clean(stop.source) === "appointment") {
      const appt = appointmentByIsa(stop.isa);
      return clean(appt && appt.fc) || clean(stop.destination);
    }
    return stateCodeFromText(stop.destination) || stateCodeFromText(stop.isa) || `Stop${stop.stop_number || ""}`;
  }

  function formatEtdMonthDay() {
    const value = clean(els.etaDate.value);
    if (!value) return "";
    const parts = value.split("-");
    if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  }

  function randomNameSuffix() {
    const random = window.crypto && window.crypto.getRandomValues
      ? window.crypto.getRandomValues(new Uint16Array(1))[0]
      : Math.floor(Math.random() * 65536);
    return random.toString(16).toUpperCase().padStart(4, "0").slice(-4);
  }

  function suffixFromPlanName(value) {
    const match = clean(value).match(/-([A-Fa-f0-9]{4})$/);
    return match ? match[1].toUpperCase() : "";
  }

  function stateCodeFromText(value) {
    const text = clean(value);
    if (!text) return "";
    const upper = text.toUpperCase();
    const direct = upper.match(/\b(A[LKZR]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEINOST]|N[CDEHJMVY]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])\b/);
    if (direct) return direct[1];
    const stateNames = {
      ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA", COLORADO: "CO",
      CONNECTICUT: "CT", DELAWARE: "DE", FLORIDA: "FL", GEORGIA: "GA", HAWAII: "HI", IDAHO: "ID",
      ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA", KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA",
      MAINE: "ME", MARYLAND: "MD", MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN", MISSISSIPPI: "MS",
      MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV", "NEW HAMPSHIRE": "NH",
      "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC",
      "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR", PENNSYLVANIA: "PA",
      "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD", TENNESSEE: "TN", TEXAS: "TX",
      UTAH: "UT", VERMONT: "VT", VIRGINIA: "VA", WASHINGTON: "WA", "WEST VIRGINIA": "WV", WISCONSIN: "WI",
      WYOMING: "WY",
    };
    return Object.entries(stateNames).find(([name]) => upper.includes(name))?.[1] || "";
  }

  function updateBuffers() {
    els.stopsContainer.querySelectorAll(".stop-card").forEach((node) => {
      const scheduleTime = clean(node.querySelector(".stop-schedule").value);
      const transitDays = numberOrNull(node.querySelector(".stop-transit").value);
      const buffer = calculateBufferHours(scheduleTime, transitDays);
      const pill = node.querySelector(".buffer-pill");
      pill.className = "buffer-pill";
      pill.textContent = `Buffer ${formatBuffer(buffer)}`;
      if (buffer === null) return;
      if (buffer >= 24) pill.classList.add("ok");
      else if (buffer >= 0) pill.classList.add("warning");
      else pill.classList.add("issue");
    });
  }

  function calculateBufferHours(scheduleTime, transitDays) {
    const scheduleDate = parseCarrierTime(scheduleTime);
    if (!scheduleDate || transitDays === null) return null;
    return (scheduleDate.getTime() - etaDateTime().getTime()) / 3600000 - transitDays * 24;
  }

  function etaDateTime() {
    const date = els.etaDate.value || new Date().toISOString().slice(0, 10);
    const endHour = ETD_PERIODS[els.etaPeriod.value]?.endHour || 12;
    if (endHour === 24) {
      const nextDate = new Date(`${date}T00:00:00-07:00`);
      nextDate.setDate(nextDate.getDate() + 1);
      return nextDate;
    }
    return new Date(`${date}T${String(endHour).padStart(2, "0")}:00:00-07:00`);
  }

  function findActiveIsaConflict(stops) {
    const activePlans = state.plans.filter((plan) => {
      if (state.editingPlanId && clean(plan.id) === state.editingPlanId) return false;
      return normalizePlanStatus(plan.plan_status) !== "voided";
    });
    const used = new Map();
    activePlans.forEach((plan) => {
      (Array.isArray(plan.stops) ? plan.stops : []).forEach((stop) => {
        const isa = clean(stop.isa);
        if (isa) used.set(isa, plan.plan_name || plan.plan_type || plan.id);
      });
    });
    const seenInForm = new Set();
    for (const stop of stops) {
      const isa = clean(stop.isa);
      if (!isa) continue;
      if (seenInForm.has(isa)) return { isa, planName: "this new plan" };
      seenInForm.add(isa);
      if (used.has(isa)) return { isa, planName: used.get(isa) };
    }
    return null;
  }

  function normalizePlanStatus(status) {
    const value = clean(status);
    if (value === "Voided") return "voided";
    if (value === "Active" || !value) return "Planned";
    return value;
  }

  function applyEditPlanFromUrl() {
    if (!state.editingPlanId || state.editApplied || !state.plans.length) return;
    const plan = currentEditingPlan();
    if (!plan) {
      setCloudStatus("Trip plan not found", "error");
      return;
    }
    const stops = Array.isArray(plan.stops) ? plan.stops : [];
    state.editApplied = true;
    els.planName.value = clean(plan.plan_name);
    state.planNameTouched = Boolean(clean(plan.plan_name));
    els.planName.dataset.autoName = "false";
    state.planNameSuffix = suffixFromPlanName(clean(plan.plan_name)) || randomNameSuffix();
    setSelectValue(els.planType, clean(plan.plan_type));
    els.planDate.value = clean(plan.plan_date);
    els.etaDate.value = clean(plan.etd_date) || new Date().toISOString().slice(0, 10);
    setSelectValue(els.etaPeriod, normalizeEtaPeriod(clean(plan.etd_period)) || "09-12");
    els.transportMode.value = clean(plan.transport_mode);
    els.truckNumber.value = clean(plan.truck_number);
    els.trailerNumber.value = clean(plan.trailer_number);
    els.planNotes.value = clean(plan.notes);
    renderStops();
    stops.forEach((stop, index) => populateStop(index, stop));
    updateBuffers();
    updateDefaultPlanName();
    els.saveTripPlanButton.textContent = "Update Trip Plan";
    document.title = "Edit Trip Plan";
    document.querySelector("h1").textContent = "Edit Trip Plan";
    document.querySelector(".form-title h2").textContent = "Edit Trip Plan";
    setCloudStatus("Editing existing trip plan", "connected");
  }

  function populateStop(index, stop) {
    const node = els.stopsContainer.querySelectorAll(".stop-card")[index];
    if (!node) return;
    const source = clean(stop.source) === "private" ? "private" : "appointment";
    node.querySelector(".stop-source").value = source;
    updateStopMode(node);
    if (source === "private") {
      node.querySelector(".manual-isa").value = clean(stop.isa);
    } else {
      node.querySelector(".stop-isa").value = clean(stop.isa);
    }
    node.querySelector(".stop-destination").value = clean(stop.destination);
    node.querySelector(".stop-schedule").value = clean(stop.schedule_time);
    node.querySelector(".stop-transit").value = stop.transit_days ?? "";
  }

  function currentEditingPlan() {
    return state.plans.find((plan) => clean(plan.id) === state.editingPlanId);
  }

  function setSelectValue(select, value) {
    if (!value) return;
    const option = Array.from(select.options).find((item) => item.value === value);
    if (option) select.value = value;
  }

  function normalizeEtaPeriod(period) {
    const value = clean(period);
    if (value === "AM") return "09-12";
    if (value === "PM") return "15-18";
    return value;
  }

  function renderAppointmentCalendar() {
    const recordsByDay = new Map();
    const planStatusByIsa = buildPlanStatusByIsa();

    state.appointments.forEach((appt) => {
      const key = scheduleDateKey(appt.scheduleTime);
      if (!key) return;
      const items = recordsByDay.get(key) || [];
      items.push(appt);
      recordsByDay.set(key, items);
    });

    els.calendarSummary.textContent = `${state.appointments.length} appointments loaded`;

    els.calendarGrid.innerHTML = Array.from(recordsByDay.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, appointments]) => `
        <section class="timeline-day" data-date-key="${escapeAttr(key)}">
          <header class="timeline-day-head">
            <strong>${escapeHtml(formatTimelineDate(key))}</strong>
            <span>${appointments.length} appt${appointments.length === 1 ? "" : "s"}</span>
          </header>
          <div class="timeline-axis" aria-hidden="true"></div>
          <div class="timeline-items">
            ${appointments.sort(compareAppointments).map((appt) => `
              <button class="calendar-appointment${planStatusByIsa.get(appt.isa) ? ` trip-bound status-${escapeAttr(statusClass(planStatusByIsa.get(appt.isa)))}` : ""}" type="button" draggable="true" data-isa="${escapeAttr(appt.isa)}" title="${escapeAttr(`${appt.isa} ${appt.fc}`)}">
                <time>${escapeHtml(calendarTimeLabel(appt.scheduleTime))}</time>
                <div>
                  <strong>${escapeHtml(appt.fc || "-")}</strong>
                  <small>
                    <span>${escapeHtml(appt.isa || "-")}</span>
                    <em>${escapeHtml(appt.loadType || "Unassigned")}</em>
                  </small>
                </div>
              </button>
            `).join("")}
          </div>
        </section>
      `).join("") || '<p class="timeline-empty">No scheduled appointments loaded.</p>';

    els.calendarGrid.querySelectorAll("[data-isa]").forEach((button) => {
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", button.dataset.isa);
      });
      button.addEventListener("dblclick", () => {
        openAppointmentModal(button.dataset.isa);
      });
    });

    if (!state.timelineAutoScrolled) {
      state.timelineAutoScrolled = true;
      scrollTimelineToToday(els.calendarGrid);
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
      container.scrollLeft = Math.max(target.offsetLeft - 14, 0);
    });
  }

  function buildPlanStatusByIsa() {
    const map = new Map();
    (Array.isArray(state.plans) ? state.plans : []).forEach((plan) => {
      const status = normalizePlanStatus(plan.plan_status);
      (Array.isArray(plan.stops) ? plan.stops : []).forEach((stop) => {
        const isa = clean(stop.isa);
        if (!isa) return;
        map.set(isa, status);
      });
    });
    return map;
  }

  function statusClass(status) {
    const value = clean(status).toLowerCase();
    if (!value) return "planned";
    return value.replace(/\s+/g, "-");
  }

  function openAppointmentModal(isa) {
    const appt = appointmentByIsa(isa);
    if (!appt) return;
    els.appointmentModalTitle.textContent = appt.isa || "Appointment Details";
    els.appointmentModalSubtitle.textContent = `${appt.fc || "No FC"} · ${appt.status || "No status"}`;
    const details = [
      ["ISA", appt.isa],
      ["FC", appt.fc],
      ["Status", appt.status],
      ["Schedule Time", appt.scheduleTime],
      ["Los Angeles Time", formatLosAngelesTime(appt.scheduleTime)],
      ["CRDD", appt.crdd],
      ["Load Type", appt.loadType],
      ["Reference Code", appt.referenceCode],
      ["Trailer", appt.trailer],
      ["Source", appt.source],
      ["Notes", appt.notes],
    ];
    els.appointmentModalBody.innerHTML = details
      .filter(([, value]) => clean(value))
      .map(([label, value]) => `
        <div class="detail-row">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `).join("");
    els.appointmentModal.classList.remove("hidden");
    els.appointmentModal.setAttribute("aria-hidden", "false");
  }

  function closeAppointmentModal() {
    els.appointmentModal.classList.add("hidden");
    els.appointmentModal.setAttribute("aria-hidden", "true");
  }

  function clearForm() {
    els.tripForm.reset();
    const today = new Date().toISOString().slice(0, 10);
    els.planDate.value = today;
    els.etaDate.value = today;
    state.planNameTouched = false;
    state.planNameSuffix = randomNameSuffix();
    els.planName.dataset.autoName = "true";
    if (state.editingPlanId) {
      state.editingPlanId = "";
      state.editApplied = false;
      window.history.replaceState({}, "", window.location.pathname);
      els.saveTripPlanButton.textContent = "Save Trip Plan";
      document.title = "Create Trip Plans";
      document.querySelector("h1").textContent = "Create Trip Plans";
      document.querySelector(".form-title h2").textContent = "Create Trip Plan";
    }
    renderStops();
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

  function recordFromAppointmentRow(row) {
    return {
      isa: clean(row.isa),
      fc: clean(row.fc),
      scheduleTime: clean(row.schedule_time_raw),
      crdd: clean(row.crdd_raw),
      status: clean(row.status),
      loadType: clean(row.load_type),
      referenceCode: clean(row.reference_code),
      trailer: clean(row.trailer),
      source: clean(row.source),
      notes: clean(row.notes),
    };
  }

  function appointmentByIsa(isa) {
    return state.appointments.find((appt) => appt.isa === isa);
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
    els.cloudStatus.classList.toggle("connected", type === "connected");
    els.cloudStatus.classList.toggle("error", type === "error");
  }

  function compareAppointments(a, b) {
    const dateA = parseCarrierTime(a.scheduleTime);
    const dateB = parseCarrierTime(b.scheduleTime);
    return (dateA?.getTime() || 0) - (dateB?.getTime() || 0) || a.isa.localeCompare(b.isa);
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function calendarTimeLabel(value) {
    const text = clean(value);
    const match = text.match(/^\d{1,2}\/\d{1,2}\/\d{4}\s+(\d{1,2}):(\d{2})(?:\s+([A-Z]{2,4}))?/);
    if (!match) return text || "-";
    const [, hour, minute, zone] = match;
    const time = `${String(hour).padStart(2, "0")}:${minute}`;
    return zone ? `${time} ${zone}` : time;
  }

  function scheduleDateKey(value) {
    const match = clean(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) return "";
    const [, month, day, year] = match;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function formatTimelineDate(key) {
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  function formatLosAngelesTime(value) {
    const date = parseCarrierTime(value);
    if (!date) return "";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function formatBuffer(value) {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}h`;
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function compactUnique(values) {
    return Array.from(new Set((values || []).map(clean).filter(Boolean)));
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
