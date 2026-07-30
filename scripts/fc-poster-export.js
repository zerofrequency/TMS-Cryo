(function (root) {
  "use strict";

  const WIDTH = 1085;
  const HEIGHT = 1450;
  const TEMPLATE_URL = "../assets/posters/hye-amazon-appointment-template.jpg";
  const STATUS_META = {
    Normal: { label: "正常预约", short: "正常", color: "#269b45", severity: 1 },
    "Slightly Busy": { label: "轻微拥挤", short: "轻微", color: "#ffd400", severity: 2 },
    "Very Busy": { label: "十分拥挤", short: "拥挤", color: "#ff7a00", severity: 3 },
    "Severely Full": { label: "严重爆仓", short: "爆仓", color: "#d90012", severity: 4 },
  };
  const MAP_RECT = { x: 115, y: 438, width: 855, height: 520 };
  const CALLOUT_TOP = 405;
  const CALIFORNIA_ANCHORS = {
    "CA-N": { latitude: 38.55, longitude: -121.75 },
    "CA-C": { latitude: 36.65, longitude: -119.7 },
    "CA-S": { latitude: 34.2, longitude: -117.9 },
  };

  function buildPosterModel(rows, weekStart, now = new Date()) {
    const groups = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const status = clean(row.appointment_status);
      if (!STATUS_META[status]) return;
      const region = mapRegion(row);
      if (!groups.has(region.key)) {
        groups.set(region.key, {
          key: region.key,
          label: region.label,
          latitudeTotal: 0,
          longitudeTotal: 0,
          coordinateCount: 0,
          items: [],
          status,
        });
      }
      const group = groups.get(region.key);
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        group.latitudeTotal += latitude;
        group.longitudeTotal += longitude;
        group.coordinateCount += 1;
      }
      group.items.push({ fc: clean(row.fc), status });
      if (STATUS_META[status].severity > STATUS_META[group.status].severity) {
        group.status = status;
      }
    });

    const normalizedGroups = Array.from(groups.values()).map((group) => {
      const anchor = CALIFORNIA_ANCHORS[group.key];
      return {
        ...group,
        latitude: anchor?.latitude ?? (group.coordinateCount ? group.latitudeTotal / group.coordinateCount : null),
        longitude: anchor?.longitude ?? (group.coordinateCount ? group.longitudeTotal / group.coordinateCount : null),
        items: group.items.sort((a, b) => (
          STATUS_META[b.status].severity - STATUS_META[a.status].severity
          || a.fc.localeCompare(b.fc)
        )),
      };
    }).sort((a, b) => a.key.localeCompare(b.key));

    const effectiveDate = posterDate(weekStart, now);
    return {
      width: WIDTH,
      height: HEIGHT,
      weekStart,
      dateLabel: `${effectiveDate.getMonth() + 1}/${effectiveDate.getDate()}`,
      fileName: `amazon-appointment-status-${localIsoDate(effectiveDate)}.png`,
      total: normalizedGroups.reduce((sum, group) => sum + group.items.length, 0),
      groups: normalizedGroups,
    };
  }

  async function renderPoster(options) {
    const model = buildPosterModel(options.rows, options.weekStart, options.now);
    const template = await loadImage(options.templateUrl || TEMPLATE_URL);
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d");

    context.drawImage(template, 0, 0, WIDTH, HEIGHT);
    drawDate(context, model.dateLabel);
    const projection = drawMap(context, options.geojson, MAP_RECT);
    drawGroups(context, model.groups, projection);
    return { canvas, model };
  }

  async function downloadPoster(options) {
    const { canvas, model } = await renderPoster(options);
    const blob = await canvasBlob(canvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = model.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return model;
  }

  function drawDate(context, dateLabel) {
    context.save();
    context.fillStyle = "#ffffff";
    context.font = '800 31px "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(dateLabel, 598, 394);
    context.restore();
  }

  function drawMap(context, geojson, rect) {
    const projection = createProjection(geojson, rect);
    context.save();
    context.lineJoin = "round";
    context.lineCap = "round";

    (geojson?.features || []).forEach((feature) => {
      context.beginPath();
      polygonsForFeature(feature).forEach((polygon) => {
        polygon.forEach((ring) => {
          ring.forEach(([longitude, latitude], index) => {
            const point = projection.project(longitude, latitude);
            if (index === 0) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
          });
          context.closePath();
        });
      });
      context.fillStyle = stateFill(feature.properties?.ABBR);
      context.strokeStyle = "rgba(63, 118, 49, 0.78)";
      context.lineWidth = 0.85;
      context.fill("evenodd");
      context.stroke();

      const center = featureCenter(feature, projection);
      if (center && !["CT", "DE", "DC", "MA", "MD", "NJ", "RI"].includes(feature.properties?.ABBR)) {
        context.fillStyle = "rgba(62, 95, 52, 0.72)";
        context.font = '600 10px Arial, sans-serif';
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(feature.properties?.ABBR || "", center.x, center.y);
      }
    });
    context.restore();
    return projection;
  }

  function drawGroups(context, groups, projection) {
    const placements = layoutCallouts(groups, projection);
    placements.forEach((placement) => {
      if (placement.marker) {
        context.save();
        context.strokeStyle = "rgba(196, 67, 54, 0.52)";
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(placement.marker.x, placement.marker.y);
        context.lineTo(placement.card.x + placement.card.width / 2, placement.card.y + placement.card.height / 2);
        context.stroke();
        context.restore();
        drawMarker(context, placement.marker.x, placement.marker.y, placement.group);
      }
      drawCallout(context, placement.card, placement.group);
    });
  }

  function layoutCallouts(groups, projection) {
    const placements = groups.map((group) => {
      const marker = Number.isFinite(group.longitude) && Number.isFinite(group.latitude)
        ? projection.project(group.longitude, group.latitude)
        : null;
      const [offsetX, offsetY] = regionCalloutOffset(group.key);
      const width = calloutWidth(group);
      const height = calloutHeight(group);
      const centerX = (marker?.x ?? MAP_RECT.x + MAP_RECT.width / 2) + offsetX * 64;
      const centerY = (marker?.y ?? MAP_RECT.y + MAP_RECT.height / 2) - offsetY * 64;
      return {
        group,
        marker,
        card: {
          x: centerX - width / 2,
          y: centerY - height / 2,
          width,
          height,
        },
      };
    });

    placements.forEach(({ card }) => constrainCard(card));
    for (let pass = 0; pass < 18; pass += 1) {
      let moved = false;
      for (let index = 0; index < placements.length; index += 1) {
        for (let otherIndex = index + 1; otherIndex < placements.length; otherIndex += 1) {
          const first = placements[index].card;
          const second = placements[otherIndex].card;
          const firstCenterX = first.x + first.width / 2;
          const firstCenterY = first.y + first.height / 2;
          const secondCenterX = second.x + second.width / 2;
          const secondCenterY = second.y + second.height / 2;
          const overlapX = (first.width + second.width) / 2 + 7 - Math.abs(firstCenterX - secondCenterX);
          const overlapY = (first.height + second.height) / 2 + 7 - Math.abs(firstCenterY - secondCenterY);
          if (overlapX <= 0 || overlapY <= 0) continue;

          if (overlapX < overlapY) {
            const direction = firstCenterX <= secondCenterX ? -1 : 1;
            first.x += direction * overlapX / 2;
            second.x -= direction * overlapX / 2;
          } else {
            const direction = firstCenterY <= secondCenterY ? -1 : 1;
            first.y += direction * overlapY / 2;
            second.y -= direction * overlapY / 2;
          }
          moved = true;
        }
      }
      placements.forEach((placement, placementIndex) => {
        placements.forEach((other) => {
          if (!other.marker) return;
          if (moveCardAwayFromMarker(placement.card, other.marker)) moved = true;
        });
      });
      placements.forEach(({ card }) => constrainCard(card));
      if (!moved) break;
    }

    return placements;
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
    return [0.58 + (first % 3) * 0.16, ((second % 5) - 2) * 0.26];
  }

  function constrainCard(card) {
    const margin = 8;
    card.x = Math.max(margin, Math.min(WIDTH - margin - card.width, card.x));
    card.y = Math.max(CALLOUT_TOP, Math.min(MAP_RECT.y + MAP_RECT.height - card.height, card.y));
  }

  function moveCardAwayFromMarker(card, marker) {
    const gap = 16;
    const left = card.x - gap;
    const right = card.x + card.width + gap;
    const top = card.y - gap;
    const bottom = card.y + card.height + gap;
    if (marker.x < left || marker.x > right || marker.y < top || marker.y > bottom) return false;

    const minX = 8;
    const maxX = WIDTH - 8 - card.width;
    const minY = CALLOUT_TOP;
    const maxY = MAP_RECT.y + MAP_RECT.height - card.height;
    const candidates = [
      { axis: "x", value: marker.x + gap, delta: Math.abs(marker.x + gap - card.x), min: minX, max: maxX },
      { axis: "x", value: marker.x - card.width - gap, delta: Math.abs(marker.x - card.width - gap - card.x), min: minX, max: maxX },
      { axis: "y", value: marker.y + gap, delta: Math.abs(marker.y + gap - card.y), min: minY, max: maxY },
      { axis: "y", value: marker.y - card.height - gap, delta: Math.abs(marker.y - card.height - gap - card.y), min: minY, max: maxY },
    ].filter((candidate) => candidate.value >= candidate.min && candidate.value <= candidate.max)
      .sort((a, b) => a.delta - b.delta);
    if (!candidates.length) return false;
    card[candidates[0].axis] = candidates[0].value;
    return true;
  }

  function drawMarker(context, x, y, group) {
    const counts = Object.fromEntries(Object.keys(STATUS_META).map((status) => [status, 0]));
    group.items.forEach((item) => { counts[item.status] += 1; });
    let start = -Math.PI / 2;
    context.save();
    Object.entries(STATUS_META).forEach(([status, meta]) => {
      const count = counts[status];
      if (!count) return;
      const angle = (count / group.items.length) * Math.PI * 2;
      context.beginPath();
      context.moveTo(x, y);
      context.arc(x, y, 10, start, start + angle);
      context.closePath();
      context.fillStyle = meta.color;
      context.fill();
      start += angle;
    });
    context.beginPath();
    context.arc(x, y, 12.5, 0, Math.PI * 2);
    context.strokeStyle = "rgba(255,255,255,0.98)";
    context.lineWidth = 4;
    context.stroke();
    context.beginPath();
    context.arc(x, y, 14.5, 0, Math.PI * 2);
    context.strokeStyle = "rgba(38, 71, 39, 0.42)";
    context.lineWidth = 1.5;
    context.stroke();
    context.restore();
  }

  function drawCallout(context, card, group) {
    const { columns, rowsPerColumn } = calloutMetrics(group);
    const columnWidth = (card.width - 20) / columns;
    context.save();
    context.shadowColor = "rgba(39, 57, 36, 0.16)";
    context.shadowBlur = 6;
    context.shadowOffsetY = 2;
    roundedRect(context, card.x, card.y, card.width, card.height, 6);
    context.fillStyle = "rgba(255,255,255,0.96)";
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = "rgba(91, 112, 83, 0.65)";
    context.lineWidth = 1;
    context.stroke();

    context.fillStyle = "#252b25";
    context.font = '800 11px Arial, "PingFang SC", sans-serif';
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(`${group.label} · ${group.items.length}`, card.x + 9, card.y + 14);
    context.fillStyle = STATUS_META[group.status].color;
    context.fillRect(card.x + card.width - 25, card.y + 10, 16, 6);

    group.items.forEach((item, index) => {
      const column = Math.floor(index / rowsPerColumn);
      const row = index % rowsPerColumn;
      const x = card.x + 8 + column * columnWidth;
      const y = card.y + 31 + row * 15;
      context.fillStyle = STATUS_META[item.status].color;
      context.beginPath();
      context.arc(x + 3, y, 3, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#202820";
      context.font = '750 9.5px Arial, sans-serif';
      context.fillText(item.fc, x + 10, y);
      context.fillStyle = "#697065";
      context.font = '600 7.5px "PingFang SC", "Microsoft YaHei", sans-serif';
      context.fillText(STATUS_META[item.status].short, x + 44, y);
    });
    context.restore();
  }

  function calloutHeight(group) {
    return calloutMetrics(group).height;
  }

  function calloutWidth(group) {
    return calloutMetrics(group).width;
  }

  function calloutMetrics(group) {
    const columns = Math.min(4, Math.max(1, Math.ceil(group.items.length / 9)));
    const rowsPerColumn = Math.ceil(group.items.length / columns);
    return {
      columns,
      rowsPerColumn,
      width: columns === 1 ? 128 : 48 + columns * 80,
      height: 36 + rowsPerColumn * 15,
    };
  }

  function createProjection(geojson, rect) {
    const points = [];
    (geojson?.features || []).forEach((feature) => {
      polygonsForFeature(feature).forEach((polygon) => {
        polygon.forEach((ring) => {
          ring.forEach(([longitude, latitude]) => points.push(albersRaw(longitude, latitude)));
        });
      });
    });
    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const scale = Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY));
    const usedWidth = (maxX - minX) * scale;
    const usedHeight = (maxY - minY) * scale;
    return {
      project(longitude, latitude) {
        const [rawX, rawY] = albersRaw(longitude, latitude);
        return {
          x: rect.x + (rect.width - usedWidth) / 2 + (rawX - minX) * scale,
          y: rect.y + (rect.height - usedHeight) / 2 + (maxY - rawY) * scale,
        };
      },
    };
  }

  function featureCenter(feature, projection) {
    const points = [];
    polygonsForFeature(feature).forEach((polygon) => {
      polygon[0]?.forEach(([longitude, latitude]) => points.push(projection.project(longitude, latitude)));
    });
    if (!points.length) return null;
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }

  function polygonsForFeature(feature) {
    if (feature?.geometry?.type === "Polygon") return [feature.geometry.coordinates];
    if (feature?.geometry?.type === "MultiPolygon") return feature.geometry.coordinates;
    return [];
  }

  function albersRaw(longitude, latitude) {
    const radians = Math.PI / 180;
    const phi1 = 29.5 * radians;
    const phi2 = 45.5 * radians;
    const phi0 = 23 * radians;
    const lambda = (longitude + 96) * radians;
    const phi = latitude * radians;
    const n = 0.5 * (Math.sin(phi1) + Math.sin(phi2));
    const c = Math.cos(phi1) ** 2 + 2 * n * Math.sin(phi1);
    const rho = Math.sqrt(c - 2 * n * Math.sin(phi)) / n;
    const rho0 = Math.sqrt(c - 2 * n * Math.sin(phi0)) / n;
    return [rho * Math.sin(n * lambda), rho0 - rho * Math.cos(n * lambda)];
  }

  function mapRegion(row) {
    const state = clean(row.state).toUpperCase();
    const baseState = state.split("-")[0] || "US";
    if (baseState === "US" && /^LAX/i.test(clean(row.fc))) {
      return { key: "CA-S", label: "SoCal" };
    }
    if (baseState !== "CA") return { key: baseState, label: baseState === "US" ? "Other" : baseState };
    const latitude = Number(row.latitude);
    const zipPrefix = Number(clean(row.zip).slice(0, 3));
    if (state.includes("-N") || zipPrefix >= 940 || latitude >= 37.35) return { key: "CA-N", label: "NorCal" };
    if (state.includes("-S") || (zipPrefix >= 900 && zipPrefix <= 935) || latitude <= 35) return { key: "CA-S", label: "SoCal" };
    return { key: "CA-C", label: "Central CA" };
  }

  function stateFill(abbreviation) {
    const western = new Set(["WA", "OR", "CA", "NV", "ID", "WY", "UT", "AZ", "CO", "NM", "MT"]);
    const central = new Set(["ND", "SD", "NE", "KS", "OK", "TX", "MN", "IA", "MO", "AR", "LA", "WI", "IL", "MS", "AL", "TN", "KY", "IN", "MI", "OH"]);
    if (western.has(abbreviation)) return "#79b950";
    if (central.has(abbreviation)) return "#91c563";
    return "#a1cc71";
  }

  function posterDate(weekStart, now) {
    const start = parseLocalDate(weekStart) || new Date(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const current = new Date(now);
    current.setHours(12, 0, 0, 0);
    if (current < start) return start;
    if (current > end) return end;
    return current;
  }

  function parseLocalDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(value));
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
  }

  function localIsoDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    if (context.roundRect) {
      context.roundRect(x, y, width, height, radius);
      return;
    }
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Poster template failed to load."));
      image.src = url;
    });
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Poster image could not be generated."));
      }, "image/png");
    });
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  root.FcPosterExport = {
    buildPosterModel,
    downloadPoster,
    layoutCallouts,
    renderPoster,
  };
})(typeof window !== "undefined" ? window : globalThis);
