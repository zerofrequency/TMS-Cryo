(function () {
  "use strict";

  const BILL_TABLE = "carrier_bills";
  const TRIP_TABLE = "trip_plans";
  const CARRIER_RESOURCE_TABLE = "fleet_resources";
  const CARRIER_ASSIGNMENT_TABLE = "fleet_assignments";
  const BILLING_STATUSES = ["Draft", "Submitted", "Under Review", "Approved", "Disputed", "Paid", "Voided"];
  const FEE_FIELDS = [
    ["baseFreight", "base_freight", "Base Freight"],
    ["fuelSurcharge", "fuel_surcharge", "Fuel Surcharge"],
    ["accessorialFee", "accessorial_fee", "Accessorial Fee"],
    ["detentionFee", "detention_fee", "Detention Fee"],
    ["lumperFee", "lumper_fee", "Lumper Fee"],
    ["otherFee", "other_fee", "Other Fee"],
  ];

  const els = {
    totalBills: document.getElementById("totalBills"),
    approvedAmount: document.getElementById("approvedAmount"),
    unpaidAmount: document.getElementById("unpaidAmount"),
    disputedAmount: document.getElementById("disputedAmount"),
    searchInput: document.getElementById("searchInput"),
    carrierFilter: document.getElementById("carrierFilter"),
    statusFilter: document.getElementById("statusFilter"),
    invoiceFrom: document.getElementById("invoiceFrom"),
    invoiceTo: document.getElementById("invoiceTo"),
    dueFrom: document.getElementById("dueFrom"),
    dueTo: document.getElementById("dueTo"),
    clearFilters: document.getElementById("clearFilters"),
    newBillButton: document.getElementById("newBillButton"),
    exportButton: document.getElementById("exportButton"),
    cloudStatus: document.getElementById("cloudStatus"),
    resultCount: document.getElementById("resultCount"),
    billRows: document.getElementById("billRows"),
    emptyState: document.getElementById("emptyState"),
    detailEmpty: document.getElementById("detailEmpty"),
    detailView: document.getElementById("detailView"),
    billForm: document.getElementById("billForm"),
    formModeBadge: document.getElementById("formModeBadge"),
    formTitle: document.getElementById("formTitle"),
    cancelFormButton: document.getElementById("cancelFormButton"),
    resetFormButton: document.getElementById("resetFormButton"),
    tripPlanId: document.getElementById("tripPlanId"),
    carrierName: document.getElementById("carrierName"),
    invoiceNumber: document.getElementById("invoiceNumber"),
    duplicateWarning: document.getElementById("duplicateWarning"),
    invoiceDate: document.getElementById("invoiceDate"),
    dueDate: document.getElementById("dueDate"),
    paidDate: document.getElementById("paidDate"),
    billingStatus: document.getElementById("billingStatus"),
    totalPreview: document.getElementById("totalPreview"),
    currency: document.getElementById("currency"),
    notes: document.getElementById("notes"),
    formMessage: document.getElementById("formMessage"),
  };

  const state = {
    supabase: { url: "", key: "", enabled: false },
    bills: [],
    plans: [],
    selectedId: "",
    editingId: "",
  };

  boot();

  async function boot() {
    loadSupabaseConfig();
    bindEvents();
    fillStaticOptions();
    if (!state.supabase.enabled) {
      setCloudStatus("Add anon key in supabase-config.js", "error");
      render();
      return;
    }
    await loadData();
  }

  function bindEvents() {
    [els.searchInput, els.carrierFilter, els.statusFilter, els.invoiceFrom, els.invoiceTo, els.dueFrom, els.dueTo].forEach((element) => {
      element.addEventListener("input", render);
      element.addEventListener("change", render);
    });
    els.clearFilters.addEventListener("click", clearFilters);
    els.newBillButton.addEventListener("click", () => showForm());
    els.exportButton.addEventListener("click", exportCsv);
    els.billRows.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-bill]");
      if (editButton) {
        showForm(editButton.dataset.editBill);
        return;
      }
      const viewButton = event.target.closest("[data-view-bill]");
      const row = event.target.closest("[data-bill-id]");
      const billId = viewButton ? viewButton.dataset.viewBill : row && row.dataset.billId;
      if (!billId) return;
      state.selectedId = billId;
      state.editingId = "";
      render();
    });
    els.cancelFormButton.addEventListener("click", hideForm);
    els.resetFormButton.addEventListener("click", () => showForm(state.editingId));
    els.billForm.addEventListener("submit", saveBill);
    els.invoiceNumber.addEventListener("input", renderDuplicateWarning);
    els.tripPlanId.addEventListener("change", fillCarrierFromSelectedPlan);
    els.billingStatus.addEventListener("change", renderStatusGuidance);
    [els.carrierName, els.notes, els.paidDate].forEach((element) => element.addEventListener("input", renderStatusGuidance));
    FEE_FIELDS.forEach(([id]) => document.getElementById(id).addEventListener("input", updateTotalPreview));
  }

  function loadSupabaseConfig() {
    const config = window.CARRIER_APPT_SUPABASE || {};
    state.supabase.url = clean(config.url).replace(/\/+$/, "");
    state.supabase.key = clean(config.anonKey || config.key);
    state.supabase.enabled = Boolean(state.supabase.url && state.supabase.key);
  }

  function fillStaticOptions() {
    els.statusFilter.innerHTML = '<option value="">All statuses</option>' + BILLING_STATUSES.map(optionHtml).join("");
    els.billingStatus.innerHTML = BILLING_STATUSES.map(optionHtml).join("");
  }

  async function loadData() {
    try {
      setCloudStatus("Loading Supabase", "");
      const [bills, plans, carrierResources, carrierAssignments] = await Promise.all([
        supabaseRequest(`${BILL_TABLE}?select=*&order=updated_at.desc`),
        supabaseRequest(`${TRIP_TABLE}?select=id,plan_name,plan_type,plan_status,plan_date,etd_date,etd_period,updated_at&order=etd_at.desc`),
        supabaseRequest(`${CARRIER_RESOURCE_TABLE}?select=id,fleet_name`),
        supabaseRequest(`${CARRIER_ASSIGNMENT_TABLE}?select=*&order=created_at.desc`),
      ]);
      const carrierByPlan = buildCarrierByPlan(carrierResources, carrierAssignments);
      state.plans = plans.map((plan) => normalizePlan(plan, carrierByPlan));
      state.bills = bills.map(normalizeBill);
      if (!state.selectedId && state.bills.length) state.selectedId = state.bills[0].id;
      fillTripPlanOptions();
      fillCarrierFilter();
      setCloudStatus("Connected", "connected");
      render();
    } catch (error) {
      setCloudStatus(error.message, "error");
      render();
    }
  }

  function render() {
    const filtered = filteredBills();
    renderStats();
    renderRows(filtered);
    renderDetail();
    if (!els.billForm.classList.contains("hidden")) {
      updateTotalPreview();
      renderDuplicateWarning();
      renderStatusGuidance();
    }
  }

  function renderStats() {
    els.totalBills.textContent = state.bills.length;
    els.approvedAmount.textContent = money(sumBills(state.bills.filter((bill) => bill.status === "Approved")));
    els.unpaidAmount.textContent = money(sumBills(state.bills.filter((bill) => bill.status !== "Paid" && bill.status !== "Voided")));
    els.disputedAmount.textContent = money(sumBills(state.bills.filter((bill) => bill.status === "Disputed")));
  }

  function renderRows(bills) {
    els.resultCount.textContent = bills.length ? `${bills.length} visible of ${state.bills.length} bills` : resultEmptyLabel();
    els.emptyState.innerHTML = state.bills.length ? `
      <h3>No matching carrier bills</h3>
      <p>Adjust search or clear filters to see more results.</p>
    ` : `
      <h3>No carrier bills found</h3>
      <p>Create a carrier bill or adjust filters to review billing records.</p>
    `;
    els.emptyState.classList.toggle("hidden", bills.length > 0);
    els.billRows.innerHTML = bills.map((bill) => {
      const plan = tripPlanFor(bill.tripPlanId);
      return `
        <tr class="${bill.id === state.selectedId ? "selected-row" : ""}" data-bill-id="${escapeAttr(bill.id)}">
          <td>
            <strong>${escapeHtml(bill.carrierName || "-")}</strong>
            <small>${escapeHtml(overdueText(bill))}</small>
          </td>
          <td>
            <strong>${escapeHtml(plan ? plan.name : "Unlinked")}</strong>
            <small>${escapeHtml(plan ? compactUnique([plan.status, plan.carrier]).join(" / ") : "-")}</small>
          </td>
          <td>${escapeHtml(bill.invoiceNumber || "-")}</td>
          <td>${statusChip(bill.status)}</td>
          <td>${escapeHtml(bill.invoiceDate || "-")}</td>
          <td class="${isOverdue(bill) ? "overdue-text" : ""}">${escapeHtml(bill.dueDate || "-")}</td>
          <td>${escapeHtml(money(bill.totalAmount))}</td>
          <td>${escapeHtml(bill.currency)}</td>
          <td>${escapeHtml(formatDateTime(bill.updatedAt))}</td>
          <td>
            <div class="row-actions">
              <button class="button compact" type="button" data-view-bill="${escapeAttr(bill.id)}">View</button>
              <button class="button compact" type="button" data-edit-bill="${escapeAttr(bill.id)}">Edit</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function resultEmptyLabel() {
    return state.bills.length ? "No matching bills" : "No bills loaded";
  }

  function renderDetail() {
    const isEditing = !els.billForm.classList.contains("hidden");
    const bill = state.bills.find((item) => item.id === state.selectedId);
    els.detailEmpty.classList.toggle("hidden", Boolean(bill) || isEditing);
    els.detailView.classList.toggle("hidden", !bill || isEditing);
    if (!bill || isEditing) {
      els.detailView.innerHTML = "";
      return;
    }
    const plan = tripPlanFor(bill.tripPlanId);
    els.detailView.innerHTML = `
      <div class="detail-title">
        <div>
          ${statusChip(bill.status)}
          <h2>${escapeHtml(bill.carrierName || "Carrier Bill")}</h2>
        </div>
        <button class="button compact" type="button" data-edit-bill="${escapeAttr(bill.id)}">Edit</button>
      </div>
      <dl class="meta">
        <div><dt>Trip Plan</dt><dd>${escapeHtml(plan ? `${plan.name} / ${plan.status}` : "Unlinked")}</dd></div>
        <div><dt>Carrier</dt><dd>${escapeHtml(plan && plan.carrier ? plan.carrier : bill.carrierName || "-")}</dd></div>
        <div><dt>Invoice</dt><dd>${escapeHtml(bill.invoiceNumber || "-")}</dd></div>
        <div><dt>Invoice Date</dt><dd>${escapeHtml(bill.invoiceDate || "-")}</dd></div>
        <div><dt>Due Date</dt><dd class="${isOverdue(bill) ? "overdue-text" : ""}">${escapeHtml(bill.dueDate || "-")}</dd></div>
        <div><dt>Paid Date</dt><dd>${escapeHtml(bill.paidDate || "-")}</dd></div>
        <div><dt>Total</dt><dd>${escapeHtml(`${money(bill.totalAmount)} ${bill.currency}`)}</dd></div>
        <div><dt>Updated</dt><dd>${escapeHtml(formatDateTime(bill.updatedAt))}</dd></div>
      </dl>
      <section class="detail-section">
        <h3>Fee Breakdown</h3>
        <div class="fee-breakdown">${FEE_FIELDS.map(([, column, label]) => `
          <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(money(bill[column]))}</strong></div>
        `).join("")}</div>
      </section>
      ${bill.notes ? `<section class="detail-section"><h3>Notes</h3><p>${escapeHtml(bill.notes)}</p></section>` : ""}
      <section class="detail-section">
        <h3>Change Log</h3>
        ${renderChangeLog(bill.changeLog)}
      </section>
    `;
    const editButton = els.detailView.querySelector("[data-edit-bill]");
    editButton.addEventListener("click", () => showForm(bill.id));
  }

  function renderChangeLog(changeLog) {
    const entries = Array.isArray(changeLog) ? changeLog : [];
    if (!entries.length) return '<p class="muted-note">No changes recorded.</p>';
    return `
      <div class="bill-log-list">
        ${entries.slice().reverse().map((entry) => `
          <div class="bill-log-entry">
            <strong>${escapeHtml(entry.action || "Change")}</strong>
            <span>${escapeHtml(formatDateTime(entry.at))}</span>
            <p>${escapeHtml(entry.message || "")}</p>
          </div>
        `).join("")}
      </div>
    `;
  }

  function filteredBills() {
    const query = clean(els.searchInput.value).toLowerCase();
    const carrier = els.carrierFilter.value;
    const status = els.statusFilter.value;
    return state.bills.filter((bill) => {
      if (carrier && bill.carrierName !== carrier) return false;
      if (status && bill.status !== status) return false;
      if (els.invoiceFrom.value && bill.invoiceDate < els.invoiceFrom.value) return false;
      if (els.invoiceTo.value && bill.invoiceDate > els.invoiceTo.value) return false;
      if (els.dueFrom.value && bill.dueDate < els.dueFrom.value) return false;
      if (els.dueTo.value && bill.dueDate > els.dueTo.value) return false;
      if (!query) return true;
      return searchableText(bill).includes(query);
    });
  }

  function showForm(billId = "") {
    const bill = state.bills.find((item) => item.id === billId);
    state.editingId = bill ? bill.id : "";
    if (bill) state.selectedId = bill.id;
    els.detailEmpty.classList.add("hidden");
    els.detailView.classList.add("hidden");
    els.billForm.classList.remove("hidden");
    els.formModeBadge.textContent = bill ? "Edit" : "New";
    els.formTitle.textContent = bill ? "Edit Carrier Bill" : "New Carrier Bill";
    els.tripPlanId.value = bill ? bill.tripPlanId : "";
    els.carrierName.value = bill ? bill.carrierName : "";
    if (!bill) fillCarrierFromSelectedPlan();
    els.invoiceNumber.value = bill ? bill.invoiceNumber : "";
    els.invoiceDate.value = bill ? bill.invoiceDate : "";
    els.dueDate.value = bill ? bill.dueDate : "";
    els.paidDate.value = bill ? bill.paidDate : "";
    els.billingStatus.value = bill ? bill.status : "Draft";
    FEE_FIELDS.forEach(([id, column]) => {
      document.getElementById(id).value = bill && bill[column] ? Number(bill[column]).toFixed(2) : "";
    });
    els.currency.value = bill ? bill.currency : "USD";
    els.notes.value = bill ? bill.notes : "";
    setFormMessage("", "");
    render();
  }

  function fillCarrierFromSelectedPlan() {
    const plan = tripPlanFor(els.tripPlanId.value);
    els.carrierName.value = plan && plan.carrier ? plan.carrier : "";
    renderStatusGuidance();
  }

  function hideForm() {
    state.editingId = "";
    els.billForm.classList.add("hidden");
    render();
  }

  async function saveBill(event) {
    event.preventDefault();
    if (!state.supabase.enabled) {
      setFormMessage("Supabase is not configured.", "error");
      return;
    }
    const payload = formPayload();
    if (payload.billing_status === "Paid" && !payload.paid_date) {
      setFormMessage("Paid status requires a paid date.", "error");
      els.paidDate.focus();
      return;
    }
    const existing = state.bills.find((bill) => bill.id === state.editingId);
    payload.change_log = nextChangeLog(existing, payload);
    try {
      setFormMessage("Saving bill...", "");
      setCloudStatus("Saving bill", "");
      if (existing) {
        await supabaseRequest(`${BILL_TABLE}?id=eq.${encodeURIComponent(existing.id)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify(payload),
        });
        state.bills = state.bills.map((bill) => bill.id === existing.id ? normalizeBill({ ...existing.raw, ...payload, id: existing.id }) : bill);
        state.selectedId = existing.id;
      } else {
        const rows = await supabaseRequest(BILL_TABLE, {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(payload),
        });
        const created = normalizeBill(rows[0]);
        state.bills = [created, ...state.bills];
        state.selectedId = created.id;
      }
      fillCarrierFilter();
      hideForm();
      setCloudStatus("Saved", "connected");
    } catch (error) {
      setFormMessage(error.message, "error");
      setCloudStatus(error.message, "error");
    }
  }

  function formPayload() {
    const payload = {
      trip_plan_id: els.tripPlanId.value || null,
      carrier_name: clean(els.carrierName.value),
      invoice_number: clean(els.invoiceNumber.value),
      invoice_date: els.invoiceDate.value || null,
      due_date: els.dueDate.value || null,
      paid_date: els.paidDate.value || null,
      billing_status: els.billingStatus.value || "Draft",
      currency: (clean(els.currency.value) || "USD").toUpperCase(),
      notes: clean(els.notes.value),
      updated_at: new Date().toISOString(),
    };
    FEE_FIELDS.forEach(([id, column]) => {
      payload[column] = amountValue(document.getElementById(id).value);
    });
    payload.total_amount = calculateTotal(payload);
    return payload;
  }

  function nextChangeLog(existing, payload) {
    const now = new Date().toISOString();
    const entries = existing && Array.isArray(existing.changeLog) ? [...existing.changeLog] : [];
    if (!existing) {
      entries.push({
        at: now,
        action: "Bill created",
        message: `Carrier bill created with total ${money(payload.total_amount)} ${payload.currency}.`,
      });
      return entries;
    }
    if (existing.status !== payload.billing_status) {
      entries.push({
        at: now,
        action: "Status updated",
        field: "billing_status",
        from: existing.status,
        to: payload.billing_status,
        message: `Status changed from ${existing.status} to ${payload.billing_status}.`,
      });
    }
    if (Number(existing.totalAmount) !== Number(payload.total_amount)) {
      entries.push({
        at: now,
        action: "Amount updated",
        field: "total_amount",
        from: existing.totalAmount,
        to: payload.total_amount,
        message: `Total changed from ${money(existing.totalAmount)} to ${money(payload.total_amount)}.`,
      });
    }
    return entries;
  }

  function exportCsv() {
    const rows = filteredBills();
    const headers = [
      "Carrier", "Trip Plan", "Trip Status", "Invoice Number", "Invoice Date", "Due Date", "Paid Date", "Billing Status",
      "Base Freight", "Fuel Surcharge", "Accessorial Fee", "Detention Fee", "Lumper Fee", "Other Fee", "Total Amount", "Currency", "Notes", "Updated At",
    ];
    const csvRows = [headers, ...rows.map((bill) => {
      const plan = tripPlanFor(bill.tripPlanId);
      return [
        bill.carrierName,
        plan ? plan.name : "",
        plan ? plan.status : "",
        bill.invoiceNumber,
        bill.invoiceDate,
        bill.dueDate,
        bill.paidDate,
        bill.status,
        bill.base_freight,
        bill.fuel_surcharge,
        bill.accessorial_fee,
        bill.detention_fee,
        bill.lumper_fee,
        bill.other_fee,
        bill.totalAmount,
        bill.currency,
        bill.notes,
        bill.updatedAt,
      ];
    })].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csvRows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `carrier-bills-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    [els.searchInput, els.carrierFilter, els.statusFilter, els.invoiceFrom, els.invoiceTo, els.dueFrom, els.dueTo].forEach((element) => {
      element.value = "";
    });
    render();
  }

  function updateTotalPreview() {
    const payload = {};
    FEE_FIELDS.forEach(([id, column]) => {
      payload[column] = amountValue(document.getElementById(id).value);
    });
    els.totalPreview.textContent = money(calculateTotal(payload));
  }

  function renderDuplicateWarning() {
    const invoiceNumber = clean(els.invoiceNumber.value).toLowerCase();
    const duplicate = invoiceNumber && state.bills.some((bill) => (
      bill.id !== state.editingId && bill.invoiceNumber.toLowerCase() === invoiceNumber
    ));
    els.duplicateWarning.classList.toggle("hidden", !duplicate);
  }

  function renderStatusGuidance() {
    if (els.billingStatus.value === "Disputed" && !clean(els.notes.value)) {
      setFormMessage("Disputed bills should include notes explaining the dispute.", "error");
      return;
    }
    if (els.billingStatus.value === "Paid" && !els.paidDate.value) {
      setFormMessage("Paid status requires a paid date.", "error");
      return;
    }
    if (els.formMessage.classList.contains("error")) setFormMessage("", "");
  }

  function fillTripPlanOptions() {
    els.tripPlanId.innerHTML = '<option value="">No linked trip plan</option>' + state.plans.map((plan) => (
      `<option value="${escapeAttr(plan.id)}">${escapeHtml(compactUnique([plan.name, plan.status, plan.carrier]).join(" / "))}</option>`
    )).join("");
  }

  function fillCarrierFilter() {
    const current = els.carrierFilter.value;
    const carriers = compactUnique(state.bills.map((bill) => bill.carrierName));
    els.carrierFilter.innerHTML = '<option value="">All carriers</option>' + carriers.map(optionHtml).join("");
    if (carriers.includes(current)) els.carrierFilter.value = current;
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

  function normalizeBill(row) {
    const total = amountValue(row.total_amount);
    return {
      raw: row,
      id: clean(row.id),
      tripPlanId: clean(row.trip_plan_id),
      carrierName: clean(row.carrier_name),
      invoiceNumber: clean(row.invoice_number),
      invoiceDate: clean(row.invoice_date),
      dueDate: clean(row.due_date),
      paidDate: clean(row.paid_date),
      status: BILLING_STATUSES.includes(clean(row.billing_status)) ? clean(row.billing_status) : "Draft",
      base_freight: amountValue(row.base_freight),
      fuel_surcharge: amountValue(row.fuel_surcharge),
      accessorial_fee: amountValue(row.accessorial_fee),
      detention_fee: amountValue(row.detention_fee),
      lumper_fee: amountValue(row.lumper_fee),
      other_fee: amountValue(row.other_fee),
      totalAmount: total,
      currency: clean(row.currency) || "USD",
      notes: clean(row.notes),
      changeLog: Array.isArray(row.change_log) ? row.change_log : [],
      updatedAt: clean(row.updated_at),
    };
  }

  function normalizePlan(row, carrierByPlan = new Map()) {
    return {
      id: clean(row.id),
      name: clean(row.plan_name) || clean(row.plan_type) || "Untitled Plan",
      status: clean(row.plan_status) || "Planned",
      carrier: clean(carrierByPlan.get(clean(row.id))),
      planDate: clean(row.plan_date),
      etdDate: clean(row.etd_date),
      etdPeriod: clean(row.etd_period),
      updatedAt: clean(row.updated_at),
    };
  }

  function tripPlanFor(tripPlanId) {
    return state.plans.find((plan) => plan.id === tripPlanId);
  }

  function buildCarrierByPlan(resources, assignments) {
    const resourceNameById = new Map((Array.isArray(resources) ? resources : []).map((resource) => [
      clean(resource.id),
      clean(resource.fleet_name),
    ]));
    const carrierByPlan = new Map();
    (Array.isArray(assignments) ? assignments : []).forEach((assignment) => {
      if (clean(assignment.assignment_status) !== "Active") return;
      const tripPlanId = clean(assignment.trip_plan_id);
      if (!tripPlanId || carrierByPlan.has(tripPlanId)) return;
      carrierByPlan.set(tripPlanId, resourceNameById.get(clean(assignment.fleet_id)) || "");
    });
    return carrierByPlan;
  }

  function searchableText(bill) {
    const plan = tripPlanFor(bill.tripPlanId);
    return [
      bill.carrierName,
      bill.invoiceNumber,
      bill.status,
      bill.notes,
      plan ? plan.name : "",
      plan ? plan.status : "",
      plan ? plan.carrier : "",
    ].join(" ").toLowerCase();
  }

  function calculateTotal(payload) {
    return FEE_FIELDS.reduce((sum, [, column]) => sum + amountValue(payload[column]), 0);
  }

  function sumBills(bills) {
    return bills.reduce((sum, bill) => sum + amountValue(bill.totalAmount), 0);
  }

  function amountValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
  }

  function isOverdue(bill) {
    if (!bill.dueDate || bill.status === "Paid" || bill.status === "Voided") return false;
    return bill.dueDate < new Date().toISOString().slice(0, 10);
  }

  function overdueText(bill) {
    return isOverdue(bill) ? "Overdue" : " ";
  }

  function statusChip(status) {
    return `<span class="status-chip status-${statusClass(status)}">${escapeHtml(status || "Draft")}</span>`;
  }

  function statusClass(status) {
    return clean(status).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "draft";
  }

  function setCloudStatus(message, type) {
    els.cloudStatus.textContent = message;
    els.cloudStatus.classList.toggle("connected-text", type === "connected");
    els.cloudStatus.classList.toggle("error-text", type === "error");
  }

  function setFormMessage(message, type) {
    els.formMessage.textContent = message;
    els.formMessage.classList.toggle("error", type === "error");
    els.formMessage.classList.toggle("success", type === "success");
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

  function money(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amountValue(value));
  }

  function optionHtml(value) {
    return `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`;
  }

  function csvCell(value) {
    const text = clean(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function compactUnique(values) {
    return Array.from(new Set(values.map(clean).filter(Boolean))).sort((a, b) => a.localeCompare(b));
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
