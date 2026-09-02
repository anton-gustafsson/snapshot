import { CachedSnapshotStorage, IndexedDbSnapshotStorage, SnapshotService } from '@anton-gustafsson/snapshot-core';
import type { RemoteSnapshotStorage, SnapshotKey } from '@anton-gustafsson/snapshot-core';
import { DASHBOARDS, makeClickableNavList, pageHeader, proceduralBlob, toClickableItems } from '../gallery-shared';

export const path = '/remote-storage';
export const label = 'Remote storage';
const PAGE_KEY = 'remote-storage';
const KEY_PREFIX = 'gallery-remote-';

const ITEMS = DASHBOARDS.slice(0, 4);
/** Ids the fake server has nothing for (a 404) and one it refuses to serve (a 403). */
const NOT_FOUND = new Set(['support']);
const FORBIDDEN = new Set(['ops']);

const log: string[] = [];
let logEl: HTMLElement | null = null;

function note(line: string) {
  log.unshift(`${new Date().toLocaleTimeString()}  ${line}`);
  log.length = Math.min(log.length, 12);
  if (logEl) logEl.textContent = log.join('\n');
}

/**
 * Stands in for the consumer-written half of a server-backed storage: two HTTP
 * calls with latency, a 404 for anything nobody has captured, and a 403 for a
 * row this user may not read. Note what it does *not* do — no caching, no
 * revalidation, no "don't evict on 404" logic. That's all
 * `CachedSnapshotStorage`.
 */
class FakeHttpRemote implements RemoteSnapshotStorage {
  private rows = new Map<string, Blob>();

  constructor(private latencyMs = 900) {}

  private wait() {
    return new Promise((r) => setTimeout(r, this.latencyMs));
  }

  async load(id: string, key: SnapshotKey) {
    await this.wait();
    if (FORBIDDEN.has(id)) {
      note(`GET ${key.key} → 403 (filtered by onError)`);
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
    const row = this.rows.get(key.key);
    if (!row) {
      note(`GET ${key.key} → 404 (nothing captured yet)`);
      return null;
    }
    note(`GET ${key.key} → 200 (${row.size} bytes)`);
    return row;
  }

  async save(blob: Blob, id: string, key: SnapshotKey) {
    await this.wait();
    this.rows.set(key.key, blob);
    note(`PUT ${key.key} → 204 (${blob.size} bytes, ${blob.type})`);
  }

  async remove(_id: string, key: SnapshotKey) {
    await this.wait();
    this.rows.delete(key.key);
    note(`DELETE ${key.key} → 204`);
  }

  /** Gallery-only: pretends a previous session already uploaded these. */
  async seed(key: string, blob: Blob) {
    this.rows.set(key, blob);
  }
}

const remote = new FakeHttpRemote();
// Held onto so the button below can evict *only* the local tier — the point of
// the demo is watching the server read come back, not deleting the row.
const local = new IndexedDbSnapshotStorage();
const remoteService = new SnapshotService({
  storage: new CachedSnapshotStorage({
    remote,
    local,
    // Upload a small WebP instead of the full-resolution PNG, and never exceed
    // what a real endpoint would accept.
    uploadEncode: { type: 'image/webp', quality: 0.8, maxEdge: 480 },
    maxBytes: 256 * 1024,
    onError: (err, key, op) => {
      // A 403 for a read-only user is routine — a consumer filters it here
      // instead of getting a console.warn per row.
      if ((err as { status?: number }).status === 403) return;
      console.warn(`remote-storage demo: ${op} failed for ${key.key}`, err);
    },
  }),
  keyPrefix: KEY_PREFIX,
  encode: { type: 'image/webp', quality: 0.8, maxEdge: 720 },
});

const seeded = (async () => {
  for (const item of ITEMS) {
    if (NOT_FOUND.has(item.id) || FORBIDDEN.has(item.id)) continue;
    await remote.seed(KEY_PREFIX + item.id, await proceduralBlob(`${item.id}-remote`, 480, 300, 'SERVER'));
  }
})().catch((err) => console.error('remote-storage seeding failed', err));

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Remote storage',
    `<code>CachedSnapshotStorage</code> in front of a fake HTTP API — ~0.9s latency, a 404 for
     <code>support</code> (nobody captured it), a 403 for <code>ops</code> (no rights). First load waits for the
     server; from then on the IndexedDB cache paints instantly and the server read happens behind it. The 404 and
     the 403 both leave a local capture alone, which is the whole point: a missing or refused server copy must never
     wipe a thumbnail this browser already has. Click a card to capture one and watch the upload — the request log
     below is the fake server talking.`,
  );

  const navList = makeClickableNavList(ITEMS, { variant: 'card' }, remoteService, PAGE_KEY, path, label);
  container.append(navList);
  void seeded.then(() => {
    navList.items = toClickableItems(ITEMS, PAGE_KEY);
  });

  const h3 = document.createElement('h3');
  h3.textContent = 'Request log';
  container.append(h3);

  const pre = document.createElement('pre');
  pre.className = 'config-snippet';
  logEl = document.createElement('code');
  logEl.textContent = log.join('\n') || '(no requests yet)';
  pre.append(logEl);
  container.append(pre);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Drop local cache (replay the server read)';
  clearBtn.addEventListener('click', async () => {
    for (const item of ITEMS) {
      await local.remove(remoteService.keyOf(item.id));
      remoteService.invalidate(item.id);
    }
    note('local cache cleared — next read goes to the server');
    navList.items = toClickableItems(ITEMS, PAGE_KEY);
  });
  container.append(clearBtn);
}
