import initSqlJs, { type Database } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { get, set } from 'idb-keyval';
import type { RemoteSnapshotStorage, SnapshotKey, SnapshotStorage } from '@anton-gustafsson/snapshot-core';

const DB_CACHE_KEY = 'gallery:sqlite-db';

/**
 * Real SQLite compiled to WASM (sql.js), running in the tab. The database file
 * itself is persisted to IndexedDB (as raw bytes via `db.export()`) so it
 * survives reloads; sql.js has no durable storage of its own.
 *
 * `delayMs` simulates the latency a real embedded/remote database would add
 * (WASM init, disk I/O, network) — sql.js itself is fast enough that without
 * it every load would resolve just as instantly as the in-memory examples.
 */
class SqliteDb {
  private dbPromise: Promise<Database>;

  constructor(private delayMs: number) {
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

  async put(key: string, blob: Blob) {
    const db = await this.dbPromise;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    db.run('INSERT OR REPLACE INTO snapshots (id, png) VALUES (?, ?)', [key, bytes]);
    await this.persist(db);
  }

  async fetch(key: string): Promise<Blob | null> {
    const db = await this.dbPromise;
    await new Promise((r) => setTimeout(r, this.delayMs));
    const rows = db.exec('SELECT png FROM snapshots WHERE id = ?', [key]);
    const bytes = rows[0]?.values[0]?.[0] as Uint8Array | undefined;
    return bytes ? new Blob([bytes], { type: 'image/png' }) : null;
  }

  async drop(key: string) {
    const db = await this.dbPromise;
    db.run('DELETE FROM snapshots WHERE id = ?', [key]);
    await this.persist(db);
  }

  async allKeys() {
    const db = await this.dbPromise;
    const rows = db.exec('SELECT id FROM snapshots');
    return (rows[0]?.values ?? []).map(([id]) => String(id));
  }
}

/** `SnapshotStorage` straight onto SQLite — every read is a real (slow) query, nothing in front of it. */
export class SqliteSnapshotStorage implements SnapshotStorage {
  private db: SqliteDb;

  constructor(delayMs = 1200) {
    this.db = new SqliteDb(delayMs);
  }

  async save(blob: Blob, key: SnapshotKey) {
    await this.db.put(key.key, blob);
    return URL.createObjectURL(blob);
  }

  async load(key: SnapshotKey) {
    const blob = await this.db.fetch(key.key);
    return blob ? URL.createObjectURL(blob) : null;
  }

  async remove(key: SnapshotKey) {
    await this.db.drop(key.key);
  }

  async keys() {
    return (await this.db.allKeys()).map((key) => ({ id: key, key }));
  }
}

/**
 * The same SQLite database, exposed as a *remote* store — blobs in, blobs out,
 * no URLs — so `CachedSnapshotStorage` can put a local IndexedDB cache in front
 * of it. This is all a real consumer writes: the two calls only it can make.
 */
export class SqliteRemoteStorage implements RemoteSnapshotStorage {
  private db: SqliteDb;

  constructor(delayMs = 1200) {
    this.db = new SqliteDb(delayMs);
  }

  load(_id: string, key: SnapshotKey) {
    return this.db.fetch(key.key);
  }

  async save(blob: Blob, _id: string, key: SnapshotKey) {
    await this.db.put(key.key, blob);
  }

  async remove(_id: string, key: SnapshotKey) {
    await this.db.drop(key.key);
  }

  /** Gallery-only: seeds a row directly, standing in for "a previous session already synced this". */
  seed(key: string, blob: Blob) {
    return this.db.put(key, blob);
  }
}
