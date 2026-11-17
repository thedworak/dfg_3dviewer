// Worker endpoints for the admin pages. On the web they are same-origin
// like the viewer's: the session is the worker's cookie (worker/auth.py).
// In the app (ui/admin-panel.js opens this page with ?app=1&remote=<url>)
// they go to the repository the app is connected to, with the app's
// session token as a Bearer header - kept where the app keeps it
// (remote.js, "dfg3dviewer-session"), so a login or a second step here
// counts in the app's viewer as well. /api/auth/* answers anyone,
// /api/admin/* only an admin session that passed the second step
// (server.py _require_admin, _admin_second_step_ok).

const params = new URLSearchParams(location.search);
const SESSION_KEY = "dfg3dviewer-session";
// The app's "remember this device" for the second step, per repository (on
// the web it is the worker's HttpOnly cookie).
const DEVICE_KEY = "dfg3dviewer-admin-device";

export const appMode = params.get("app") === "1";
const remote = appMode ? String(params.get("remote") || "").replace(/\/+$/, "") : "";

function readSessions(key = SESSION_KEY) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}") || {};
  } catch {
    return {};
  }
}

function writeSessions(key, sessions) {
  try {
    localStorage.setItem(key, JSON.stringify(sessions));
  } catch {
    // Storage blocked: the panel keeps working until it is closed.
  }
}

export function storeDeviceToken(token) {
  if (!appMode) return;
  const devices = readSessions(DEVICE_KEY);
  if (token) devices[remote] = token;
  else delete devices[remote];
  writeSessions(DEVICE_KEY, devices);
}

export function sessionToken() {
  return appMode ? readSessions()[remote] || "" : "";
}

// A new session from logging in or from the second step (in the app; on
// the web the worker sets the cookie itself).
export function storeSessionToken(token) {
  if (!appMode) return;
  const sessions = readSessions();
  if (token) sessions[remote] = token;
  else delete sessions[remote];
  writeSessions(SESSION_KEY, sessions);
}

// Site-relative URLs the worker returns (/files/...): on the repository.
export const remoteUrl = (path) => (appMode && path?.startsWith("/") ? remote + path : path);

export async function apiRequest(endpoint, method = "GET", body = undefined) {
  const options = { method, credentials: appMode ? "omit" : "same-origin", headers: {} };
  const token = sessionToken();
  if (token) options.headers.Authorization = `Bearer ${token}`;
  const device = appMode ? readSessions(DEVICE_KEY)[remote] : "";
  if (device) options.headers["X-Admin-Device"] = device;
  if (body !== undefined) {
    // In the app the token comes back in the answer, not as a cookie.
    if (appMode && endpoint.startsWith("/api/auth/") && body && typeof body === "object") body = { ...body, session: "token" };
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(remoteUrl(endpoint), options);
  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    // Non-JSON error page (e.g. from a proxy) - fall through with the status.
  }
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = data.code;
    // The second step is due (again): main.js asks for it.
    if (data.code === "2fa_required" || data.code === "2fa_setup_required") {
      window.dispatchEvent(new CustomEvent("exadmin:second-step", { detail: data.code }));
    }
    throw error;
  }
  if (data.token) storeSessionToken(data.token);
  if (data.deviceToken) storeDeviceToken(data.deviceToken);
  // Something was changed (an account approved, a report resolved, a
  // model deleted): the navigation's counters are read again (main.js).
  if (method !== "GET" && !endpoint.startsWith("/api/auth/")) {
    window.dispatchEvent(new Event("exadmin:changed"));
  }
  return data;
}

export const authRequest = (path, body) => apiRequest(`/api/auth/${path}`, body ? "POST" : "GET", body);

// GET /api/jobs includes each job's `owner` username (worker/server.py
// list_jobs): each user's models without an endpoint of their own. Jobs
// without an owner are keyed "".
export async function fetchJobsByOwner() {
  const data = await apiRequest("/api/jobs");
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const byOwner = new Map();
  for (const job of jobs) {
    const owner = job.owner || "";
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner).push(job);
  }
  return byOwner;
}
