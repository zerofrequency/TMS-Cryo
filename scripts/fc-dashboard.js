(function () {
  "use strict";

  const FC_TABLE = "fba_fcs";
  const WEEK_TABLE = "fc_weekly_appointments";
  const STATUS_META = {
    Normal: { label: "正常预约", className: "normal", color: 0x00b050 },
    "Slightly Busy": { label: "轻微拥挤", className: "slight", color: 0xffe100 },
    "Very Busy": { label: "十分拥挤", className: "very", color: 0xff7a00 },
    "Severely Full": { label: "严重爆仓", className: "severe", color: 0xff0000 },
  };
  const STATUS_SEVERITY = {
    Normal: 1,
    "Slightly Busy": 2,
    "Very Busy": 3,
    "Severely Full": 4,
  };
  const REGION_COLORS = {
    west: "rgb(57, 104, 46)",
    central: "rgb(103, 137, 64)",
    east: "rgb(94, 130, 52)",
  };
  const WEST_STATES = new Set(["WA", "OR", "CA", "NV", "ID", "WY", "UT", "AZ", "CO", "NM"]);
  const CENTRAL_STATES = new Set(["ND", "SD", "NE", "KS", "OK", "TX", "MN", "IA", "MO", "AR", "LA", "WI", "IL", "MS", "AL", "TN", "KY", "IN", "MI", "OH", "MT"]);
  const EAST_STATES = new Set(["PA", "NJ", "NY", "CT", "RI", "MA", "VT", "NH", "ME", "MD", "DE", "VA", "WV", "NC", "SC", "GA", "FL", "DC"]);
  const STATE_CHINESE_NAMES = {
    AL: "阿拉巴马", AK: "阿拉斯加", AZ: "亚利桑那", AR: "阿肯色", CA: "加利福尼亚", CO: "科罗拉多", CT: "康涅狄格", DE: "特拉华", FL: "佛罗里达", GA: "佐治亚", HI: "夏威夷", ID: "爱达荷", IL: "伊利诺伊", IN: "印第安纳", IA: "爱荷华", KS: "堪萨斯", KY: "肯塔基", LA: "路易斯安那", ME: "缅因", MD: "马里兰", MA: "马萨诸塞", MI: "密歇根", MN: "明尼苏达", MS: "密西西比", MO: "密苏里", MT: "蒙大拿", NE: "内布拉斯加", NV: "内华达", NH: "新罕布什尔", NJ: "新泽西", NM: "新墨西哥", NY: "纽约", NC: "北卡罗来纳", ND: "北达科他", OH: "俄亥俄", OK: "俄克拉荷马", OR: "俄勒冈", PA: "宾夕法尼亚", RI: "罗德岛", SC: "南卡罗来纳", SD: "南达科他", TN: "田纳西", TX: "得克萨斯", UT: "犹他", VT: "佛蒙特", VA: "弗吉尼亚", WA: "华盛顿", WV: "西弗吉尼亚", WI: "威斯康星", WY: "怀俄明", DC: "哥伦比亚特区"
  };
  const STATE_ENGLISH_NAMES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia"
  };
  const DENSE_NORTHEAST_STATES = new Set(["CT", "DE", "MA", "MD", "NH", "NJ", "NY", "PA", "RI", "VT"]);
  const els = {
    cloudStatus: document.getElementById("cloudStatus"),
    weekInput: document.getElementById("weekInput"),
    weekLabel: document.getElementById("weekLabel"),
    fcSelect: document.getElementById("fcSelect"),
    appointmentStatus: document.getElementById("appointmentStatus"),
    saveStatusButton: document.getElementById("saveStatusButton"),
    listViewButton: document.getElementById("listViewButton"),
    mapViewButton: document.getElementById("mapViewButton"),
    listView: document.getElementById("listView"),
    mapView: document.getElementById("mapView"),
    fcRows: document.getElementById("fcRows"),
    emptyState: document.getElementById("emptyState"),
    summaryText: document.getElementById("summaryText"),
    mapCanvas: document.getElementById("mapCanvas"),
    zoomInButton: document.getElementById("zoomInButton"),
    zoomOutButton: document.getElementById("zoomOutButton"),
    zoomResetButton: document.getElementById("zoomResetButton"),
    mapSummary: document.getElementById("mapSummary"),
    mapLegend: document.getElementById("mapLegend"),
  };

  const state = {
    supabase: { url: "", key: "", enabled: false },
    fcs: [],
    weekly: new Map(),
    view: "list",
    scene: null,
    camera: null,
    renderer: null,
    pointGroup: null,
    projection: null,
    mapBounds: null,
    mapZoom: 1,
  };

  boot();

  async function boot() {
    loadSupabaseConfig();
    bindEvents();
    els.weekInput.value = dateToWeekValue(new Date());
    renderWeekLabel();
    if (!state.supabase.enabled) {
      setCloudStatus("Add anon key in supabase-config.js", "error");
      render();
      return;
    }
    await loadData();
  }

  function bindEvents() {
    els.weekInput.addEventListener("change", () => {
      renderWeekLabel();
      loadWeek();
    });
    els.fcSelect.addEventListener("change", fillSelectedFcStatus);
    els.saveStatusButton.addEventListener("click", saveWeeklyStatus);
    els.listViewButton.addEventListener("click", () => setView("list"));
    els.mapViewButton.addEventListener("click", () => setView("map"));
    els.zoomInButton.addEventListener("click", () => changeMapZoom(1.18));
    els.zoomOutButton.addEventListener("click", () => changeMapZoom(1 / 1.18));
    els.zoomResetButton.addEventListener("click", resetMapZoom);
    els.mapCanvas.addEventListener("wheel", handleMapWheel, { passive: false });
    window.addEventListener("resize", () => {
      if (state.view === "map") renderMap();
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
      state.fcs = await supabaseRequest(`${FC_TABLE}?select=*&order=fc.asc`);
      renderFcOptions();
      await loadWeek();
      setCloudStatus("Connected", "connected");
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
    }
  }

  async function loadWeek() {
    if (!state.supabase.enabled) return;
    const week = selectedWeekStart();
    if (!week) return;
    try {
      const rows = await supabaseRequest(`${WEEK_TABLE}?select=*&week_start=eq.${encodeURIComponent(week)}`);
      state.weekly = new Map(rows.map((row) => [row.fc, normalizeStatus(row.appointment_status)]).filter((row) => row[1]));
      fillSelectedFcStatus();
      render();
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
    }
  }

  async function saveWeeklyStatus() {
    const fc = els.fcSelect.value;
    const status = normalizeStatus(els.appointmentStatus.value);
    await saveFcStatus(fc, status);
  }

  async function saveFcStatus(fc, status) {
    const week = selectedWeekStart();
    if (!fc || !week) return;

    try {
      if (!status) {
        await supabaseRequest(`${WEEK_TABLE}?fc=eq.${encodeURIComponent(fc)}&week_start=eq.${encodeURIComponent(week)}`, {
          method: "DELETE",
        });
        state.weekly.delete(fc);
      } else {
        await supabaseRequest(`${WEEK_TABLE}?on_conflict=fc,week_start`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify([{ fc, week_start: week, appointment_status: status, updated_at: new Date().toISOString() }]),
        });
        state.weekly.set(fc, status);
      }
      if (els.fcSelect.value === fc) {
        els.appointmentStatus.value = status;
      }
      setCloudStatus("Saved", "connected");
      render();
    } catch (error) {
      console.error(error);
      setCloudStatus(error.message, "error");
    }
  }

  function render() {
    const allRows = allFcRows();
    const visibleRows = allRows.filter((fc) => clean(fc.appointment_status));
    renderList(allRows);
    renderSummary(allRows, visibleRows);
    if (state.view === "map") renderMap(visibleRows);
  }

  function renderFcOptions() {
    els.fcSelect.innerHTML = state.fcs.map((fc) => {
      const label = `${escapeHtml(fc.fc)} · ${escapeHtml(fc.city || "")}, ${escapeHtml(fc.state || "")}`;
      return `<option value="${escapeAttr(fc.fc)}">${label}</option>`;
    }).join("");
  }

  function fillSelectedFcStatus() {
    els.appointmentStatus.value = state.weekly.get(els.fcSelect.value) || "";
  }

  function allFcRows() {
    return state.fcs
      .map((fc) => ({ ...fc, appointment_status: state.weekly.get(fc.fc) || "" }))
      .sort((a, b) => a.fc.localeCompare(b.fc));
  }

  function renderList(rows) {
    els.emptyState.classList.toggle("hidden", state.fcs.length > 0);
    els.fcRows.innerHTML = rows.map((row) => `
      <tr>
        <td><button class="fc-code" type="button" data-fc="${escapeAttr(row.fc)}">${escapeHtml(row.fc)}</button></td>
        <td>${escapeHtml(row.state || "")}</td>
        <td>${escapeHtml(row.city || "")}</td>
        <td>${formatDays(row.transit_days)}</td>
        <td>${renderStatusSelect(row.fc, row.appointment_status)}</td>
        <td>${escapeHtml(row.address || "")}</td>
      </tr>
    `).join("");

    els.fcRows.querySelectorAll("[data-fc]").forEach((button) => {
      button.addEventListener("click", () => {
        els.fcSelect.value = button.dataset.fc;
        fillSelectedFcStatus();
      });
    });

    els.fcRows.querySelectorAll("[data-status-fc]").forEach((select) => {
      select.addEventListener("change", () => {
        saveFcStatus(select.dataset.statusFc, normalizeStatus(select.value));
      });
    });
  }

  function renderSummary(allRows, visibleRows) {
    const week = selectedWeekLabel();
    const mapGroups = aggregateRowsForMap(visibleRows);
    els.summaryText.textContent = `${allRows.length} FCs listed · ${visibleRows.length} with appointment status for week of ${week}`;
    els.mapSummary.textContent = mapGroups.length ? `${visibleRows.length} FCs aggregated into ${mapGroups.length} map regions.` : "Only FCs with a weekly appointment status are shown.";
    els.mapLegend.innerHTML = mapGroups.map((group) => `
      <section class="legend-region">
        <h3>${escapeHtml(group.label)} · ${group.count}</h3>
        <ul>
          ${group.items.map((item) => `
            <li><span class="status-dot ${statusClass(item.status)}"></span><strong>${escapeHtml(item.fc)}</strong> ${escapeHtml(statusShortLabel(item.status))}</li>
          `).join("")}
        </ul>
      </section>
    `).join("");
  }

  function renderWeekLabel() {
    els.weekLabel.textContent = selectedWeekLabel();
  }

  function renderStatusSelect(fc, status) {
    const options = [
      ["", "No status / hide"],
      ...Object.entries(STATUS_META).map(([value, meta]) => [value, meta.label]),
    ];
    return `
      <select class="row-status-select ${statusClass(status)}" data-status-fc="${escapeAttr(fc)}">
        ${options.map(([value, label]) => `
          <option value="${escapeAttr(value)}"${value === status ? " selected" : ""}>${escapeHtml(label)}</option>
        `).join("")}
      </select>
    `;
  }

  function aggregateRowsForMap(rows) {
    const groups = new Map();
    rows.forEach((row) => {
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const region = mapRegion(row, latitude);
      const status = normalizeStatus(row.appointment_status);
      if (!status) return;

      if (!groups.has(region.key)) {
        groups.set(region.key, {
          key: region.key,
          label: region.label,
          anchor: region.anchor,
          latitudeTotal: 0,
          longitudeTotal: 0,
          count: 0,
          appointment_status: status,
          statusCounts: emptyStatusCounts(),
        });
      }

      const group = groups.get(region.key);
      group.latitudeTotal += latitude;
      group.longitudeTotal += longitude;
      group.count += 1;
      if (!group.items) group.items = [];
      group.items.push({
        fc: row.fc,
        status,
      });
      group.statusCounts[status] += 1;
      if (statusSeverity(status) > statusSeverity(group.appointment_status)) {
        group.appointment_status = status;
      }
    });

    return Array.from(groups.values()).map((group) => ({
      ...group,
      latitude: group.anchor?.latitude ?? group.latitudeTotal / group.count,
      longitude: group.anchor?.longitude ?? group.longitudeTotal / group.count,
      items: group.items.sort((a, b) => statusSeverity(b.status) - statusSeverity(a.status) || a.fc.localeCompare(b.fc)),
    })).sort((a, b) => a.label.localeCompare(b.label));
  }

  function mapRegion(row, latitude) {
    const state = clean(row.state).toUpperCase();
    const baseState = state.split("-")[0] || "US";
    if (baseState === "CA") {
      const zipPrefix = Number(clean(row.zip).slice(0, 3));
      if (state.includes("-N") || zipPrefix >= 940) {
        return { key: "CA-N", label: "NorCal", anchor: { latitude: 38.55, longitude: -121.75 } };
      }
      if (state.includes("-S") || (zipPrefix >= 900 && zipPrefix <= 935)) {
        return { key: "CA-S", label: "SoCal", anchor: { latitude: 34.2, longitude: -117.9 } };
      }
      if (zipPrefix >= 936 && zipPrefix <= 939) {
        return { key: "CA-C", label: "Central CA", anchor: { latitude: 36.65, longitude: -119.7 } };
      }
      if (latitude >= 37.35) {
        return { key: "CA-N", label: "NorCal", anchor: { latitude: 38.55, longitude: -121.75 } };
      }
      if (latitude <= 35.0) {
        return { key: "CA-S", label: "SoCal", anchor: { latitude: 34.2, longitude: -117.9 } };
      }
      return { key: "CA-C", label: "Central CA", anchor: { latitude: 36.65, longitude: -119.7 } };
    }
    return { key: baseState, label: baseState };
  }

  function regionCalloutOffset(key) {
    const special = {
      "CA-S": [-1.2, -0.85],
      "CA-C": [-1.05, 0.8],
      "CA-N": [-1.15, 1.1],
      WA: [-0.95, 0.75],
      OR: [-1.0, 0.35],
      NV: [-0.85, -0.25],
      AZ: [-0.55, -0.75],
      TX: [0.2, -0.95],
      FL: [0.95, -0.55],
      GA: [0.65, -0.35],
      NC: [1.05, 0.15],
      SC: [0.95, -0.15],
      VA: [1.15, 0.35],
      MD: [1.25, 0.65],
      DE: [1.25, 0.35],
      NJ: [1.15, 0.5],
      NY: [1.0, 0.85],
      PA: [0.9, 0.55],
      MA: [1.05, 0.75],
      CT: [1.05, 0.5],
      RI: [1.1, 0.35],
      ME: [0.85, 0.65],
    };
    if (special[key]) return special[key];
    const first = key.charCodeAt(0) || 85;
    const second = key.charCodeAt(1) || 83;
    const x = 0.58 + (first % 3) * 0.16;
    const y = ((second % 5) - 2) * 0.26;
    return [x, y];
  }

  function setView(view) {
    state.view = view;
    els.listViewButton.classList.toggle("active", view === "list");
    els.mapViewButton.classList.toggle("active", view === "map");
    els.listView.classList.toggle("hidden", view !== "list");
    els.mapView.classList.toggle("hidden", view !== "map");
    if (view === "map") renderMap();
  }

  function changeMapZoom(multiplier) {
    state.mapZoom = clamp(state.mapZoom * multiplier, 0.55, 2.6);
    if (state.view === "map") renderMap();
  }

  function resetMapZoom() {
    state.mapZoom = 1;
    if (state.view === "map") renderMap();
  }

  function handleMapWheel(event) {
    if (state.view !== "map") return;
    event.preventDefault();
    changeMapZoom(event.deltaY < 0 ? 1.08 : 1 / 1.08);
  }

  function renderMap(rows = allFcRows().filter((fc) => clean(fc.appointment_status))) {
    if (!window.THREE) {
      els.mapCanvas.innerHTML = '<div class="empty-state">Three.js did not load. Check internet access for the CDN script.</div>';
      return;
    }
    if (!state.renderer) initMap();
    const width = els.mapCanvas.clientWidth || 800;
    const height = els.mapCanvas.clientHeight || 620;
    state.renderer.setSize(width, height);
    fitMapCamera(width, height);
    state.camera.updateProjectionMatrix();
    drawFcPoints(aggregateRowsForMap(rows));
    state.renderer.render(state.scene, state.camera);
  }

  function fitMapCamera(width, height) {
    const bounds = state.mapBounds || { width: 20, height: 11 };
    const aspect = width / Math.max(height, 1);
    const padding = 1.14;
    let viewHeight = bounds.height * padding;
    let viewWidth = viewHeight * aspect;
    const minWidth = bounds.width * padding;
    if (viewWidth < minWidth) {
      viewWidth = minWidth;
      viewHeight = viewWidth / aspect;
    }
    const zoom = state.mapZoom || 1;
    state.camera.left = -viewWidth / 2 / zoom;
    state.camera.right = viewWidth / 2 / zoom;
    state.camera.top = viewHeight / 2 / zoom;
    state.camera.bottom = -viewHeight / 2 / zoom;
  }

  function initMap() {
    state.scene = new THREE.Scene();
    state.camera = new THREE.OrthographicCamera(-12, 12, 7.5, -7.5, 1, 100);
    state.camera.position.set(0, 0, 22);
    state.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    state.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    els.mapCanvas.innerHTML = "";
    els.mapCanvas.appendChild(state.renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 0.82);
    light.position.set(3, 6, 10);
    state.scene.add(light);
    state.scene.add(new THREE.AmbientLight(0xffffff, 0.82));

    buildMapProjection();
    drawStateMap();
    state.pointGroup = new THREE.Group();
    state.scene.add(state.pointGroup);
  }

  function drawStateMap() {
    const geojson = window.US_STATES_CONTIGUOUS;
    if (!geojson?.features?.length) return;

    const borderMaterial = new THREE.LineBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.92 });
    const labelGroup = new THREE.Group();

    geojson.features.forEach((feature) => {
      const stateMaterial = new THREE.MeshStandardMaterial({ color: stateFillColor(feature.properties.ABBR), roughness: 0.78, metalness: 0.01 });
      polygonsForFeature(feature).forEach((polygon) => {
        const shape = ringToShape(polygon[0]);
        polygon.slice(1).forEach((hole) => {
          shape.holes.push(ringToPath(hole));
        });
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
        const mesh = new THREE.Mesh(geometry, stateMaterial);
        mesh.position.z = -0.14;
        state.scene.add(mesh);

        polygon.forEach((ring) => {
          const border = new THREE.LineLoop(
            new THREE.BufferGeometry().setFromPoints(ring.map(([lng, lat]) => {
              const [x, y] = project(lng, lat);
              return new THREE.Vector3(x, y, 0.05);
            })),
            borderMaterial
          );
          state.scene.add(border);
        });
      });

      const center = featureCenter(feature);
      if (center) {
        const [x, y] = center;
        const abbr = feature.properties.ABBR || feature.properties.NAME;
        const label = makeStateLabelSprite(abbr, stateLabelScale(abbr));
        label.position.set(x, y, 0.18);
        labelGroup.add(label);
      }
    });

    state.scene.add(labelGroup);
  }

  function drawFcPoints(groups) {
    state.pointGroup.clear();
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    const placements = layoutGroupCallouts(groups);
    placements.forEach((placement) => {
      const { group, x, y, radius, calloutX, calloutY } = placement;
      const marker = makePieMarker(group, radius);
      marker.position.set(x, y, 0.45);
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius + 0.04, radius + 0.08, 32), ringMaterial);
      ring.position.set(x, y, 0.42);
      state.pointGroup.add(marker, ring);
      const connector = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, y, 0.36),
          new THREE.Vector3(calloutX, calloutY, 0.36),
        ]),
        new THREE.LineBasicMaterial({ color: 0xd66b5f, transparent: true, opacity: 0.68 })
      );
      const label = makeGroupCalloutSprite(group);
      label.position.set(calloutX, calloutY, 0.5);
      state.pointGroup.add(connector, label);
    });
  }

  function layoutGroupCallouts(groups) {
    const placements = groups.map((group) => {
      const [x, y] = project(group.longitude, group.latitude);
      const radius = Math.min(0.32, 0.13 + Math.sqrt(group.count) * 0.035);
      const offset = regionCalloutOffset(group.key);
      const metrics = groupCalloutMetrics(group);
      return {
        group,
        x,
        y,
        radius,
        width: metrics.scaleWidth,
        height: metrics.scaleHeight,
        calloutX: x + offset[0],
        calloutY: y + offset[1],
      };
    });

    const gap = 0.08;
    for (let pass = 0; pass < 14; pass += 1) {
      let moved = false;
      for (let i = 0; i < placements.length; i += 1) {
        for (let j = i + 1; j < placements.length; j += 1) {
          const a = placements[i];
          const b = placements[j];
          const overlapX = (a.width + b.width) / 2 + gap - Math.abs(a.calloutX - b.calloutX);
          const overlapY = (a.height + b.height) / 2 + gap - Math.abs(a.calloutY - b.calloutY);
          if (overlapX <= 0 || overlapY <= 0) continue;

          if (overlapX < overlapY) {
            const direction = a.calloutX <= b.calloutX ? -1 : 1;
            a.calloutX += direction * overlapX / 2;
            b.calloutX -= direction * overlapX / 2;
          } else {
            const direction = a.calloutY <= b.calloutY ? -1 : 1;
            a.calloutY += direction * overlapY / 2;
            b.calloutY -= direction * overlapY / 2;
          }
          moved = true;
        }
      }
      placements.forEach((placement) => {
        const dx = placement.calloutX - placement.x;
        const dy = placement.calloutY - placement.y;
        const distance = Math.hypot(dx, dy) || 1;
        const minDistance = placement.radius + Math.max(placement.width, placement.height) / 2 + 0.12;
        if (distance < minDistance) {
          const push = minDistance - distance;
          placement.calloutX += (dx / distance) * push;
          placement.calloutY += (dy / distance) * push;
          moved = true;
        }
      });
      if (!moved) break;
    }

    return placements;
  }

  function makePieMarker(group, radius) {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 96;
    const context = canvas.getContext("2d");
    const center = 48;
    const pieRadius = 39;
    let start = -Math.PI / 2;
    Object.keys(STATUS_META).forEach((status) => {
      const count = group.statusCounts?.[status] || 0;
      if (!count) return;
      const angle = (count / group.count) * Math.PI * 2;
      context.beginPath();
      context.moveTo(center, center);
      context.arc(center, center, pieRadius, start, start + angle);
      context.closePath();
      context.fillStyle = statusCssColor(status);
      context.fill();
      start += angle;
    });

    context.beginPath();
    context.arc(center, center, pieRadius, 0, Math.PI * 2);
    context.strokeStyle = "rgba(255,255,255,0.96)";
    context.lineWidth = 6;
    context.stroke();
    context.beginPath();
    context.arc(center, center, pieRadius + 3, 0, Math.PI * 2);
    context.strokeStyle = "rgba(23,32,51,0.28)";
    context.lineWidth = 2;
    context.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(radius * 2.4, radius * 2.4, 1);
    return sprite;
  }

  function makeGroupCalloutSprite(group) {
    const { columns, rowsPerColumn, columnWidth, width, height } = groupCalloutMetrics(group);
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext("2d");
    context.scale(2, 2);
    context.fillStyle = "rgba(244, 244, 244, 0.96)";
    context.strokeStyle = "rgba(78, 118, 72, 0.72)";
    context.lineWidth = 1;
    if (context.roundRect) {
      context.roundRect(1, 1, width - 2, height - 2, 7);
    } else {
      context.rect(1, 1, width - 2, height - 2);
    }
    context.fill();
    context.stroke();

    context.fillStyle = "#172033";
    context.font = "800 14px Inter, Arial, sans-serif";
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(`${group.label} · ${group.count}`, 12, 18);
    context.fillStyle = statusCssColor(group.appointment_status);
    context.fillRect(width - 36, 12, 22, 8);

    group.items.forEach((item, index) => {
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const x = 12 + column * columnWidth;
      const y = 39 + row * 20;
      context.fillStyle = statusCssColor(item.status);
      context.beginPath();
      context.arc(x + 4, y, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#172033";
      context.font = "750 12px Inter, Arial, sans-serif";
      context.fillText(item.fc, x + 13, y);
      context.fillStyle = "#697589";
      context.font = "700 10px Inter, Arial, sans-serif";
      context.fillText(statusShortLabel(item.status), x + 51, y);
    });

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width / 80, height / 80, 1);
    return sprite;
  }

  function groupCalloutMetrics(group) {
    const columns = Math.min(4, Math.max(1, Math.ceil(group.items.length / 9)));
    const rowsPerColumn = Math.ceil(group.items.length / columns);
    const columnWidth = 104;
    const width = 28 + columns * columnWidth;
    const height = 42 + rowsPerColumn * 20;
    return {
      columns,
      rowsPerColumn,
      columnWidth,
      width,
      height,
      scaleWidth: width / 80,
      scaleHeight: height / 80,
    };
  }

  function stateLabelScale(abbr) {
    return DENSE_NORTHEAST_STATES.has(abbr) ? 0.62 : 1;
  }

  function makeStateLabelSprite(text, scale = 1) {
    const chineseName = STATE_CHINESE_NAMES[text] || "";
    const englishName = STATE_ENGLISH_NAMES[text] || "";
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 66;
    const context = canvas.getContext("2d");
    context.fillStyle = "#6B7280";
    context.textAlign = "center";
    context.textBaseline = "middle";
    if (chineseName && englishName) {
      context.font = "600 12px Inter, Arial, sans-serif";
      context.fillText(chineseName, 48, 14);
      context.font = "500 10px Inter, Arial, sans-serif";
      context.fillText(englishName, 48, 30);
      context.font = "600 20px Inter, Arial, sans-serif";
      context.fillText(text, 48, 52);
    } else if (chineseName) {
      context.font = "600 12px Inter, Arial, sans-serif";
      context.fillText(chineseName, 48, 18);
      context.font = "600 20px Inter, Arial, sans-serif";
      context.fillText(text, 48, 42);
    } else {
      context.font = "600 20px Inter, Arial, sans-serif";
      context.fillText(text, 48, 34);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.72 * scale, 0.52 * scale, 1);
    return sprite;
  }

  function stateFillColor(abbr) {
    if (WEST_STATES.has(abbr)) return REGION_COLORS.west;
    if (CENTRAL_STATES.has(abbr)) return REGION_COLORS.central;
    if (EAST_STATES.has(abbr)) return REGION_COLORS.east;
    return REGION_COLORS.east;
  }

  function buildMapProjection() {
    const rawPoints = [];
    (window.US_STATES_CONTIGUOUS?.features || []).forEach((feature) => {
      polygonsForFeature(feature).forEach((polygon) => {
        polygon.forEach((ring) => {
          ring.forEach(([lng, lat]) => rawPoints.push(albersRaw(lng, lat)));
        });
      });
    });
    if (!rawPoints.length) {
      state.projection = { scale: 1, centerX: 0, centerY: 0 };
      state.mapBounds = { width: 20, height: 11 };
      return;
    }

    const xs = rawPoints.map((point) => point[0]);
    const ys = rawPoints.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const rawWidth = maxX - minX;
    const rawHeight = maxY - minY;
    const scale = Math.min(20 / rawWidth, 11.2 / rawHeight);

    state.projection = {
      scale,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
    };
    state.mapBounds = {
      width: rawWidth * scale,
      height: rawHeight * scale,
    };
  }

  function project(lng, lat) {
    const raw = albersRaw(lng, lat);
    const projection = state.projection || { scale: 1, centerX: 0, centerY: 0 };
    return [
      (raw[0] - projection.centerX) * projection.scale,
      (raw[1] - projection.centerY) * projection.scale,
    ];
  }

  function albersRaw(lng, lat) {
    const radians = Math.PI / 180;
    const phi1 = 29.5 * radians;
    const phi2 = 45.5 * radians;
    const phi0 = 23 * radians;
    const lambda = (lng + 96) * radians;
    const phi = lat * radians;
    const n = 0.5 * (Math.sin(phi1) + Math.sin(phi2));
    const c = Math.cos(phi1) ** 2 + 2 * n * Math.sin(phi1);
    const rho = Math.sqrt(c - 2 * n * Math.sin(phi)) / n;
    const rho0 = Math.sqrt(c - 2 * n * Math.sin(phi0)) / n;
    return [
      rho * Math.sin(n * lambda),
      rho0 - rho * Math.cos(n * lambda),
    ];
  }

  function polygonsForFeature(feature) {
    if (feature.geometry.type === "Polygon") return [feature.geometry.coordinates];
    if (feature.geometry.type === "MultiPolygon") return feature.geometry.coordinates;
    return [];
  }

  function ringToShape(ring) {
    const points = ring.map(([lng, lat]) => {
      const [x, y] = project(lng, lat);
      return new THREE.Vector2(x, y);
    });
    return new THREE.Shape(points);
  }

  function ringToPath(ring) {
    const path = new THREE.Path();
    ring.forEach(([lng, lat], index) => {
      const [x, y] = project(lng, lat);
      if (index === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    return path;
  }

  function featureCenter(feature) {
    const centroids = [];
    polygonsForFeature(feature).forEach((polygon) => {
      const outerRing = polygon[0] || [];
      const projected = outerRing.map(([lng, lat]) => project(lng, lat));
      const centroid = polygonCentroid(projected);
      if (centroid) {
        const area = Math.abs(polygonArea(projected));
        centroids.push({ centroid, area });
      }
    });
    if (!centroids.length) return null;
    const totalArea = centroids.reduce((sum, item) => sum + item.area, 0);
    if (!totalArea) return centroids[0].centroid;
    const weighted = centroids.reduce(
      (sum, item) => {
        sum[0] += item.centroid[0] * item.area;
        sum[1] += item.centroid[1] * item.area;
        return sum;
      },
      [0, 0]
    );
    return [weighted[0] / totalArea, weighted[1] / totalArea];
  }

  function polygonArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i += 1) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      area += x0 * y1 - x1 * y0;
    }
    return area * 0.5;
  }

  function polygonCentroid(points) {
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < points.length; i += 1) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[(i + 1) % points.length];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    if (!area) return null;
    const factor = 1 / (3 * area);
    return [cx * factor, cy * factor];
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

  function selectedWeekStart() {
    return weekValueToMonday(els.weekInput.value);
  }

  function selectedWeekLabel() {
    const value = els.weekInput.value;
    const match = /^(\d{4})-W(\d{2})$/.exec(value);
    return match ? `${match[1]} Week ${Number(match[2])}` : "selected week";
  }

  function dateToWeekValue(date) {
    const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() + 4 - day);
    const year = value.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const week = Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  function weekValueToMonday(value) {
    const match = /^(\d{4})-W(\d{2})$/.exec(value);
    if (!match) return "";
    const year = Number(match[1]);
    const week = Number(match[2]);
    const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
    const day = simple.getUTCDay() || 7;
    const monday = new Date(simple);
    monday.setUTCDate(simple.getUTCDate() - day + 1);
    return monday.toISOString().slice(0, 10);
  }

  function formatDays(value) {
    return value === null || value === undefined || value === "" ? "" : `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)} days`;
  }

  function normalizeStatus(value) {
    const status = clean(value);
    if (STATUS_META[status]) return status;
    const matched = Object.entries(STATUS_META).find(([, meta]) => meta.label === status);
    return matched ? matched[0] : "";
  }

  function emptyStatusCounts() {
    return Object.fromEntries(Object.keys(STATUS_META).map((status) => [status, 0]));
  }

  function statusSeverity(status) {
    return STATUS_SEVERITY[status] || 0;
  }

  function statusLabel(status) {
    return STATUS_META[status]?.label || status;
  }

  function statusShortLabel(status) {
    return {
      Normal: "正常",
      "Slightly Busy": "轻拥",
      "Very Busy": "拥挤",
      "Severely Full": "爆仓",
    }[status] || "";
  }

  function statusClass(status) {
    const className = STATUS_META[status]?.className || "normal";
    return `status-${className}`;
  }

  function statusColor(status) {
    return STATUS_META[status]?.color || STATUS_META.Normal.color;
  }

  function statusCssColor(status) {
    const value = statusColor(status).toString(16).padStart(6, "0");
    return `#${value}`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
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
