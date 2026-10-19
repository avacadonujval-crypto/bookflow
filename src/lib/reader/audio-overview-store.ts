const DB_NAME = "bookflow-audio";
const STORE = "overviews";
const DB_VERSION = 1;

export type StoredAudioOverview = {
  bookId: string;
  title: string;
  script: string;
  mimeType: string;
  /** Base64 audio payload (no data: prefix). */
  audioBase64: string;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "bookId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

export async function saveAudioOverview(
  overview: StoredAudioOverview,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(overview);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Save failed"));
  });
  db.close();
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("bookflow:audio-overview", { detail: { bookId: overview.bookId } }),
    );
  }
}

export async function loadAudioOverview(
  bookId: string,
): Promise<StoredAudioOverview | null> {
  const db = await openDb();
  const row = await new Promise<StoredAudioOverview | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(bookId);
    req.onsuccess = () => resolve((req.result as StoredAudioOverview) ?? null);
    req.onerror = () => reject(req.error ?? new Error("Load failed"));
  });
  db.close();
  return row;
}

export async function deleteAudioOverview(bookId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(bookId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Delete failed"));
  });
  db.close();
}

export function overviewToObjectUrl(overview: StoredAudioOverview) {
  const binary = atob(overview.audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: overview.mimeType || "audio/wav" });
  return URL.createObjectURL(blob);
}
