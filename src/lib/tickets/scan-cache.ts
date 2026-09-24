/**
 * The door's offline memory: this event's ticket set and the check-ins that
 * could not be sent yet, in IndexedDB. Restaurant wifi drops mid-rush; the
 * queue is what keeps the line moving.
 */

export interface CachedTicket {
  id: string;
  /** sha256 hex of the signed QR payload, so a scan can be matched offline without the secret. */
  tokenHash: string;
  /** sha256 hex of the normalised 8-character code, for manual entry. */
  codeHash: string;
  tierName: string;
  status: 'valid' | 'checked_in' | 'void' | 'refunded';
  seats: number;
  orderNumber: string;
  orderSize: number;
  attendeeName: string | null;
}

export interface CachedManifest {
  eventId: string;
  eventTitle: string;
  fetchedAt: string;
  tickets: CachedTicket[];
}

export interface QueuedScan {
  key: string;
  eventId: string;
  token?: string;
  code?: string;
  ticketId: string;
  scannedAt: string;
  deviceLabel: string;
}

const DB = 'casa-aurelia-door';
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('manifests')) db.createObjectStore('manifests', { keyPath: 'eventId' });
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(store: string, mode: IDBTransactionMode, job: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const request = job(tx.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function saveManifest(manifest: CachedManifest): Promise<void> {
  await run('manifests', 'readwrite', (s) => s.put(manifest));
}

export async function loadManifest(eventId: string): Promise<CachedManifest | null> {
  try {
    return ((await run('manifests', 'readonly', (s) => s.get(eventId))) as CachedManifest | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function enqueue(scan: QueuedScan): Promise<void> {
  await run('queue', 'readwrite', (s) => s.put(scan));
}

export async function queued(): Promise<QueuedScan[]> {
  try {
    return (await run('queue', 'readonly', (s) => s.getAll())) as QueuedScan[];
  } catch {
    return [];
  }
}

export async function dequeue(key: string): Promise<void> {
  await run('queue', 'readwrite', (s) => s.delete(key));
}

/**
 * End of shift: take this event's ticket list off the phone.
 *
 * Queued check-ins are flushed by the caller first — this only removes what is
 * safe to lose. A staff phone that goes home with a manifest on it is a copy of
 * the door list nobody is guarding.
 */
export async function clearEvent(eventId: string): Promise<void> {
  try {
    await run('manifests', 'readwrite', (s) => s.delete(eventId));
    const items = await queued();
    for (const item of items) {
      if (item.eventId === eventId) await dequeue(item.key);
    }
  } catch {
    // Nothing cached, or storage is unavailable. Either way there is nothing
    // left to clear.
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
