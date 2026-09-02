import { CachedSnapshotStorage, SnapshotService } from '@anton-gustafsson/snapshot-core';
import { clear as clearIdb } from 'idb-keyval';
import {
  DASHBOARDS,
  makeClickableNavList,
  pageHeader,
  proceduralBlob,
  seedInBackground,
  toClickableItems,
} from '../gallery-shared';
import { SqliteRemoteStorage } from '../sqlite-storage';

export const path = '/sqlite';
export const label = 'SQLite + IndexedDB preload';
const PAGE_KEY = 'sqlite';

// The whole "local cache in front of a slow source of truth" tier is the
// library's CachedSnapshotStorage — all this page supplies is the two SQLite
// calls (SqliteRemoteStorage) that only it can make. `attach()` wires the
// revalidation back to publish() without this module touching the service.
const SQLITE_ITEMS = DASHBOARDS.slice(0, 4);
const SQLITE_KEY_PREFIX = 'gallery-sqlite-';
const sqliteRemote = new SqliteRemoteStorage(1200);
const sqliteService = new SnapshotService({
  storage: new CachedSnapshotStorage({ remote: sqliteRemote }),
  keyPrefix: SQLITE_KEY_PREFIX,
});

// Seeded once, the first time this page module is loaded — as if a previous
// session had already captured and synced these — so the section has
// something to show without requiring a real capture target. The "SQLITE"
// badge makes the background swap visible. `sqliteNavList` starts with no
// items (makeClickableNavList([]) registers the capture target and wires
// nav-select routing up front) and gets them set once seeding finishes
// (rather than up front and again after) so the thumbnail read can't
// double-fire per id before the first call had a chance to populate the
// nav-list's cache.
const sqliteNavList = makeClickableNavList([], { variant: 'tile' }, sqliteService, PAGE_KEY, path, label);
const seeded = seedInBackground(
  SQLITE_ITEMS,
  async (item) => {
    await sqliteRemote.seed(SQLITE_KEY_PREFIX + item.id, await proceduralBlob(`${item.id}-fresh`, 480, 300, 'SQLITE'));
  },
  'sqlite gallery',
);

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'SQLite + IndexedDB preload',
    `<code>CachedSnapshotStorage</code> over a remote backed by real SQLite
     (<a href="https://sql.js.org/" target="_blank" rel="noopener">sql.js</a>, compiled to WASM) with an artificial
     ~1.2s delay standing in for query/network latency. First visit has nothing cached, so the spinner waits for
     SQLite. After that the local <code>IndexedDbSnapshotStorage</code> cache paints instantly and the SQLite read
     happens in the background — the tile only swaps if what comes back actually differs. Click a card to open its
     dashboard; coming back captures through this same storage, which writes locally first and uploads after.`,
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
