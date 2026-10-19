// Worker endpoints for the admin pages, same-origin like the viewer's: the
// session is the worker's cookie (worker/auth.py). /api/auth/* answers
// anyone, /api/admin/* only an admin session (server.py _require_admin).
export async function apiRequest(endpoint, method = "GET", body = undefined) {
  const options = { method, credentials: "same-origin", headers: {} };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  const response = await fetch(endpoint, options);
  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    // Non-JSON error page (e.g. from a proxy) - fall through with the status.
  }
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
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
