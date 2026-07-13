(function () {
  "use strict";

  const TABLE = "inventory_tickets";
  const SHIPMENT_TABLE = "inventory_ticket_shipments";
  const TRIP_TABLE = "trip_plans";
  const LEGACY_STATUSES = ["Draft", "Available", "Reserved", "Planned", "Shipped", "On Hold", "Cancelled"];
  const RECORD_STATUSES = ["Active", "On Hold", "Cancelled", "Closed"];
  const GEO_STATUSES = ["Ocean In Transit", "Arrived Port", "Devanning", "In Warehouse", "Truck In Transit", "Delivered"];
  const STAGE_STATUS_BY_GEO = {
    "Ocean In Transit": ["Pending"],
    "Arrived Port": ["Pending"],
    Devanning: ["Container Pickup", "Devanning", "Devanned"],
    "In Warehouse": ["Available", "Reserved", "Planned", "Staging", "Problem Handling"],
    "Truck In Transit": ["In Transit", "Delayed", "Accident", "Delivered Pending POD"],
    Delivered: ["Delivered"],
  };
  const TRANSPORT_STATUSES = ["Not Started", "In Transit", "Arrived", "Delivered"];
  const EXCEPTION_STATUSES = ["None", "At Risk", "Damaged", "Lost", "Inspection", "Customs Hold", "Accident", "Delayed", "Shortage", "Overage"];
  const LEGACY_STATUS_MIGRATION = {
    Draft: { recordStatus: "Active", geoStatus: "In Warehouse", stageStatus: "Available", exceptionStatus: "None" },
    Available: { recordStatus: "Active", geoStatus: "In Warehouse", stageStatus: "Available", exceptionStatus: "None" },
    Reserved: { recordStatus: "Active", geoStatus: "In Warehouse", stageStatus: "Reserved", exceptionStatus: "None" },
    Planned: { recordStatus: "Active", geoStatus: "In Warehouse", stageStatus: "Planned", exceptionStatus: "None" },
    Shipped: { recordStatus: "Active", geoStatus: "Truck In Transit", stageStatus: "In Transit", exceptionStatus: "None" },
    "On Hold": { recordStatus: "On Hold", geoStatus: "In Warehouse", stageStatus: "Problem Handling", exceptionStatus: "At Risk" },
    Cancelled: { recordStatus: "Cancelled", geoStatus: "In Warehouse", stageStatus: "Problem Handling", exceptionStatus: "None" },
  };

  const els = {
    ticketTitle: document.getElementById("ticketTitle"),
    ticketSubtitle: document.getElementById("ticketSubtitle"),
    editTicketLink: document.getElementById("editTicketLink"),
    cloudStatus: document.getElementById("cloudStatus"),
    errorState: document.getElementById("errorState"),
    errorMessage: document.getElementById("errorMessage"),
    detailContent: document.getElementById("detailContent"),
    statusBadge: document.getElementById("statusBadge"),
    overviewName: document.getElementById("overviewName"),
    overviewMeta: document.getElementById("overviewMeta"),
    shipmentRows: document.getElementById("shipmentRows"),
    shipmentEmpty: document.getElementById("shipmentEmpty"),
    changeLog: document.getElementById("changeLog"),
  };

  const state = {
    apiEnabled: false,
    ticketId: "",
    ticket: null,
    tripPlan: null,
  };

  boot();

  async function boot() {
    loadApiConfig();
    state.ticketId = new URLSearchParams(window.location.search).get("id") || "";
    if (!state.ticketId) {
      showError("Missing inventory ticket id. Open this page from Inventory.");
      return;
    }
    els.editTicketLink.href = `./inventory.html?edit=${encodeURIComponent(state.ticketId)}`;
    if (!state.apiEnabled) {
      showError("TMS API is unavailable.");
      setCloudStatus("TMS API unavailable", "error");
      return;
    }
    await loadTicket();
  }

  function loadApiConfig() {
    state.apiEnabled = Boolean(window.TmsApi && window.TmsApi.isConfigured());
  }

  async function loadTicket() {
    try {
      setCloudStatus("Loading TMS data", "");
      const [ticketRows, shipmentRows] = await Promise.all([
        apiRequest(`${TABLE}?id=eq.${encodeURIComponent(state.ticketId)}&select=*&limit=1`),
        apiRequest(`${SHIPMENT_TABLE}?inventory_ticket_id=eq.${encodeURIComponent(state.ticketId)}&select=*&order=created_at.asc`),
      ]);
      if (!ticketRows.length) {
        showError("Inventory ticket not found in TMS API.");
        setCloudStatus("Not found", "error");
        return;
      }
      const childRows = shipmentRows.length ? shipmentRows.map(normalizeShipmentRow) : legacyShipmentRows(ticketRows[0]);
      state.ticket = normalizeTicket(ticketRows[0], childRows);
      await loadTripPlan(state.ticket.tripPlanId);
      setCloudStatus("Connected", "connected");
      render();
    } catch (error) {
      console.error(error);
      showError(error.message);
      setCloudStatus("Load failed", "error");
    }
  }

  async function loadTripPlan(tripPlanId) {
    state.tripPlan = null;
    if (!tripPlanId) return;
    try {
      const rows = await apiRequest(`${TRIP_TABLE}?id=eq.${encodeURIComponent(tripPlanId)}&select=id,plan_name,plan_type,execution_status,control_status,etd_date&limit=1`);
      state.tripPlan = rows.length ? normalizeTripPlan(rows[0]) : null;
    } catch (error) {
      console.warn(error);
      state.tripPlan = null;
    }
  }

  function render() {
    const ticket = state.ticket;
    if (!ticket) return;
    els.errorState.classList.add("hidden");
    els.detailContent.classList.remove("hidden");
    els.ticketTitle.textContent = ticket.ticketNo;
    els.ticketSubtitle.textContent = `${ticket.fc || "-"} · ${ticket.recordStatus} / ${ticket.geoStatus} / ${ticket.stageStatus} · ${ticket.shipments.length} Shipment/PO row${ticket.shipments.length === 1 ? "" : "s"}`;
    els.overviewName.textContent = ticket.ticketNo;
    els.statusBadge.className = `status-chip status-${statusClass(ticket.stageStatus)}`;
    els.statusBadge.textContent = ticket.stageStatus;
    els.overviewMeta.innerHTML = [
      metaRow("Inventory Ticket No", ticket.ticketNo),
      metaRow("External Ref No", ticket.externalRefNo || "-"),
      metaRow("Product Name", ticket.productName || "-"),
      metaRow("FC", ticket.fc),
      metaRow("Record Status", ticket.recordStatus),
      metaRow("Geo Status", ticket.geoStatus),
      metaRow("Stage Status", ticket.stageStatus),
      metaRow("Exception Status", ticket.exceptionStatus),
      metaRow("Legacy Inventory Status", ticket.status),
      metaRow("Transport Status", ticket.transportStatus),
      metaRow("Container Ref", ticket.containerRef || "-"),
      metaRow("Pallet Ref", ticket.palletRef || "-"),
      metaHtmlRow("Linked Trip Plan", renderTripPlanLink(ticket.tripPlanId)),
      metaRow("Weight (KG)", numberText(ticket.weightKg, 2)),
      metaRow("CBM", numberText(ticket.volumeCbm, 3)),
      metaRow("Cartons", String(ticket.pieceCarton)),
      metaRow("Remark", ticket.remark || "-"),
      metaRow("Updated", formatDateTime(ticket.updatedAt)),
    ].join("");
    renderShipmentTable(ticket.shipments);
    renderChangeLog(ticket.changeLog);
  }

  function renderShipmentTable(rows) {
    els.shipmentEmpty.classList.toggle("hidden", rows.length > 0);
    els.shipmentRows.innerHTML = rows.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(row.shipmentId)}</td>
        <td><strong>${escapeHtml(row.po)}</strong></td>
      </tr>
    `).join("");
  }

  function renderChangeLog(changeLog) {
    if (!changeLog.length) {
      els.changeLog.innerHTML = '<p class="muted-note">No changes recorded.</p>';
      return;
    }
    els.changeLog.innerHTML = changeLog.slice().reverse().map((entry) => `
      <article class="ticket-log-entry">
        <strong>${escapeHtml(entry.action || "Change")}</strong>
        <span>${escapeHtml(formatDateTime(entry.at))}</span>
        <p>${escapeHtml(entry.message || "")}</p>
      </article>
    `).join("");
  }

  function apiRequest(path, options = {}) {
    return window.TmsApi.request(path, options);
  }

  function normalizeTicket(row, shipments) {
    const legacyStatus = LEGACY_STATUSES.includes(clean(row.inventory_status)) ? clean(row.inventory_status) : "Draft";
    const migrated = LEGACY_STATUS_MIGRATION[legacyStatus] || LEGACY_STATUS_MIGRATION.Draft;
    const recordStatus = RECORD_STATUSES.includes(clean(row.record_status)) ? clean(row.record_status) : migrated.recordStatus;
    const geoStatus = GEO_STATUSES.includes(clean(row.geo_status)) ? clean(row.geo_status) : migrated.geoStatus;
    const stageStatus = stageOptions(geoStatus).includes(clean(row.stage_status)) ? clean(row.stage_status) : migrated.stageStatus;
    const exceptionStatus = EXCEPTION_STATUSES.includes(clean(row.exception_status)) ? clean(row.exception_status) : migrated.exceptionStatus;
    return {
      id: clean(row.id), ticketNo: clean(row.inventory_ticket_no), externalRefNo: clean(row.external_ref_no),
      productName: clean(row.product_name), containerRef: clean(row.container_ref), palletRef: clean(row.pallet_ref),
      tripPlanId: clean(row.trip_plan_id), fc: clean(row.fc),
      status: legacyStatus, recordStatus, geoStatus, stageStatus,
      transportStatus: TRANSPORT_STATUSES.includes(clean(row.transport_status)) ? clean(row.transport_status) : "Not Started",
      exceptionStatus,
      weightKg: amountValue(row.weight_kg), volumeCbm: amountValue(row.volume_cbm, 3), pieceCarton: integerValue(row.piece_carton),
      remark: clean(row.remark), changeLog: Array.isArray(row.change_log) ? row.change_log : [], updatedAt: clean(row.updated_at), shipments,
    };
  }

  function normalizeShipmentRow(row) {
    return { id: clean(row.id), shipmentId: clean(row.shipment_id), po: clean(row.po) };
  }

  function normalizeTripPlan(row) {
    const name = clean(row.plan_name) || clean(row.plan_type) || "Untitled Plan";
    const status = [clean(row.execution_status), clean(row.control_status)].filter(Boolean).join(" / ");
    const date = clean(row.etd_date);
    return { id: clean(row.id), label: [name, date, status].filter(Boolean).join(" · ") };
  }

  function renderTripPlanLink(tripPlanId) {
    if (!tripPlanId) return "-";
    const label = state.tripPlan ? state.tripPlan.label : tripPlanId;
    return `<a class="ticket-detail-link" href="./trip-plan-detail.html?id=${encodeURIComponent(tripPlanId)}">${escapeHtml(label)}</a>`;
  }

  function legacyShipmentRows(row) {
    const shipmentId = clean(row.shipment_id);
    const po = clean(row.po);
    return shipmentId && po ? [{ id: "", shipmentId, po }] : [];
  }

  function showError(message) {
    els.errorMessage.textContent = message;
    els.errorState.classList.remove("hidden");
    els.detailContent.classList.add("hidden");
  }

  function metaRow(label, value) { return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`; }
  function metaHtmlRow(label, valueHtml) { return `<div><dt>${escapeHtml(label)}</dt><dd>${valueHtml}</dd></div>`; }
  function setCloudStatus(message, type) { els.cloudStatus.textContent = message; els.cloudStatus.classList.toggle("connected-text", type === "connected"); els.cloudStatus.classList.toggle("error-text", type === "error"); }
  function statusClass(status) { return clean(status).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "draft"; }
  function stageOptions(geoStatus) { return STAGE_STATUS_BY_GEO[clean(geoStatus)] || STAGE_STATUS_BY_GEO["In Warehouse"]; }
  function formatDateTime(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date); }
  function numberText(value, digits) { return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function amountValue(value, decimals = 2) { const number = Number(value); return Number.isFinite(number) ? Math.round(number * (10 ** decimals)) / (10 ** decimals) : 0; }
  function integerValue(value) { const number = Number(value); return Number.isFinite(number) ? Math.trunc(number) : 0; }
  function clean(value) { return value === null || value === undefined ? "" : String(value).trim(); }
  function escapeHtml(value) { return clean(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }
})();
