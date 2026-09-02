import { SnapshotService } from '@anton-gustafsson/snapshot-core';
import {
  DASHBOARDS,
  makeClickableNavList,
  pageHeader,
  proceduralBlob,
  resetSpinnerButton,
  seedInBackground,
  toClickableItems,
} from '../gallery-shared';
import { SqliteSnapshotStorage } from '../sqlite-storage';

export const path = '/sqlite-only';
export const label = 'SQLite only';
const PAGE_KEY = 'sqlite-only';

// No fast tier, no fallback. `get()` always goes straight to the WASM SQLite
// query, so the spinner is real (and full-length) every time.
const SQLITE_ONLY_ITEMS = DASHBOARDS.slice(0, 4);
const SQLITE_ONLY_KEY_PREFIX = 'gallery-sqlite-only-';
const sqliteOnlyStorage = new SqliteSnapshotStorage(1200);
const sqliteOnlyService = new SnapshotService({ storage: sqliteOnlyStorage, keyPrefix: SQLITE_ONLY_KEY_PREFIX });

const sqliteOnlyNavList = makeClickableNavList([], { variant: 'tile' }, sqliteOnlyService, PAGE_KEY, path, label);

const seeded = seedInBackground(
  SQLITE_ONLY_ITEMS,
  async (item) => {
    await sqliteOnlyStorage.save(await proceduralBlob(item.id, 480, 300, 'SQLITE'), sqliteOnlyService.keyOf(item.id));
  },
  'sqlite-only gallery',
);

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'SQLite only',
    `<code>SnapshotService</code> pointed straight at <code>SqliteSnapshotStorage</code> — no IndexedDB tier,
     no cache, no fallback. Every <code>get()</code> is a real (WASM) SQLite query with nothing in front of it,
     so the spinner shows for the full ~1.2s on every load, every time. Click a card to open its dashboard;
     coming back captures a real snapshot straight into SQLite.`,
  );

  // invalidate(), not remove() — the row stays in SQLite, only the nav-list's
  // local cache is cleared, so the next load is a real (slow) re-query.
  container.append(resetSpinnerButton(SQLITE_ONLY_ITEMS, sqliteOnlyService, sqliteOnlyNavList, PAGE_KEY), sqliteOnlyNavList);
  void seeded.then(() => {
    sqliteOnlyNavList.items = toClickableItems(SQLITE_ONLY_ITEMS, PAGE_KEY);
  });
}
