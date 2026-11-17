import { t } from "../../i18n-utils.js";
import { apiRequest } from "../api.js";

// Statistics (GET /api/admin/stats, worker/server.py admin_stats): how many
// accounts there are, of which role, status and plan, and how many models
// were uploaded and how big, per day (per week or month over longer ranges).
// The worker sends the raw points; they are counted here, in the browser's
// time zone. Charts are plain SVG: one series each, one axis, a tooltip on
// every column, and the numbers as a table underneath.

const SVG_NS = "http://www.w3.org/2000/svg";
const DAY_MS = 24 * 3600 * 1000;

const RANGES = [
  { id: "30", days: 30, unit: "day", label: ["exadmin.statsRange30", "30 days"] },
  { id: "90", days: 90, unit: "day", label: ["exadmin.statsRange90", "90 days"] },
  { id: "365", days: 365, unit: "week", label: ["exadmin.statsRange365", "12 months"] },
  { id: "all", days: 0, unit: "month", label: ["exadmin.statsRangeAll", "All time"] },
];

const ROLE_LABELS = {
  admin: ["exadmin.statsRoleAdmin", "Administrator"],
  user: ["exadmin.statsRoleUser", "User"],
};
const STATUS_LABELS = {
  active: ["exadmin.statsStatusActive", "Active"],
  pending: ["exadmin.statsStatusPending", "Waiting for approval"],
  disabled: ["exadmin.statsStatusDisabled", "Disabled"],
};
const PLAN_LABELS = {
  free: ["exadmin.statsPlanFree", "Free"],
  pro: ["exadmin.statsPlanPro", "Pro"],
  business: ["exadmin.statsPlanBusiness", "Business"],
  enterprise: ["exadmin.statsPlanEnterprise", "Enterprise"],
};

const label = ([key, fallback]) => t(key, fallback);

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toLocaleString(locale(), { maximumFractionDigits: digits })} ${units[unit]}`;
}

const formatCount = (value) => Math.round(value).toLocaleString(locale());

// ---- buckets -------------------------------------------------------------

function startOf(unit, date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (unit === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (unit === "month") d.setDate(1);
  return d;
}

function nextOf(unit, date) {
  const d = new Date(date);
  if (unit === "day") d.setDate(d.getDate() + 1);
  else if (unit === "week") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

// Dates in the admin page's language (main.js sets <html lang>).
const locale = () => document.documentElement.lang || undefined;

function bucketLabel(unit, date, short = false) {
  if (unit === "month") return date.toLocaleDateString(locale(), { year: short ? "2-digit" : "numeric", month: "short" });
  return date.toLocaleDateString(locale(), short ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

// The buckets of a range, oldest first: {start, end, label}. "All time"
// starts at the first point.
function makeBuckets(range, now, firstPoint) {
  const end = startOf(range.unit, now);
  let start;
  if (range.days) start = startOf(range.unit, new Date(now.getTime() - (range.days - 1) * DAY_MS));
  else start = startOf(range.unit, firstPoint ? new Date(firstPoint * 1000) : now);
  const buckets = [];
  for (let cursor = start; cursor <= end; cursor = nextOf(range.unit, cursor)) {
    buckets.push({ start: cursor, end: nextOf(range.unit, cursor) });
  }
  return buckets;
}

// Sums value(point) of the points into the buckets.
function fill(buckets, points, value = () => 1) {
  const sums = buckets.map(() => 0);
  if (!buckets.length) return sums;
  const first = buckets[0].start.getTime();
  const last = buckets[buckets.length - 1].end.getTime();
  points.forEach((point) => {
    const time = point.createdAt * 1000;
    if (time < first || time >= last) return;
    // Buckets are few (at most a few hundred): a scan is fine.
    const index = buckets.findIndex((bucket) => time < bucket.end.getTime());
    if (index >= 0) sums[index] += value(point);
  });
  return sums;
}

// ---- charts --------------------------------------------------------------

function svg(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value));
  return element;
}

// Clean axis maximum and ticks: 1, 2 or 5 times a power of ten.
// Counts step by whole numbers.
function niceTicks(max, count = 4) {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const raw = Math.max(1, max / count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { top, ticks };
}

function fractionalTicks(max, count = 4) {
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return { top, ticks };
}

// Byte axes step by powers of 1024 so the ticks read 0 / 256 MB / 512 MB.
function niceByteTicks(max) {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const unit = 1024 ** Math.max(0, Math.floor(Math.log(max) / Math.log(1024)));
  const { ticks } = fractionalTicks(max / unit);
  return { top: ticks[ticks.length - 1] * unit, ticks: ticks.map((tick) => tick * unit) };
}

class Tooltip {
  constructor(host) {
    this.element = document.createElement("div");
    this.element.className = "exadmin-stats-tooltip";
    this.element.hidden = true;
    host.appendChild(this.element);
    this.host = host;
  }

  show(event, title, value) {
    this.element.textContent = "";
    const head = document.createElement("div");
    head.className = "exadmin-stats-tooltip-title";
    head.textContent = title;
    const body = document.createElement("div");
    body.textContent = value;
    this.element.append(head, body);
    this.element.hidden = false;
    const box = this.host.getBoundingClientRect();
    const x = event.clientX - box.left;
    const width = this.element.offsetWidth;
    this.element.style.left = `${Math.max(0, Math.min(box.width - width, x - width / 2))}px`;
    this.element.style.top = `${event.clientY - box.top - this.element.offsetHeight - 12}px`;
  }

  hide() {
    this.element.hidden = true;
  }
}

// Columns over time (mode "columns") or a running total (mode "line").
function timeChart({ buckets, values, unit, format, mode = "columns", ticks: tickFn = niceTicks }) {
  const figure = document.createElement("div");
  figure.className = "exadmin-stats-plot";
  const tooltip = new Tooltip(figure);

  const draw = () => {
    figure.querySelector("svg")?.remove();
    const width = Math.max(280, figure.clientWidth || 600);
    const height = 180;
    const margin = { top: 10, right: 8, bottom: 24, left: 56 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const { top, ticks } = tickFn(Math.max(0, ...values));
    const y = (v) => margin.top + plotH - (v / top) * plotH;
    const band = plotW / Math.max(1, buckets.length);

    const root = svg("svg", { viewBox: `0 0 ${width} ${height}`, width, height, role: "img" });
    ticks.forEach((tick) => {
      root.appendChild(svg("line", {
        x1: margin.left, x2: width - margin.right, y1: y(tick), y2: y(tick), class: "exadmin-stats-grid",
      }));
      const text = svg("text", { x: margin.left - 8, y: y(tick) + 4, "text-anchor": "end", class: "exadmin-stats-axis" });
      text.textContent = format(tick);
      root.appendChild(text);
    });

    // Date labels: as many as fit, about 70px apart.
    const every = Math.max(1, Math.ceil(70 / band));
    buckets.forEach((bucket, index) => {
      if (index % every) return;
      const text = svg("text", {
        x: margin.left + band * (index + 0.5), y: height - 6, "text-anchor": "middle", class: "exadmin-stats-axis",
      });
      text.textContent = bucketLabel(unit, bucket.start, true);
      root.appendChild(text);
    });

    if (mode === "line") {
      const points = values.map((v, i) => `${margin.left + band * (i + 0.5)},${y(v)}`);
      const base = y(0);
      root.appendChild(svg("path", {
        d: `M${margin.left + band * 0.5},${base}L${points.join("L")}L${margin.left + band * (values.length - 0.5)},${base}Z`,
        class: "exadmin-stats-area",
      }));
      root.appendChild(svg("path", { d: `M${points.join("L")}`, class: "exadmin-stats-line" }));
      const lastX = margin.left + band * (values.length - 0.5);
      root.appendChild(svg("circle", { cx: lastX, cy: y(values[values.length - 1] || 0), r: 4, class: "exadmin-stats-dot" }));
    } else {
      const barW = Math.max(1, Math.min(24, band - 2));
      const radius = Math.min(4, barW / 2);
      values.forEach((value, index) => {
        if (!value) return;
        const x = margin.left + band * index + (band - barW) / 2;
        const h = Math.max(1, y(0) - y(value));
        const r = Math.min(radius, h);
        const top0 = y(0) - h;
        // Rounded at the data end, square on the baseline.
        root.appendChild(svg("path", {
          d: `M${x},${y(0)}V${top0 + r}Q${x},${top0} ${x + r},${top0}H${x + barW - r}Q${x + barW},${top0} ${x + barW},${top0 + r}V${y(0)}Z`,
          class: "exadmin-stats-bar",
        }));
      });
    }
    root.appendChild(svg("line", {
      x1: margin.left, x2: width - margin.right, y1: y(0), y2: y(0), class: "exadmin-stats-baseline",
    }));

    // Hit targets: the whole band, taller than the mark.
    const marker = svg("line", { y1: margin.top, y2: y(0), class: "exadmin-stats-cursor", visibility: "hidden" });
    root.appendChild(marker);
    buckets.forEach((bucket, index) => {
      const hit = svg("rect", {
        x: margin.left + band * index, y: margin.top, width: band, height: plotH, class: "exadmin-stats-hit",
      });
      const title = unit === "day" ? bucketLabel("day", bucket.start)
        : unit === "week" ? `${bucketLabel("day", bucket.start)} – ${bucketLabel("day", new Date(bucket.end.getTime() - DAY_MS))}`
          : bucketLabel("month", bucket.start);
      hit.addEventListener("pointermove", (event) => {
        const cx = margin.left + band * (index + 0.5);
        marker.setAttribute("x1", cx);
        marker.setAttribute("x2", cx);
        marker.setAttribute("visibility", "visible");
        tooltip.show(event, title, format(values[index]));
      });
      hit.addEventListener("pointerleave", () => {
        marker.setAttribute("visibility", "hidden");
        tooltip.hide();
      });
      root.appendChild(hit);
    });
    figure.prepend(root);
  };

  // Drawn once in the page (its width known), again when the width changes.
  let lastWidth = 0;
  new ResizeObserver(() => {
    if (figure.clientWidth && figure.clientWidth !== lastWidth) {
      lastWidth = figure.clientWidth;
      draw();
    }
  }).observe(figure);
  return figure;
}

// Horizontal bars of a breakdown (role, status, plan), largest first is
// left to the caller: the order of the categories is fixed.
function breakdownChart(rows) {
  const list = document.createElement("div");
  list.className = "exadmin-stats-breakdown";
  const max = Math.max(1, ...rows.map((row) => row.value));
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "exadmin-stats-breakdown-row";
    const name = document.createElement("span");
    name.className = "exadmin-stats-breakdown-name";
    name.textContent = row.label;
    const track = document.createElement("span");
    track.className = "exadmin-stats-breakdown-track";
    const bar = document.createElement("span");
    bar.className = "exadmin-stats-breakdown-bar";
    bar.style.width = row.value ? `${Math.max(1, (row.value / max) * 100)}%` : "0";
    track.appendChild(bar);
    const value = document.createElement("span");
    value.className = "exadmin-stats-breakdown-value";
    value.textContent = formatCount(row.value);
    item.append(name, track, value);
    list.appendChild(item);
  });
  return list;
}

function dataTable(headers, rows) {
  const details = document.createElement("details");
  details.className = "exadmin-stats-table";
  const summary = document.createElement("summary");
  summary.textContent = t("exadmin.statsShowTable", "Table");
  const table = document.createElement("table");
  const head = table.createTHead().insertRow();
  headers.forEach((header) => {
    const cell = document.createElement("th");
    cell.textContent = header;
    head.appendChild(cell);
  });
  const body = table.createTBody();
  rows.forEach((row) => {
    const tr = body.insertRow();
    row.forEach((value) => {
      tr.insertCell().textContent = value;
    });
  });
  details.append(summary, table);
  return details;
}

function card(title, subtitle, ...content) {
  const element = document.createElement("article");
  element.className = "exadmin-stats-card";
  const heading = document.createElement("h3");
  heading.textContent = title;
  element.appendChild(heading);
  if (subtitle) {
    const sub = document.createElement("p");
    sub.className = "exadmin-stats-sub";
    sub.textContent = subtitle;
    element.appendChild(sub);
  }
  element.append(...content);
  return element;
}

function tile(value, caption) {
  const element = document.createElement("div");
  element.className = "exadmin-stats-tile";
  const number = document.createElement("strong");
  number.textContent = value;
  const text = document.createElement("span");
  text.textContent = caption;
  element.append(number, text);
  return element;
}

// ---- the section ---------------------------------------------------------

const RANGE_STORAGE_KEY = "exadmin-stats-range";

function storedRange() {
  try {
    return RANGES.find((range) => range.id === localStorage.getItem(RANGE_STORAGE_KEY)) || RANGES[0];
  } catch {
    return RANGES[0];
  }
}

class StatsSection {
  constructor() {
    this.range = storedRange();
    const element = document.createElement("section");
    element.className = "exadmin-section exadmin-stats";
    element.innerHTML = `
      <div class="exadmin-section-header">
        <h2></h2>
        <div class="exadmin-stats-ranges" role="group"></div>
      </div>
      <p class="upload-panel-status" role="status" aria-live="polite"></p>
      <div class="exadmin-stats-body"></div>
    `;
    element.querySelector("h2").textContent = t("exadmin.statsTitle", "Statistics");
    this.element = element;
    this.status = element.querySelector(".upload-panel-status");
    this.body = element.querySelector(".exadmin-stats-body");
    this.ranges = element.querySelector(".exadmin-stats-ranges");
    this.ranges.setAttribute("aria-label", t("exadmin.statsRange", "Period"));
    this.renderRanges();
  }

  renderRanges() {
    this.ranges.textContent = "";
    RANGES.forEach((range) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label(range.label);
      button.setAttribute("aria-pressed", String(range === this.range));
      button.addEventListener("click", () => {
        this.range = range;
        try {
          localStorage.setItem(RANGE_STORAGE_KEY, range.id);
        } catch {
          // Storage blocked: the choice lasts until the page is left.
        }
        this.renderRanges();
        this.render();
      });
      this.ranges.appendChild(button);
    });
  }

  async load() {
    this.status.textContent = t("exadmin.loading", "Loading...");
    try {
      this.data = await apiRequest("/api/admin/stats");
      this.status.textContent = "";
    } catch (error) {
      console.error("[exadmin] Failed to load statistics:", error);
      this.status.textContent = error.message;
      this.status.dataset.tone = "error";
      return;
    }
    this.render();
  }

  render() {
    if (!this.data) return;
    const users = Array.isArray(this.data.users) ? this.data.users : [];
    const models = Array.isArray(this.data.models) ? this.data.models : [];
    const now = new Date((this.data.now || Date.now() / 1000) * 1000);
    const range = this.range;
    const unitText = {
      day: t("exadmin.statsPerDay", "per day"),
      week: t("exadmin.statsPerWeek", "per week"),
      month: t("exadmin.statsPerMonth", "per month"),
    }[range.unit];
    const firstPoint = Math.min(...[...users, ...models].map((p) => p.createdAt).filter(Boolean), now.getTime() / 1000);
    const buckets = makeBuckets(range, now, firstPoint);
    const periodHeader = t("exadmin.statsPeriod", "Period");
    const periodLabels = buckets.map((bucket) => bucketLabel(range.unit, bucket.start));

    this.body.textContent = "";

    // Headline numbers.
    const count = (list, key, value) => list.filter((item) => item[key] === value).length;
    const tiles = document.createElement("div");
    tiles.className = "exadmin-stats-tiles";
    tiles.append(
      tile(formatCount(users.length), t("exadmin.statsUsers", "Accounts")),
      tile(formatCount(count(users, "status", "pending")), t("exadmin.statsPending", "Waiting for approval")),
      tile(formatCount(models.length), t("exadmin.statsModels", "Models")),
      tile(formatBytes(models.reduce((sum, m) => sum + (m.size || 0), 0)), t("exadmin.statsUploadedSize", "Uploaded")),
      tile(formatBytes(models.reduce((sum, m) => sum + (m.storage || 0), 0)), t("exadmin.statsStorage", "On disk")),
    );
    this.body.appendChild(tiles);

    // Accounts: in total over time, new ones per bucket.
    const signups = fill(buckets, users);
    const before = users.filter((u) => buckets.length && u.createdAt * 1000 < buckets[0].start.getTime()).length;
    let running = before;
    const totals = signups.map((n) => (running += n));
    const grid = document.createElement("div");
    grid.className = "exadmin-stats-grid-cards";
    grid.append(
      card(t("exadmin.statsUsersTotal", "Accounts in total"), null,
        timeChart({ buckets, values: totals, unit: range.unit, format: formatCount, mode: "line" }),
        dataTable([periodHeader, t("exadmin.statsUsers", "Accounts")], periodLabels.map((p, i) => [p, formatCount(totals[i])]))),
      card(t("exadmin.statsSignups", "New accounts"), unitText,
        timeChart({ buckets, values: signups, unit: range.unit, format: formatCount }),
        dataTable([periodHeader, t("exadmin.statsSignups", "New accounts")], periodLabels.map((p, i) => [p, formatCount(signups[i])]))),
    );

    // Models: how many, how big.
    const uploads = fill(buckets, models);
    const sizes = fill(buckets, models, (m) => m.size || 0);
    grid.append(
      card(t("exadmin.statsUploads", "Uploaded models"), unitText,
        timeChart({ buckets, values: uploads, unit: range.unit, format: formatCount }),
        dataTable([periodHeader, t("exadmin.statsModels", "Models")], periodLabels.map((p, i) => [p, formatCount(uploads[i])]))),
      card(t("exadmin.statsUploadSizes", "Size of the uploaded models"), unitText,
        timeChart({ buckets, values: sizes, unit: range.unit, format: formatBytes, ticks: niceByteTicks }),
        dataTable([periodHeader, t("exadmin.statsUploadedSize", "Uploaded")], periodLabels.map((p, i) => [p, formatBytes(sizes[i])]))),
    );

    // Breakdowns of the accounts as they are now.
    const breakdown = (labels, key) => Object.entries(labels).map(([id, text]) => ({ label: label(text), value: count(users, key, id) }));
    const breakdownCard = (title, rows) => card(title, null, breakdownChart(rows),
      dataTable([title, t("exadmin.statsUsers", "Accounts")], rows.map((row) => [row.label, formatCount(row.value)])));
    grid.append(
      breakdownCard(t("exadmin.statsByRole", "Role"), breakdown(ROLE_LABELS, "role")),
      breakdownCard(t("exadmin.statsByPlan", "Plan"), breakdown(PLAN_LABELS, "plan")),
      breakdownCard(t("exadmin.statsByStatus", "Status"), breakdown(STATUS_LABELS, "status")),
    );
    this.body.appendChild(grid);
  }
}

export const statsSection = {
  id: "stats",
  label: () => t("exadmin.navStats", "Statistics"),
  mount(container) {
    const section = new StatsSection();
    container.appendChild(section.element);
    section.load();
  },
};
