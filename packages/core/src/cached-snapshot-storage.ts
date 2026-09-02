import type { EncodeOptions } from './encode';
import { encodeSnapshot } from './encode';
import { SnapshotTooLargeError } from './errors';
import type { SnapshotService } from './snapshot-service';
import type { SnapshotKey, SnapshotStorage } from './snapshot-storage';
import { IndexedDbSnapshotStorage } from './snapshot-storage';

/**
 * The half of a server-backed storage only the consumer can write: the HTTP
 * calls themselves. Everything around them — the local cache, the
 * stale-while-revalidate order, the "a 404 must not evict my capture" rule —
 * is `CachedSnapshotStorage`'s job.
 */
export interface RemoteSnapshotStorage {
  /**
   * Resolve `null` for "nothing stored yet" — **including a 404**, which is the
   * normal answer for an entity nobody has captured. Reject only for real
   * failures (network down, 500, 403), which are reported through `onError`
   * and leave the local copy standing.
   */
  load(id: string, key: SnapshotKey): Promise<Blob | null>;
  save(blob: Blob, id: string, key: SnapshotKey): Promise<void>;
  remove?(id: string, key: SnapshotKey): Promise<void>;
}

export interface CachedSnapshotStorageOptions {
  remote: RemoteSnapshotStorage;
  /** Defaults to a fresh `IndexedDbSnapshotStorage`. */
  local?: SnapshotStorage;
  /** Re-encode applied to the *uploaded* copy only; the local cache keeps the full capture. */
  uploadEncode?: EncodeOptions;
  /** Skip the upload (and report a `SnapshotTooLargeError`) above this size. Mirrors a server-side cap. */
  maxBytes?: number;
  /**
   * Called for every swallowed failure instead of `console.warn`, so a consumer
   * can filter the routine ones (a 403 for a read-only user) from the real ones.
   */
  onError?(err: unknown, key: SnapshotKey, op: 'load' | 'save' | 'remove'): void;
}

/**
 * A local cache in front of a remote store — the shape every server-backed
 * consumer ends up needing.
 *
 * Load is stale-while-revalidate: the local hit paints immediately and the
 * remote read happens in the background, `publish()`ing through the attached
 * service if it turns up something new. Save writes locally first and fires the
 * upload without awaiting it, so a slow PUT can never delay a navigation.
 *
 * Freshness is delegated to the HTTP cache (`ETag` + `Cache-Control: no-cache`)
 * rather than any version bookkeeping here.
 */
export class CachedSnapshotStorage implements SnapshotStorage {
  private readonly remote: RemoteSnapshotStorage;
  private readonly local: SnapshotStorage;
  private readonly options: CachedSnapshotStorageOptions;
  private service?: SnapshotService;
  /**
   * Byte size of the copy currently cached per key. A revalidation that comes
   * back the same size is treated as unchanged, so a warm list doesn't rewrite
   * IndexedDB and swap every <img> src on every visit.
   */
  private cachedSizes = new Map<string, number>();
  /** In-flight revalidations, so N rows of the same key don't fan out N reads. */
  private revalidating = new Set<string>();
  /** Keys `remove()` has deleted, so a revalidation already in flight can't resurrect them when it resolves after. */
  private removedKeys = new Set<string>();
  /** Only defined when the wrapped local storage has one — keeps `SnapshotService.prune()`'s capability check honest. */
  readonly keys?: () => Promise<SnapshotKey[]>;

  constructor(options: CachedSnapshotStorageOptions) {
    this.options = options;
    this.remote = options.remote;
    this.local = options.local ?? new IndexedDbSnapshotStorage();
    if (this.local.keys) {
      const local = this.local;
      this.keys = () => local.keys!();
    }
  }

  attach(service: SnapshotService) {
    this.service = service;
    this.local.attach?.(service);
  }

  /** Local write is awaited (the caller needs a displayable URL); the upload is not. */
  async save(blob: Blob, key: SnapshotKey) {
    const url = await this.local.save(blob, key);
    this.cachedSizes.set(key.key, blob.size);
    this.removedKeys.delete(key.key);
    void this.upload(blob, key);
    return url;
  }

  async load(key: SnapshotKey) {
    const cached = await this.local.load(key);
    if (cached) {
      // A fresh instance (e.g. after a page reload) has an empty cachedSizes
      // even though the local copy is already on disk — without this, the
      // first revalidate() below has nothing to compare against and always
      // treats an unchanged remote copy as "changed".
      if (!this.cachedSizes.has(key.key)) await this.primeCachedSize(key, cached);
      void this.revalidate(key, true);
      return cached;
    }
    // Cold miss: nothing to paint yet, so the remote read is worth awaiting —
    // and its URL is returned directly rather than announced via publish().
    return this.fetchRemote(key);
  }

  async loadMany(keys: SnapshotKey[]) {
    const cached = this.local.loadMany
      ? await this.local.loadMany(keys)
      : new Map(await Promise.all(keys.map(async (key) => [key.key, await this.local.load(key)] as const)));

    const misses = keys.filter((key) => !cached.get(key.key));
    const fetched = await Promise.all(misses.map((key) => this.fetchRemote(key)));
    misses.forEach((key, i) => cached.set(key.key, fetched[i]));

    // Everything that came from the cache still gets revalidated, exactly as a
    // single load() would — primed first, for the same reason as load() above.
    const hits = keys.filter((key) => !misses.includes(key));
    await Promise.all(
      hits.map(async (key) => {
        const url = cached.get(key.key);
        if (url && !this.cachedSizes.has(key.key)) await this.primeCachedSize(key, url);
      }),
    );
    for (const key of hits) void this.revalidate(key, true);
    return cached;
  }

  async remove(key: SnapshotKey) {
    this.removedKeys.add(key.key);
    this.cachedSizes.delete(key.key);
    await this.local.remove(key);
    if (!this.remote.remove) return;
    try {
      await this.remote.remove(key.id, key);
    } catch (err) {
      this.report(err, key, 'remove');
      throw err;
    }
  }

  /** Best-effort: reads the cached blob back through its own URL to learn its size, without any storage needing a new method. */
  private async primeCachedSize(key: SnapshotKey, url: string) {
    if (typeof fetch !== 'function') return;
    try {
      const blob = await fetch(url).then((r) => r.blob());
      this.cachedSizes.set(key.key, blob.size);
    } catch {
      // A miss here just costs one extra revalidate() write, same as before this fix.
    }
  }

  private async upload(blob: Blob, key: SnapshotKey) {
    try {
      const payload = this.options.uploadEncode ? await encodeSnapshot(blob, this.options.uploadEncode) : blob;
      const { maxBytes } = this.options;
      if (maxBytes !== undefined && payload.size > maxBytes) {
        this.report(new SnapshotTooLargeError(payload.size, maxBytes), key, 'save');
        return;
      }
      await this.remote.save(payload, key.id, key);
    } catch (err) {
      this.report(err, key, 'save');
    }
  }

  /** Awaited path: resolve the remote copy, seed the cache, hand back the URL. */
  private async fetchRemote(key: SnapshotKey): Promise<string | null> {
    try {
      const blob = await this.remote.load(key.id, key);
      // null / empty is "nobody has captured this yet", not a failure.
      if (!blob || blob.size === 0) return null;
      const url = await this.local.save(blob, key);
      this.cachedSizes.set(key.key, blob.size);
      this.removedKeys.delete(key.key);
      return url;
    } catch (err) {
      this.report(err, key, 'load');
      return null;
    }
  }

  /** Background path: only touches anything when the remote copy actually differs. */
  private async revalidate(key: SnapshotKey, publish: boolean) {
    if (this.revalidating.has(key.key)) return;
    this.revalidating.add(key.key);
    try {
      const blob = await this.remote.load(key.id, key);
      // The load-bearing rule: a remote miss must NEVER evict a local capture.
      // Offline, 404, and "not synced yet" all land here.
      if (!blob || blob.size === 0) return;
      // remove() ran while this read was in flight — don't resurrect what the
      // caller just deleted.
      if (this.removedKeys.has(key.key)) return;
      if (this.cachedSizes.get(key.key) === blob.size) return;
      const url = await this.local.save(blob, key);
      this.cachedSizes.set(key.key, blob.size);
      if (publish) this.service?.publish(key.id, url, { variant: key.variant });
    } catch (err) {
      // A rejected read leaves the local copy in place — offline still works.
      this.report(err, key, 'load');
    } finally {
      this.revalidating.delete(key.key);
    }
  }

  private report(err: unknown, key: SnapshotKey, op: 'load' | 'save' | 'remove') {
    if (this.options.onError) this.options.onError(err, key, op);
    else console.warn(`CachedSnapshotStorage: ${op} failed for "${key.key}"`, err);
  }
}
