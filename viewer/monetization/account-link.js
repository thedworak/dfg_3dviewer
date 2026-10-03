import { apiUrl, appRequestHeaders, hasRemote, sessionToken } from "../remote.js";
import { currentStoreTier, getAppUserId, isTestingBuild, whenPlanReady } from "./plan.js";

// The app's purchase linked to an account on the repository (worker
// POST /api/app/link|sync|unlink, see worker/entitlements.py). The worker
// checks the plan with RevenueCat itself and stores it on the account, so the
// admin panel and the account's name show it, and the app applies the
// account's plan (login-panel.js) on every device it signs in on.

// Testing builds without the store have no RevenueCat id: a random one per
// device stands in for it.
const TEST_ID_KEY = "dfg3dviewer-plan-test-id";

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // Kept for this session only.
  }
}

function linkId() {
  const id = getAppUserId();
  if (id || !isTestingBuild()) return id;
  let testId = readStorage(TEST_ID_KEY);
  if (!testId) {
    testId = `test:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    writeStorage(TEST_ID_KEY, testId);
  }
  return testId;
}

export function canLinkAccount() {
  return hasRemote() && Boolean(linkId());
}

async function appRequest(action, body) {
  const headers = { ...appRequestHeaders(), "X-App-User-Id": linkId() };
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(apiUrl(`/api/app/${action}`), {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await response.json();
  } catch {
    // Non-JSON error page (e.g. from a proxy) - fall through with the status.
  }
  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// Reports this device's purchase to the repository (after signing in, a
// purchase, a restore or on start): signed in, it is linked to that account
// (moved from any other one); signed out, an account it was linked to before
// gets its plan refreshed. The tier goes along only for workers that accept
// it unverified (testing, WORKER_APP_PLANS_UNVERIFIED); otherwise the worker
// asks RevenueCat. Quiet: no network or no repository just means it waits
// for the next time.
export async function syncAccountLink() {
  await whenPlanReady();
  if (!canLinkAccount()) return null;
  try {
    return await appRequest(sessionToken() ? "link" : "sync", { tier: currentStoreTier() });
  } catch (error) {
    console.warn("Plans: account sync failed", error);
    return null;
  }
}
