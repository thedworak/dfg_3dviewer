// Numbers, dates and sizes on the admin pages, in the page's language
// (main.js sets <html lang>), not the browser's.

export const locale = () => document.documentElement.lang || undefined;

const toDate = (seconds) => new Date(seconds * 1000);

export const formatDate = (seconds) => (seconds ? toDate(seconds).toLocaleDateString(locale()) : "");

export const formatDateTime = (seconds) =>
  seconds ? toDate(seconds).toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" }) : "";

export const formatCount = (value) => Math.round(value || 0).toLocaleString(locale());

export function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toLocaleString(locale(), { maximumFractionDigits: digits })} ${units[unit]}`;
}

// "3 days ago", "in 2 hours" - for the last time an account was active.
export function formatRelative(seconds, now = Date.now() / 1000) {
  if (!seconds) return "";
  const diff = seconds - now;
  const steps = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  const format = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  for (const [unit, size] of steps) {
    if (Math.abs(diff) >= size) return format.format(Math.round(diff / size), unit);
  }
  return format.format(0, "minute");
}
