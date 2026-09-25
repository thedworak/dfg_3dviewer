// Models kept on this device, so they open without a network: files picked
// from the device and models saved from the repository. IndexedDB stores the
// files as Blobs (no base64 round trip), in the app and in the browser alike.
// An entry: { id, name, fileName, size, savedAt, source: "device" |
// "repository", remoteId?, file: Blob, thumbnail?: Blob }.
const DB_NAME = "dfg3dviewer-library";
const STORE = "models";

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

async function run(mode, action) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Without this the browser may evict the library under storage pressure.
function requestPersistentStorage() {
  navigator.storage?.persist?.().catch(() => {});
}

export async function listLibrary() {
  const entries = await run("readonly", (store) => store.getAll());
  return (entries || []).sort((a, b) => b.savedAt - a.savedAt);
}

export async function saveToLibrary({ id, name, fileName, source, remoteId, file, thumbnail }) {
  const entry = {
    id: id || `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || fileName,
    fileName,
    size: file.size,
    savedAt: Date.now(),
    source,
    remoteId: remoteId ?? null,
    file,
    thumbnail: thumbnail ?? null,
  };
  await run("readwrite", (store) => store.put(entry));
  requestPersistentStorage();
  return entry;
}

export function removeFromLibrary(id) {
  return run("readwrite", (store) => store.delete(id));
}

// A File the viewer can open like a picked or dropped one.
export function libraryEntryFile(entry) {
  return new File([entry.file], entry.fileName, { type: entry.file.type });
}

export const repositoryEntryId = (jobId) => `repository-${jobId}`;
