import { SnapshotService } from '@snapshot/core';
import { DASHBOARDS, makeNavList, pageHeader, proceduralBlob, toClickableItems } from '../gallery-shared';
import { registerCaptureTarget } from '../gallery-registry';
import { router } from '../router';
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
registerCaptureTarget(PAGE_KEY, { service: sqliteOnlyService, backPath: path, backLabel: label });

const sqliteOnlyNavList = makeNavList([], { variant: 'icon-only' }, sqliteOnlyService);
sqliteOnlyNavList.addEventListener('nav-select', ((e: CustomEvent<{ route?: string }>) => {
  if (e.detail.route) router.navigate(e.detail.route);
}) as EventListener);

const seeded = (async () => {
  for (const item of SQLITE_ONLY_ITEMS) {
    await sqliteOnlyStorage.save(SQLITE_ONLY_KEY_PREFIX + item.id, await proceduralBlob(item.id, 480, 300, 'SQLITE'));
  }
})().catch((err) => console.error('sqlite-only gallery seeding failed', err));

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'SQLite only',
    `<code>SnapshotService</code> pointed straight at <code>SqliteSnapshotStorage</code> — no IndexedDB tier,
     no cache, no fallback. Every <code>get()</code> is a real (WASM) SQLite query with nothing in front of it,
     so the spinner shows for the full ~1.2s on every load, every time. Click a card to open its dashboard;
     coming back captures a real snapshot straight into SQLite.`,
  );

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = 'Reset (replay spinner)';
  container.append(resetBtn);

  container.append(sqliteOnlyNavList);
  void seeded.then(() => {
    sqliteOnlyNavList.items = toClickableItems(SQLITE_ONLY_ITEMS, PAGE_KEY);
  });

  // invalidate(), not remove() — the row stays in SQLite, only the nav-list's
  // local cache is cleared, so the next load is a real (slow) re-query.
  resetBtn.addEventListener('click', () => {
    SQLITE_ONLY_ITEMS.forEach((item) => sqliteOnlyService.invalidate(item.id));
    sqliteOnlyNavList.items = toClickableItems(SQLITE_ONLY_ITEMS, PAGE_KEY);
  });
}
