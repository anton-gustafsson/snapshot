import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { get, set } from 'idb-keyval';
import type { SnapshotStorage } from '@snapshot/core';

const DB_CACHE_KEY = 'gallery:sqlite-db';

/**
 * SnapshotStorage backed by sql.js — real SQLite compiled to WASM, running
 * in the tab. The database file itself is persisted to IndexedDB (as raw
 * bytes via `db.export()`) so it survives reloads; sql.js has no native
 * durable storage of its own.
 *
 * `delayMs` simulates the latency a real embedded/remote database would add
 * (WASM init, disk I/O, network) — sql.js itself is fast enough that without
 * it every load would resolve just as instantly as the in-memory examples.
 */
export class SqliteSnapshotStorage implements SnapshotStorage {
  private dbPromise: Promise<Database>;

  constructor(private delayMs = 1200) {
    this.dbPromise = this.init();
  }

  private async init(): Promise<Database> {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const saved = await get<Uint8Array>(DB_CACHE_KEY);
    const db = saved ? new SQL.Database(saved) : new SQL.Database();
    db.run('CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, png BLOB NOT NULL)');
    return db;
  }

  private async persist(db: Database) {
    await set(DB_CACHE_KEY, db.export());
  }

  async save(id: string, blob: Blob) {
    const db = await this.dbPromise;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    db.run('INSERT OR REPLACE INTO snapshots (id, png) VALUES (?, ?)', [id, bytes]);
    await this.persist(db);
    return URL.createObjectURL(blob);
  }

  async load(id: string) {
    const db = await this.dbPromise;
    await new Promise((r) => setTimeout(r, this.delayMs));
    const rows = db.exec('SELECT png FROM snapshots WHERE id = ?', [id]);
    const bytes = rows[0]?.values[0]?.[0] as Uint8Array | undefined;
    if (!bytes) return null;
    return URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  }

  async remove(id: string) {
    const db = await this.dbPromise;
    db.run('DELETE FROM snapshots WHERE id = ?', [id]);
    await this.persist(db);
  }
}

/**
 * Stale-while-revalidate: `load()` returns whatever `fast` has immediately
 * (or null) for an instant paint, then always kicks off `slow` in the
 * background. If `slow` turns up a value the fast tier didn't have, that
 * value is written into `fast` (so next time it's the instant path too) and
 * handed to `onRevalidate` — wire that to `SnapshotService.publish()` so any
 * mounted <snapshot-nav-list> subscribed to the service swaps its thumbnail
 * in live, the same way a cross-tab capture would.
 *
 * This is the pattern for "IndexedDB as a preload in front of a slower
 * database": the fast tier is a local cache, the slow tier is the source of
 * truth, and the UI never blocks on the slow one.
 */
export class TieredSnapshotStorage implements SnapshotStorage {
  constructor(
    private fast: SnapshotStorage,
    private slow: SnapshotStorage,
    private onRevalidate: (id: string, url: string) => void,
  ) {}

  async save(id: string, blob: Blob) {
    const url = await this.fast.save(id, blob);
    void this.slow.save(id, blob).catch((err) => console.error(`sqlite save failed for "${id}"`, err));
    return url;
  }

  async load(id: string) {
    const cached = await this.fast.load(id);
    void this.revalidate(id, cached);
    return cached;
  }

  private async revalidate(id: string, cached: string | null) {
    try {
      const fresh = await this.slow.load(id);
      if (!fresh || fresh === cached) return;
      const blob = await fetch(fresh).then((r) => r.blob());
      await this.fast.save(id, blob);
      this.onRevalidate(id, fresh);
    } catch (err) {
      console.error(`sqlite revalidation failed for "${id}"`, err);
    }
  }

  async remove(id: string) {
    await Promise.all([this.fast.remove?.(id), this.slow.remove?.(id)]);
  }
}
