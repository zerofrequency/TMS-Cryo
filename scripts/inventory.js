(function () {
  "use strict";

  const TABLE = "inventory_tickets";
  const SHIPMENT_TABLE = "inventory_ticket_shipments";
  const TRIP_TABLE = "trip_plans";
  const STATUSES = ["Draft", "Available", "Reserved", "Planned", "Shipped", "On Hold", "Cancelled"];
  const TRANSPORT_STATUSES = ["Not Started", "In Transit", "Arrived", "Delivered"];
  const EXCEPTION_STATUSES = ["None", "At Risk", "On Hold", "Damaged", "Lost", "Inspection", "Customs Hold"];

  const els = {
    newTicketButton: document.getElementById("newTicketButton"),
    exportButton: document.getElementById("exportButton"),
    searchInput: document.getElementById("searchInput"),
    fcFilter: document.getElementById("fcFilter"),
    statusFilter: document.getElementById("statusFilter"),
    clearFilters: document.getElementById("clearFilters"),
    cloudStatus: document.getElementById("cloudStatus"),
    resultCount: document.getElementById("resultCount"),
    ticketRows: document.getElementById("ticketRows"),
    emptyState: document.getElementById("emptyState"),
    detailEmpty: document.getElementById("detailEmpty"),
    detailView: document.getElementById("detailView"),
    detailPanel: document.querySelector(".detail-panel"),
    formPanel: document.getElementById("formPanel"),
    formTitle: document.getElementById("formTitle"),
    cancelFormButton: document.getElementById("cancelFormButton"),
    ticketForm: document.getElementById("ticketForm"),
    inventoryTicketNo: document.getElementById("inventoryTicketNo"),
    externalRefNo: document.getElementById("externalRefNo"),
    fc: document.getElementById("fc"),
    inventoryStatus: document.getElementById("inventoryStatus"),
    transportStatus: document.getElementById("transportStatus"),
    exceptionStatus: document.getElementById("exceptionStatus"),
    productName: document.getElementById("productName"),
    containerRef: document.getElementById("containerRef"),
    palletRef: document.getElementById("palletRef"),
    tripPlanId: document.getElementById("tripPlanId"),
    weightKg: document.getElementById("weightKg"),
    volumeCbm: document.getElementById("volumeCbm"),
    pieceCarton: document.getElementById("pieceCarton"),
    remark: document.getElementById("remark"),
    shipmentRowsEditor: document.getElementById("shipmentRowsEditor"),
    addShipmentRowButton: document.getElementById("addShipmentRowButton"),
    formMessage: document.getElementById("formMessage"),
    resetFormButton: document.getElementById("resetFormButton"),
  };

  const state = {
    supabase: { url: "", key: "", enabled: false },
    tickets: [],
    tripPlans: [],
    selectedId: "",
    editingId: "",
  };

  boot();

  async function boot() {
    loadSupabaseConfig();
    fillStatusOptions();
    bindEvents();
    if (!state.supabase.enabled) {
      setCloudStatus("Add anon key in supabase-config.js", "error");
      render();
      return;
    }
    await loadTripPlans();
    await loadTickets();
    const editId = new URLSearchParams(window.location.search).get("edit") || "";
    if (editId) showForm(ticketById(editId));
  }

  function bindEvents() {
    [els.searchInput, els.fcFilter, els.statusFilter].forEach((element) => {
      element.addEventListener("input", render);
      element.addEventListener("change", render);
    });
    els.clearFilters.addEventListener("click", () => {
      els.searchInput.value = "";
      els.fcFilter.value = "";
      els.statusFilter.value = "";
      render();
    });
    els.newTicketButton.addEventListener("click", () => showForm());
    els.exportButton.addEventListener("click", exportCsv);
    els.cancelFormButton.addEventListener("click", hideForm);
    els.resetFormButton.addEventListener("click", () => fillForm(null));
    els.ticketForm.addEventListener("submit", saveTicket);
    els.addShipmentRowButton.addEventListener("click", () => addShipmentEditorRow());
    els.shipmentRowsEditor.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-remove-shipment-row]");
      if (!removeButton) return;
      removeButton.closest(".shipment-pair-row")?.remove();
      if (!els.shipmentRowsEditor.children.length) addShipmentEditorRow();
    });
    els.ticketRows.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-ticket]");
      const viewButton = event.target.closest("[data-view-ticket]");
      if (editButton) return showForm(ticketById(editButton.dataset.editTicket));
      if (viewButton && viewButton.tagName === "A") return;
      if (viewButton) {
        return selectTicket(viewButton.dataset.viewTicket, true);
      }
      const row = event.target.closest("[data-ticket-id]");
      if (!row) return;
      selectTicket(row.dataset.ticketId, false);
    });
    els.detailView.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-ticket]");
      if (editButton) showForm(ticketById(editButton.dataset.editTicket));
    });
  }

  function loadSupabaseConfig() {
    const config = window.CARRIER_APPT_SUPABASE || {};
    state.supabase.url = clean(config.url).replace(/\/+$/, "");
    state.supabase.key = clean(config.anonKey || config.key);
    state.supabase.enabled = Boolean(state.supabase.url && state.supabase.key);
  }

  function fillStatusOptions() {
    els.statusFilter.innerHTML = '<option value="">All statuses</option>' + optionList(STATUSES);
    els.inventoryStatus.innerHTML = optionList(STATUSES);
    els.transportStatus.innerHTML = optionList(TRANSPORT_STATUSES);
    els.exceptionStatus.innerHTML = optionList(EXCEPTION_STATUSES);
  }

  async function loadTripPlans() {
    try {
      const rows = await supabaseRequest(`${TRIP_TABLE}?select=id,plan_name,plan_type,execution_status,control_status,etd_date&order=updated_at.desc`);
      state.tripPlans = rows.map(normalizeTripPlan);
      fillTripPlanOptions();
    } catch (error) {
      console.warn(error);
      state.tripPlans = [];
      fillTripPlanOptions();
    }
  }

  function optionList(values) {
    return values.map((value) => `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`).join("");
  }

  async function loadTickets() {
    try {
      setCloudStatus("Loading Supabase", "");
      const [ticketRows, shipmentRows] = await Promise.all([
        supabaseRequest(`${TABLE}?select=*&order=updated_at.desc`),
        supabaseRequest(`${SHIPMENT_TABLE}?select=*&order=created_at.asc`),
      ]);
      const shipmentsByTicket = new Map();
      shipmentRows.forEach((row) => {
        const ticketId = clean(row.inventory_ticket_id);
        const list = shipmentsByTicket.get(ticketId) || [];
        list.push(normalizeShipmentRow(row));
        shipmentsByTicket.set(ticketId, list);
      });
      state.tickets = ticketRows.map((row) => {
        const childRows = shipmentsByTicket.get(clean(row.id)) || legacyShipmentRows(row);
        return normalizeTicket(row, childRows);
      });
      if (!state.selectedId && state.tickets.length) state.selectedId = state.tickets[0].id;
      fillFcFilter();
      setCloudStatus("Connected", "connected");
      render();
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
      render();
    }
  }

  function render() {
    const rows = filteredTickets();
    renderRows(rows);
    renderDetail();
  }

  function selectTicket(ticketId, focusDetail) {
    state.selectedId = ticketId;
    render();
    if (focusDetail) focusDetailPanel();
  }

  function focusDetailPanel() {
    window.location.hash = "detail";
    window.requestAnimationFrame(() => {
      els.detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function renderRows(rows) {
    els.resultCount.textContent = rows.length ? `${rows.length} visible of ${state.tickets.length} tickets` : resultEmptyLabel();
    els.emptyState.classList.toggle("hidden", rows.length > 0);
    els.ticketRows.innerHTML = rows.map((ticket) => `
      <tr class="${ticket.id === state.selectedId ? "selected-row" : ""}" data-ticket-id="${escapeAttr(ticket.id)}">
        <td><a class="ticket-detail-link" href="./inventory-detail.html?id=${encodeURIComponent(ticket.id)}">${escapeHtml(ticket.ticketNo)}</a></td>
        <td>${escapeHtml(ticket.externalRefNo || "-")}</td>
        <td>${escapeHtml(ticket.productName || "-")}</td>
        <td>${escapeHtml(ticket.containerRef || "-")}</td>
        <td>${escapeHtml(ticket.palletRef || "-")}</td>
        <td>${renderTripPlanLink(ticket)}</td>
        <td>${escapeHtml(ticket.fc)}</td>
        <td>${statusChip(ticket.status)}</td>
        <td>${statusChip(ticket.transportStatus)}</td>
        <td>${statusChip(ticket.exceptionStatus)}</td>
        <td>${ticket.shipments.length}</td>
        <td>${escapeHtml(numberText(ticket.weightKg, 2))}</td>
        <td>${escapeHtml(numberText(ticket.volumeCbm, 3))}</td>
        <td>${escapeHtml(String(ticket.pieceCarton))}</td>
        <td>${escapeHtml(formatDateTime(ticket.updatedAt))}</td>
        <td>
          <div class="row-actions">
            <a class="button compact neutral" href="./inventory-detail.html?id=${encodeURIComponent(ticket.id)}" data-view-ticket="${escapeAttr(ticket.id)}">View</a>
            <button class="button compact neutral" type="button" data-edit-ticket="${escapeAttr(ticket.id)}">Edit</button>
          </div>
        </td>
      </tr>
    `).join("");
  }

  function renderDetail() {
    const ticket = ticketById(state.selectedId);
    els.detailEmpty.classList.toggle("hidden", Boolean(ticket));
    els.detailView.classList.toggle("hidden", !ticket);
    if (!ticket) {
      els.detailView.innerHTML = "";
      return;
    }
    els.detailView.innerHTML = `
      <div class="detail-title">
        <div>
          ${statusChip(ticket.status)}
          <h2>${escapeHtml(ticket.ticketNo)}</h2>
        </div>
        <button class="button compact neutral" type="button" data-edit-ticket="${escapeAttr(ticket.id)}">Edit</button>
      </div>
      <dl class="meta">
        ${metaRow("Inventory Ticket No", ticket.ticketNo)}
        ${metaRow("External Ref No", ticket.externalRefNo || "-")}
        ${metaRow("Product Name", ticket.productName || "-")}
        ${metaRow("FC", ticket.fc)}
        ${metaRow("Inventory Status", ticket.status)}
        ${metaRow("Transport Status", ticket.transportStatus)}
        ${metaRow("Exception Status", ticket.exceptionStatus)}
        ${metaRow("Container Ref", ticket.containerRef || "-")}
        ${metaRow("Pallet Ref", ticket.palletRef || "-")}
        ${metaRow("Linked Trip Plan", tripPlanLabel(ticket.tripPlanId) || "-")}
        ${metaRow("Weight (KG)", numberText(ticket.weightKg, 2))}
        ${metaRow("CBM", numberText(ticket.volumeCbm, 3))}
        ${metaRow("Cartons", String(ticket.pieceCarton))}
        ${metaRow("Remark", ticket.remark || "-")}
        ${metaRow("Updated", formatDateTime(ticket.updatedAt))}
      </dl>
      <section class="shipment-pair-detail">
        <h3>Shipment ID / PO Rows</h3>
        ${renderShipmentPairs(ticket.shipments)}
      </section>
      <section class="ticket-log">
        <h3>Change Log</h3>
        ${renderChangeLog(ticket.changeLog)}
      </section>
    `;
  }

  function renderShipmentPairs(rows) {
    if (!rows.length) return '<p class="muted-note">No Shipment ID / PO rows recorded.</p>';
    return `<div class="shipment-pair-list">${rows.map((row) => `
      <article><span>${escapeHtml(row.shipmentId)}</span><strong>${escapeHtml(row.po)}</strong></article>
    `).join("")}</div>`;
  }

  function filteredTickets() {
    const query = clean(els.searchInput.value).toLowerCase();
    const fc = els.fcFilter.value;
    const status = els.statusFilter.value;
    return state.tickets.filter((ticket) => {
      if (fc && ticket.fc !== fc) return false;
      if (status && ticket.status !== status) return false;
      if (!query) return true;
      return searchableText(ticket).includes(query);
    });
  }

  function resultEmptyLabel() {
    return state.tickets.length ? "No matching tickets" : "No tickets loaded";
  }

  function fillFcFilter() {
    const current = els.fcFilter.value;
    const options = compactUnique(state.tickets.map((ticket) => ticket.fc));
    els.fcFilter.innerHTML = '<option value="">All FCs</option>' + optionList(options);
    if (options.includes(current)) els.fcFilter.value = current;
  }

  function showForm(ticket = null) {
    state.editingId = ticket ? ticket.id : "";
    els.formTitle.textContent = ticket ? "Edit Inventory Ticket" : "New Inventory Ticket";
    fillForm(ticket);
    els.formPanel.classList.remove("hidden");
    setFormMessage("", "");
  }

  function hideForm() {
    state.editingId = "";
    els.formPanel.classList.add("hidden");
    setFormMessage("", "");
  }

  function fillForm(ticket) {
    els.inventoryTicketNo.value = ticket ? ticket.ticketNo : "";
    els.externalRefNo.value = ticket ? ticket.externalRefNo : "";
    els.fc.value = ticket ? ticket.fc : "";
    els.inventoryStatus.value = ticket ? ticket.status : "Draft";
    els.transportStatus.value = ticket ? ticket.transportStatus : "Not Started";
    els.exceptionStatus.value = ticket ? ticket.exceptionStatus : "None";
    els.productName.value = ticket ? ticket.productName : "";
    els.containerRef.value = ticket ? ticket.containerRef : "";
    els.palletRef.value = ticket ? ticket.palletRef : "";
    els.tripPlanId.value = ticket ? ticket.tripPlanId : "";
    els.weightKg.value = ticket ? ticket.weightKg : "0";
    els.volumeCbm.value = ticket ? ticket.volumeCbm : "0";
    els.pieceCarton.value = ticket ? ticket.pieceCarton : "0";
    els.remark.value = ticket ? ticket.remark : "";
    els.shipmentRowsEditor.innerHTML = "";
    const rows = ticket && ticket.shipments.length ? ticket.shipments : [{ shipmentId: "", po: "" }];
    rows.forEach(addShipmentEditorRow);
  }

  function addShipmentEditorRow(row = {}) {
    const node = document.createElement("div");
    node.className = "shipment-pair-row";
    node.innerHTML = `
      <label>Shipment ID<input data-shipment-id type="text" value="${escapeAttr(row.shipmentId || "")}" /></label>
      <label>PO<input data-shipment-po type="text" value="${escapeAttr(row.po || "")}" /></label>
      <button class="icon-button" type="button" data-remove-shipment-row aria-label="Remove shipment row">×</button>
    `;
    els.shipmentRowsEditor.appendChild(node);
  }

  function collectShipmentRows() {
    return Array.from(els.shipmentRowsEditor.querySelectorAll(".shipment-pair-row"))
      .map((row) => ({
        shipment_id: clean(row.querySelector("[data-shipment-id]").value),
        po: clean(row.querySelector("[data-shipment-po]").value),
      }))
      .filter((row) => row.shipment_id || row.po);
  }

  async function saveTicket(event) {
    event.preventDefault();
    if (!state.supabase.enabled) return setFormMessage("Supabase is not configured.", "error");
    const payload = formPayload();
    const shipmentRows = collectShipmentRows();
    const validation = validatePayload(payload, shipmentRows);
    if (!validation.ok) return setFormMessage(validation.message, "error");
    const existing = ticketById(state.editingId);
    if (isDuplicateTicketNo(payload.inventory_ticket_no, existing?.id)) {
      return setFormMessage("Inventory Ticket No already exists.", "error");
    }
    payload.change_log = nextChangeLog(existing, payload, shipmentRows);
    try {
      setFormMessage("Saving ticket...", "");
      setCloudStatus("Saving ticket", "");
      let ticketId = existing?.id || "";
      if (existing) {
        await supabaseRequest(`${TABLE}?id=eq.${encodeURIComponent(existing.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });
      } else {
        const rows = await supabaseRequest(TABLE, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
        ticketId = clean(rows?.[0]?.id);
      }
      await syncShipmentRows(ticketId, shipmentRows);
      state.selectedId = ticketId;
      await loadTickets();
      hideForm();
      setCloudStatus("Saved", "connected");
    } catch (error) {
      console.error(error);
      setFormMessage(humanizeSaveError(error.message), "error");
      setCloudStatus(error.message, "error");
    }
  }

  async function syncShipmentRows(ticketId, rows) {
    await supabaseRequest(`${SHIPMENT_TABLE}?inventory_ticket_id=eq.${encodeURIComponent(ticketId)}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    if (!rows.length) return;
    await supabaseRequest(SHIPMENT_TABLE, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows.map((row) => ({ ...row, inventory_ticket_id: ticketId, updated_at: new Date().toISOString() }))),
    });
  }

  function formPayload() {
    const payload = {
      inventory_ticket_no: clean(els.inventoryTicketNo.value),
      external_ref_no: clean(els.externalRefNo.value),
      product_name: clean(els.productName.value),
      container_ref: clean(els.containerRef.value),
      pallet_ref: clean(els.palletRef.value),
      fc: clean(els.fc.value),
      inventory_status: clean(els.inventoryStatus.value) || "Draft",
      transport_status: clean(els.transportStatus.value) || "Not Started",
      exception_status: clean(els.exceptionStatus.value) || "None",
      weight_kg: amountValue(els.weightKg.value),
      volume_cbm: amountValue(els.volumeCbm.value, 3),
      piece_carton: integerValue(els.pieceCarton.value),
      remark: clean(els.remark.value),
      updated_at: new Date().toISOString(),
    };
    const tripPlanId = clean(els.tripPlanId.value);
    const existingTripPlanId = clean(ticketById(state.editingId)?.tripPlanId);
    if (tripPlanId || existingTripPlanId) payload.trip_plan_id = tripPlanId || null;
    return payload;
  }

  function validatePayload(payload, shipmentRows) {
    if (!payload.inventory_ticket_no) return { ok: false, message: "Inventory Ticket No is required." };
    if (!payload.fc) return { ok: false, message: "FC is required." };
    if (!STATUSES.includes(payload.inventory_status)) return { ok: false, message: "Inventory status is required." };
    if (!TRANSPORT_STATUSES.includes(payload.transport_status)) return { ok: false, message: "Transport status is required." };
    if (!EXCEPTION_STATUSES.includes(payload.exception_status)) return { ok: false, message: "Exception status is required." };
    if (payload.weight_kg < 0) return { ok: false, message: "Weight cannot be negative." };
    if (payload.volume_cbm < 0) return { ok: false, message: "CBM cannot be negative." };
    if (payload.piece_carton < 0) return { ok: false, message: "Cartons cannot be negative." };
    if (shipmentRows.some((row) => !row.shipment_id || !row.po)) return { ok: false, message: "Each shipment row requires both Shipment ID and PO." };
    return { ok: true, message: "" };
  }

  function nextChangeLog(existing, payload, shipmentRows) {
    const now = new Date().toISOString();
    const entries = existing && Array.isArray(existing.changeLog) ? [...existing.changeLog] : [];
    if (!existing) {
      entries.push({ at: now, action: "Inventory ticket created", message: `Inventory ticket ${payload.inventory_ticket_no} created in ${payload.inventory_status}.` });
      return entries;
    }
    [
      ["Inventory Ticket No", "inventory_ticket_no", existing.ticketNo, payload.inventory_ticket_no],
      ["External Ref No", "external_ref_no", existing.externalRefNo, payload.external_ref_no],
      ["Product Name", "product_name", existing.productName, payload.product_name],
      ["Container Ref", "container_ref", existing.containerRef, payload.container_ref],
      ["Pallet Ref", "pallet_ref", existing.palletRef, payload.pallet_ref],
      ["Linked Trip Plan", "trip_plan_id", tripPlanLabel(existing.tripPlanId), tripPlanLabel(payload.trip_plan_id)],
      ["FC", "fc", existing.fc, payload.fc],
      ["Inventory Status", "inventory_status", existing.status, payload.inventory_status],
      ["Transport Status", "transport_status", existing.transportStatus, payload.transport_status],
      ["Exception Status", "exception_status", existing.exceptionStatus, payload.exception_status],
      ["Weight (KG)", "weight_kg", existing.weightKg, payload.weight_kg],
      ["CBM", "volume_cbm", existing.volumeCbm, payload.volume_cbm],
      ["Cartons", "piece_carton", existing.pieceCarton, payload.piece_carton],
      ["Remark", "remark", existing.remark, payload.remark],
    ].forEach(([label, field, from, to]) => {
      if (String(from ?? "") === String(to ?? "")) return;
      entries.push({ at: now, action: `${label} updated`, field, from: from || "-", to: to || "-", message: `${label} changed from ${from || "-"} to ${to || "-"}.` });
    });
    const previousRows = shipmentPairText(existing.shipments);
    const nextRows = shipmentPairText(shipmentRows.map(normalizeShipmentRow));
    if (previousRows !== nextRows) entries.push({ at: now, action: "Shipment / PO rows updated", field: "inventory_ticket_shipments", from: previousRows || "-", to: nextRows || "-", message: "Shipment ID / PO rows were updated." });
    return entries;
  }

  function exportCsv() {
    const rows = filteredTickets();
    const headers = ["Inventory Ticket No", "External Ref No", "Product Name", "Container Ref", "Pallet Ref", "Linked Trip Plan", "FC", "Inventory Status", "Transport Status", "Exception Status", "Shipment / PO Rows", "Weight (KG)", "CBM", "Cartons", "Remark", "Updated At"];
    const csvRows = [headers, ...rows.map((ticket) => [
      ticket.ticketNo, ticket.externalRefNo, ticket.productName, ticket.containerRef, ticket.palletRef,
      tripPlanLabel(ticket.tripPlanId),
      ticket.fc, ticket.status, ticket.transportStatus, ticket.exceptionStatus, shipmentPairText(ticket.shipments),
      ticket.weightKg, ticket.volumeCbm, ticket.pieceCarton, ticket.remark, ticket.updatedAt,
    ])].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csvRows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function supabaseRequest(path, options = {}) {
    const response = await fetch(`${state.supabase.url}/rest/v1/${path}`, {
      ...options,
      headers: { apikey: state.supabase.key, Authorization: `Bearer ${state.supabase.key}`, "Content-Type": "application/json", ...(options.headers || {}) },
    });
    if (!response.ok) throw new Error(await response.text() || `Supabase request failed: ${response.status}`);
    if (response.status === 204) return [];
    const text = await response.text();
    return text ? JSON.parse(text) : [];
  }

  function normalizeTicket(row, shipments) {
    return {
      id: clean(row.id), ticketNo: clean(row.inventory_ticket_no), externalRefNo: clean(row.external_ref_no),
      productName: clean(row.product_name), containerRef: clean(row.container_ref), palletRef: clean(row.pallet_ref),
      tripPlanId: clean(row.trip_plan_id), fc: clean(row.fc),
      status: STATUSES.includes(clean(row.inventory_status)) ? clean(row.inventory_status) : "Draft",
      transportStatus: TRANSPORT_STATUSES.includes(clean(row.transport_status)) ? clean(row.transport_status) : "Not Started",
      exceptionStatus: EXCEPTION_STATUSES.includes(clean(row.exception_status)) ? clean(row.exception_status) : "None",
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

  function fillTripPlanOptions() {
    if (!els.tripPlanId) return;
    els.tripPlanId.innerHTML = '<option value="">No linked trip plan</option>' + state.tripPlans.map((plan) => `<option value="${escapeAttr(plan.id)}">${escapeHtml(plan.label)}</option>`).join("");
  }

  function tripPlanById(id) {
    return state.tripPlans.find((plan) => plan.id === clean(id)) || null;
  }

  function tripPlanLabel(id) {
    const plan = tripPlanById(id);
    return plan ? plan.label : clean(id);
  }

  function renderTripPlanLink(ticket) {
    if (!ticket.tripPlanId) return "-";
    return `<a class="ticket-detail-link" href="./trip-plan-detail.html?id=${encodeURIComponent(ticket.tripPlanId)}">${escapeHtml(tripPlanLabel(ticket.tripPlanId))}</a>`;
  }

  function legacyShipmentRows(row) {
    const shipmentId = clean(row.shipment_id);
    const po = clean(row.po);
    return shipmentId && po ? [{ id: "", shipmentId, po }] : [];
  }

  function ticketById(id) { return state.tickets.find((ticket) => ticket.id === id) || null; }
  function isDuplicateTicketNo(ticketNo, currentId) { const value = clean(ticketNo).toLowerCase(); return state.tickets.some((ticket) => ticket.id !== currentId && ticket.ticketNo.toLowerCase() === value); }
  function shipmentPairText(rows) { return rows.map((row) => `${clean(row.shipmentId || row.shipment_id)} / ${clean(row.po)}`).join("; "); }

  function searchableText(ticket) {
    return [ticket.ticketNo, ticket.externalRefNo, ticket.productName, ticket.containerRef, ticket.palletRef, tripPlanLabel(ticket.tripPlanId), ticket.fc, ticket.status, ticket.transportStatus, ticket.exceptionStatus, ticket.remark, shipmentPairText(ticket.shipments)].join(" ").toLowerCase();
  }

  function renderChangeLog(changeLog) {
    if (!changeLog.length) return '<p class="muted-note">No changes recorded.</p>';
    return `<div class="ticket-log-list">${changeLog.slice().reverse().map((entry) => `<article class="ticket-log-entry"><strong>${escapeHtml(entry.action || "Change")}</strong><span>${escapeHtml(formatDateTime(entry.at))}</span><p>${escapeHtml(entry.message || "")}</p></article>`).join("")}</div>`;
  }

  function metaRow(label, value) { return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`; }
  function statusChip(status) { return `<span class="status-chip status-${statusClass(status)}">${escapeHtml(status)}</span>`; }
  function statusClass(status) { return clean(status).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "draft"; }
  function setCloudStatus(message, type) { els.cloudStatus.textContent = message; els.cloudStatus.classList.toggle("connected-text", type === "connected"); els.cloudStatus.classList.toggle("error-text", type === "error"); }
  function setFormMessage(message, type) { els.formMessage.textContent = message; els.formMessage.classList.toggle("error", type === "error"); }
  function humanizeSaveError(message) { return message.toLowerCase().includes("duplicate") ? "Inventory Ticket No already exists." : message; }
  function formatDateTime(value) { if (!value) return "-"; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date); }
  function numberText(value, digits) { return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
  function amountValue(value, decimals = 2) { const number = Number(value); return Number.isFinite(number) ? Math.round(number * (10 ** decimals)) / (10 ** decimals) : 0; }
  function integerValue(value) { const number = Number(value); return Number.isFinite(number) ? Math.trunc(number) : 0; }
  function csvCell(value) { const text = clean(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
  function compactUnique(values) { return Array.from(new Set(values.map(clean).filter(Boolean))); }
  function clean(value) { return value === null || value === undefined ? "" : String(value).trim(); }
  function escapeHtml(value) { return clean(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }
})();
