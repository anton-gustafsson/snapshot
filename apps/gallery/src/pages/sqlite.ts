import { SnapshotService, IndexedDbSnapshotStorage } from '@snapshot/core';
import { clear as clearIdb } from 'idb-keyval';
import { DASHBOARDS, makeNavList, pageHeader, proceduralBlob, toClickableItems } from '../gallery-shared';
import { registerCaptureTarget } from '../gallery-registry';
import { router } from '../router';
import { SqliteSnapshotStorage, TieredSnapshotStorage } from '../sqlite-storage';

export const path = '/sqlite';
export const label = 'SQLite + IndexedDB preload';
const PAGE_KEY = 'sqlite';

// SQLite + IndexedDB preload — see sqlite-storage.ts for the tiered storage
// itself. `sqliteService` is declared with `let` and assigned after the
// storage below because the storage needs a way to publish revalidated
// values back through the service, and the service needs the storage to
// construct — the callback just isn't invoked until well after this module
// finishes evaluating, so the forward reference is safe.
const SQLITE_ITEMS = DASHBOARDS.slice(0, 4);
const SQLITE_KEY_PREFIX = 'gallery-sqlite-';
const fastStorage = new IndexedDbSnapshotStorage();
const slowStorage = new SqliteSnapshotStorage(1200);
let sqliteService: SnapshotService;
const sqliteStorage = new TieredSnapshotStorage(fastStorage, slowStorage, (prefixedId, url) =>
  sqliteService.publish(prefixedId.slice(SQLITE_KEY_PREFIX.length), url),
);
sqliteService = new SnapshotService({ storage: sqliteStorage, keyPrefix: SQLITE_KEY_PREFIX });
registerCaptureTarget(PAGE_KEY, { service: sqliteService, backPath: path, backLabel: label });

// Seeded once, the first time this page module is loaded — as if a previous
// session had already captured and synced these — so the section has
// something to show without requiring a real capture target. "DB" and
// "SQLITE" badges make the swap visible. `sqliteNavList` starts with no
// items and gets them set once seeding finishes (rather than up front and
// again after) so loadThumb() can't double-fire per id before the first
// call had a chance to populate the nav-list's thumbnail cache.
const sqliteNavList = makeNavList([], { variant: 'icon-only' }, sqliteService);
sqliteNavList.addEventListener('nav-select', ((e: CustomEvent<{ route?: string }>) => {
  if (e.detail.route) router.navigate(e.detail.route);
}) as EventListener);
const seeded = (async () => {
  for (const item of SQLITE_ITEMS) {
    const key = SQLITE_KEY_PREFIX + item.id;
    await fastStorage.save(key, await proceduralBlob(`${item.id}-cached`, 480, 300, 'DB (cache)'));
    await slowStorage.save(key, await proceduralBlob(`${item.id}-fresh`, 480, 300, 'SQLITE'));
  }
})().catch((err) => console.error('sqlite gallery seeding failed', err));

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'SQLite + IndexedDB preload',
    `Storage backed by real SQLite (<a href="https://sql.js.org/" target="_blank" rel="noopener">sql.js</a>,
     compiled to WASM) with an artificial ~1.2s delay standing in for real query latency. In front of it, a
     local <code>IndexedDbSnapshotStorage</code> cache serves an instant "last known" image — <code>DB</code>
     badge in the corner — then the SQLite read resolves in the background and the tile swaps to the
     <code>SQLITE</code>-tagged image live, no remount needed. Click a card to open its dashboard;
     coming back captures a real snapshot through this same tiered storage.`,
  );
  const p2 = document.createElement('p');
  p2.textContent =
    'Navigate away and back: the cache is now warm, so every tile paints instantly from IndexedDB before quietly re-validating against SQLite. "Clear caches & reload" resets that.';
  container.append(p2);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = 'Clear caches & reload';
  container.append(resetBtn);

  // The nav-list persists across renders of this page (module-level, not
  // recreated here) so revisiting doesn't lose whatever it already loaded —
  // just re-append it into the fresh container.
  container.append(sqliteNavList);
  void seeded.then(() => {
    sqliteNavList.items = toClickableItems(SQLITE_ITEMS, PAGE_KEY);
  });

  resetBtn.addEventListener('click', async () => {
    await clearIdb();
    location.reload();
  });
}
