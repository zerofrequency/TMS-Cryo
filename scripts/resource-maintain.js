(function () {
  "use strict";

  const RESOURCE_TYPES = {
    fleet: {
      title: "Carrier",
      baseTable: "fleet_resources",
      nameKey: "fleet_name",
      subtitle: "Register carriers, trucks, teams, and equipment notes.",
      fields: [
        { key: "fleet_name", label: "Carrier Name", required: true, placeholder: "Example: ABC Trucking" },
        { key: "fleet_type", label: "Carrier Type", type: "select", required: true, options: ["Third-Party Carrier", "Company Van Driver", "Company Truck Driver", "LTL Platform", "Other"] },
        { key: "capacity_mode", label: "Capacity Mode", type: "select", required: true, options: ["unlimited", "single"] },
        { key: "contact_name", label: "Contact" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email", type: "email" },
        { key: "equipment_type", label: "Equipment", placeholder: "Dry van, reefer, team..." },
        { key: "mc_number", label: "MC Number" },
        { key: "dot_number", label: "DOT Number" },
        { key: "home_base", label: "Home Base" },
        { key: "resource_status", label: "Base Status", type: "select", required: true, options: ["Active", "Inactive", "Maintenance"] },
        { key: "notes", label: "Notes", type: "textarea", full: true },
      ],
    },
    dock: {
      title: "Dock",
      baseTable: "dock_resources",
      nameKey: "dock_name",
      subtitle: "Register inbound/outbound dock doors and location notes.",
      fields: [
        { key: "dock_name", label: "Dock Name", required: true, placeholder: "Example: Dock 12" },
        { key: "dock_type", label: "Dock Type", type: "select", required: true, options: ["inbound", "outbound"] },
        { key: "fc", label: "FC" },
        { key: "location_note", label: "Location Note" },
        { key: "resource_status", label: "Base Status", type: "select", required: true, options: ["Active", "Inactive", "Maintenance"] },
        { key: "notes", label: "Notes", type: "textarea", full: true },
      ],
    },
    crew: {
      title: "Loading Crew",
      baseTable: "loading_crews",
      nameKey: "crew_name",
      subtitle: "Register loading teams, leads, shifts, and contact information.",
      fields: [
        { key: "crew_name", label: "Crew Name", required: true, placeholder: "Example: Night Loading A" },
        { key: "lead_name", label: "Lead" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email", type: "email" },
        { key: "crew_size", label: "Crew Size", type: "number", min: "1", step: "1" },
        { key: "shift", label: "Shift", placeholder: "Day, night, weekend..." },
        { key: "home_base", label: "Home Base" },
        { key: "resource_status", label: "Base Status", type: "select", required: true, options: ["Active", "Inactive", "Maintenance"] },
        { key: "notes", label: "Notes", type: "textarea", full: true },
      ],
    },
  };

  const els = {
    cloudStatus: document.getElementById("cloudStatus"),
    tabs: Array.from(document.querySelectorAll("[data-resource]")),
    totalCount: document.getElementById("totalCount"),
    activeCount: document.getElementById("activeCount"),
    inactiveCount: document.getElementById("inactiveCount"),
    maintenanceCount: document.getElementById("maintenanceCount"),
    resourceForm: document.getElementById("resourceForm"),
    resourceFormTitle: document.getElementById("resourceFormTitle"),
    resourceFormSubtitle: document.getElementById("resourceFormSubtitle"),
    resourceFields: document.getElementById("resourceFields"),
    clearResourceForm: document.getElementById("clearResourceForm"),
    saveResourceButton: document.getElementById("saveResourceButton"),
    resourceMessage: document.getElementById("resourceMessage"),
    refreshButton: document.getElementById("refreshButton"),
    resourceListTitle: document.getElementById("resourceListTitle"),
    resourceListSummary: document.getElementById("resourceListSummary"),
    resourceTableHead: document.getElementById("resourceTableHead"),
    resourceRows: document.getElementById("resourceRows"),
  };

  const state = {
    activeType: "fleet",
    apiEnabled: false,
    resources: [],
    editingResourceId: "",
  };

  boot();

  async function boot() {
    loadApiConfig();
    bindEvents();
    const requestedTypeParam = new URLSearchParams(window.location.search).get("type");
    const requestedType = requestedTypeParam === "carrier" ? "fleet" : requestedTypeParam;
    if (RESOURCE_TYPES[requestedType]) state.activeType = requestedType;
    renderShell();
    if (!state.apiEnabled) {
      setCloudStatus("TMS API is unavailable", "error");
      return;
    }
    await loadResources();
  }

  function bindEvents() {
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        state.activeType = tab.dataset.resource;
        state.editingResourceId = "";
        state.resources = [];
        renderShell();
        if (state.apiEnabled) loadResources();
      });
    });
    els.refreshButton.addEventListener("click", loadResources);
    els.clearResourceForm.addEventListener("click", () => {
      state.editingResourceId = "";
      renderResourceForm();
      setFormMessage("", "");
    });
    els.resourceForm.addEventListener("submit", saveResource);
    els.resourceRows.addEventListener("click", (event) => {
      const editButton = event.target.closest("[data-edit-resource]");
      if (!editButton) return;
      state.editingResourceId = editButton.dataset.editResource;
      renderResourceForm();
      setFormMessage("Editing selected resource.", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function loadApiConfig() {
    state.apiEnabled = Boolean(window.TmsApi && window.TmsApi.isConfigured());
  }

  async function loadResources() {
    try {
      setCloudStatus("Loading TMS data", "");
      const config = currentConfig();
      const resources = await apiRequest(`${config.baseTable}?select=*&order=created_at.desc`);
      state.resources = resources.map(normalizeResource);
      setCloudStatus("Connected", "connected");
      render();
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
      render();
    }
  }

  function renderShell() {
    const config = currentConfig();
    els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.resource === state.activeType));
    els.resourceFormTitle.textContent = `${config.title} Registration`;
    els.resourceFormSubtitle.textContent = config.subtitle;
    els.resourceListTitle.textContent = `${config.title} List`;
    renderResourceForm();
    renderTableHead();
    render();
  }

  function render() {
    renderStats();
    renderResourceRows();
  }

  function renderStats() {
    els.totalCount.textContent = state.resources.length;
    els.activeCount.textContent = state.resources.filter((resource) => resource.resource_status === "Active").length;
    els.inactiveCount.textContent = state.resources.filter((resource) => resource.resource_status === "Inactive").length;
    els.maintenanceCount.textContent = state.resources.filter((resource) => resource.resource_status === "Maintenance").length;
  }

  function renderResourceForm() {
    const config = currentConfig();
    const editing = state.resources.find((resource) => resource.id === state.editingResourceId) || {};
    els.saveResourceButton.textContent = editing.id ? "Update Resource" : "Save Resource";
    els.resourceFields.innerHTML = config.fields.map((field) => renderField(field, editing[field.key])).join("");
  }

  function renderField(field, value) {
    const required = field.required ? ' data-required="true"' : "";
    const fullClass = field.full ? "full" : "";
    const fieldValue = value !== undefined && value !== null ? value : defaultFieldValue(field);
    if (field.type === "select") {
      return `
        <label class="${fullClass}">
          ${escapeHtml(field.label)}
          <select data-field="${escapeAttr(field.key)}"${required}>
            ${field.options.map((option) => `<option value="${escapeAttr(option)}" ${option === fieldValue ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
          </select>
        </label>
      `;
    }
    if (field.type === "textarea") {
      return `
        <label class="${fullClass}">
          ${escapeHtml(field.label)}
          <textarea data-field="${escapeAttr(field.key)}" rows="3"${required} placeholder="${escapeAttr(field.placeholder || "")}">${escapeHtml(fieldValue)}</textarea>
        </label>
      `;
    }
    return `
      <label class="${fullClass}">
        ${escapeHtml(field.label)}
        <input data-field="${escapeAttr(field.key)}" type="${escapeAttr(field.type || "text")}" value="${escapeAttr(fieldValue)}"${required} min="${escapeAttr(field.min || "")}" step="${escapeAttr(field.step || "")}" placeholder="${escapeAttr(field.placeholder || "")}" />
      </label>
    `;
  }

  function renderTableHead() {
    if (state.activeType === "fleet") {
      els.resourceTableHead.innerHTML = "<th>Carrier</th><th>Contact</th><th>Equipment</th><th>Status</th><th>Notes</th><th>Actions</th>";
      return;
    }
    if (state.activeType === "dock") {
      els.resourceTableHead.innerHTML = "<th>Dock</th><th>Type</th><th>FC</th><th>Status</th><th>Notes</th><th>Actions</th>";
      return;
    }
    els.resourceTableHead.innerHTML = "<th>Crew</th><th>Lead</th><th>Size / Shift</th><th>Status</th><th>Notes</th><th>Actions</th>";
  }

  function renderResourceRows() {
    els.resourceListSummary.textContent = state.resources.length
      ? `${state.resources.length} ${currentConfig().title.toLowerCase()} resources loaded`
      : "No resources loaded";
    if (!state.resources.length) {
      els.resourceRows.innerHTML = `<tr><td class="empty-row" colspan="6">No ${escapeHtml(currentConfig().title.toLowerCase())} resources saved.</td></tr>`;
      return;
    }
    els.resourceRows.innerHTML = state.resources.map((resource) => {
      if (state.activeType === "fleet") return renderFleetRow(resource);
      if (state.activeType === "dock") return renderDockRow(resource);
      return renderCrewRow(resource);
    }).join("");
  }

  function renderFleetRow(resource) {
    const meta = compactText([resource.fleet_type, resource.capacity_mode]);
    return `
      <tr>
        <td class="resource-name-cell"><strong>${escapeHtml(resource.fleet_name)}</strong><small>${escapeHtml(meta || "-")}</small></td>
        <td>${escapeHtml(compactText([resource.contact_name, resource.phone]))}</td>
        <td>${escapeHtml(resource.equipment_type || "-")}</td>
        <td>${statusChip(resource.resource_status)}</td>
        <td>${escapeHtml(resource.notes || "-")}</td>
        <td>${resourceActionButtons(resource)}</td>
      </tr>
    `;
  }

  function renderDockRow(resource) {
    return `
      <tr>
        <td class="resource-name-cell"><strong>${escapeHtml(resource.dock_name)}</strong><small>${escapeHtml(resource.location_note || "-")}</small></td>
        <td>${escapeHtml(resource.dock_type || "-")}</td>
        <td>${escapeHtml(resource.fc || "-")}</td>
        <td>${statusChip(resource.resource_status)}</td>
        <td>${escapeHtml(resource.notes || "-")}</td>
        <td>${resourceActionButtons(resource)}</td>
      </tr>
    `;
  }

  function renderCrewRow(resource) {
    return `
      <tr>
        <td class="resource-name-cell"><strong>${escapeHtml(resource.crew_name)}</strong><small>${escapeHtml(resource.home_base || "-")}</small></td>
        <td>${escapeHtml(compactText([resource.lead_name, resource.phone]))}</td>
        <td>${escapeHtml(compactText([resource.crew_size ? `${resource.crew_size} people` : "", resource.shift]))}</td>
        <td>${statusChip(resource.resource_status)}</td>
        <td>${escapeHtml(resource.notes || "-")}</td>
        <td>${resourceActionButtons(resource)}</td>
      </tr>
    `;
  }

  async function saveResource(event) {
    event.preventDefault();
    if (!state.apiEnabled) return;
    const config = currentConfig();
    const payload = readResourcePayload(config);
    if (!payload) return;
    try {
      setFormMessage("Saving resource...", "");
      const isEditing = Boolean(state.editingResourceId);
      const path = isEditing
        ? `${config.baseTable}?id=eq.${encodeURIComponent(state.editingResourceId)}`
        : config.baseTable;
      await apiRequest(path, {
        method: isEditing ? "PATCH" : "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
      });
      state.editingResourceId = "";
      setFormMessage(isEditing ? "Resource updated." : "Resource saved.", "success");
      await loadResources();
      renderResourceForm();
    } catch (error) {
      console.error(error);
      setFormMessage(error.message, "error");
    }
  }

  function readResourcePayload(config) {
    const payload = {};
    const inputs = Array.from(els.resourceFields.querySelectorAll("[data-field]"));
    for (const input of inputs) {
      const key = input.dataset.field;
      const field = config.fields.find((item) => item.key === key);
      const value = clean(input.value);
      if (field && field.required && !value) {
        setFormMessage(`${field.label} is required.`, "error");
        input.focus();
        return null;
      }
      if (field && field.type === "number") {
        payload[key] = value ? Number(value) : (key === "crew_size" ? 1 : null);
      } else {
        payload[key] = value || null;
      }
    }
    return payload;
  }

  function resourceActionButtons(resource) {
    return `<button class="button compact neutral" type="button" data-edit-resource="${escapeAttr(resource.id)}">Edit</button>`;
  }

  function normalizeResource(row) {
    return {
      ...row,
      id: clean(row.id),
      resource_status: clean(row.resource_status) || "Active",
    };
  }

  function apiRequest(path, options = {}) {
    return window.TmsApi.request(path, options);
  }

  function currentConfig() {
    return RESOURCE_TYPES[state.activeType] || RESOURCE_TYPES.fleet;
  }

  function statusChip(status) {
    return `<span class="status-chip ${statusClass(status)}">${escapeHtml(status)}</span>`;
  }

  function defaultFieldValue(field) {
    if (field.key === "resource_status") return "Active";
    if (field.key === "crew_size") return "1";
    return field.options ? field.options[0] : "";
  }

  function compactText(values) {
    return values.map(clean).filter(Boolean).join(" · ") || "-";
  }

  function setCloudStatus(message, type) {
    els.cloudStatus.textContent = message;
    els.cloudStatus.classList.toggle("connected-text", type === "connected");
    els.cloudStatus.classList.toggle("error-text", type === "error");
  }

  function setFormMessage(message, type) {
    els.resourceMessage.textContent = message;
    els.resourceMessage.classList.toggle("error", type === "error");
    els.resourceMessage.classList.toggle("success", type === "success");
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
