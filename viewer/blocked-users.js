import { remoteBase } from './remote.js';

// Uploaders this viewer no longer shows models of (the models panel's
// "Report or block"): the App Store asks apps with user-generated content
// for a way to block abusive users (guideline 1.2). Kept on this device, per
// repository address - user names are only unique on one repository. The
// models stay on the repository; reporting them is what reaches the
// moderators (worker/reports.py).
const STORAGE_KEY = 'dfg3dviewer-blocked-users';
let inMemory = {};

function readAll() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch {
    return inMemory;
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage blocked: blocked until the viewer is closed.
    inMemory = data;
  }
}

// The web viewer's repository is the page's own origin ('' as the key).
const repositoryKey = () => remoteBase() || window.location.origin;

export function blockedUsers() {
  const list = readAll()[repositoryKey()];
  return Array.isArray(list) ? list.filter((name) => typeof name === 'string') : [];
}

export function isBlockedUser(name) {
  return Boolean(name) && blockedUsers().includes(name);
}

export function blockUser(name) {
  if (!name || isBlockedUser(name)) return;
  const data = readAll();
  data[repositoryKey()] = [...blockedUsers(), name];
  writeAll(data);
}

export function unblockUser(name) {
  const data = readAll();
  data[repositoryKey()] = blockedUsers().filter((blocked) => blocked !== name);
  writeAll(data);
}
