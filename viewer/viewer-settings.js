export const loadSettings = async () => {
  const moduleUrl = new URL(import.meta.url);
  const settingsPath = moduleUrl.pathname.includes('/assets/')
    ? '../viewer-settings.json'
    : './viewer-settings.json';
  const url = new URL(settingsPath, moduleUrl);
  const res = await fetch(url);
  console.log("Fetched viewer-settings.json", res);
  return await res.json();
};
