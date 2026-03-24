export const loadSettings = async () => {
  const res = await fetch("./assets/viewer-settings.json");
  console.log("Fetched viewer-settings.json", res);
  return await res.json();
};