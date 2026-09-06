import { get, set, del, keys as idbKeys, getMany } from 'idb-keyval';
import type { SnapshotService } from './snapshot-service';

const IDB_PREFIX = 'snapshot:';

/**
 * Everything a storage needs to key a snapshot, handed over as one object so
 * no storage ever has to re-derive (or strip) a prefix the service already
 * knows.
 */
export interface SnapshotKey {
  /** Bare id, exactly as the caller passed it to `capture()`/`get()`. */
  id: string;
  /** Variant, if the call carried one (e.g. a theme). */
  variant?: string;
  /** Fully-qualified storage key: `keyPrefix + id [+ '@' + variant]`. Stable, safe to use verbatim. */
  key: string;
}

export interface SnapshotStorage {
  /** Persists `blob` and returns a URL/dataURL that can be displayed right away. */
  save(blob: Blob, key: SnapshotKey): Promise<string>;
  load(key: SnapshotKey): Promise<string | null>;
  remove(key: SnapshotKey): Promise<void>;

  /**
   * Optional batch read. When present, a `<snapshot-nav-list>` uses it once per
   * `items` change instead of one `load()` per row. Resolve a `Map` keyed by
   * `SnapshotKey.key` (the fully-qualified key), with `null` for a miss.
   */
  loadMany?(keys: SnapshotKey[]): Promise<Map<string, string | null>>;
  /**
   * Every key this storage holds — enables `SnapshotService.prune()`. `id` and
   * `variant` are best-effort: a storage that can't tell a `keyPrefix` from an
   * id may leave them as the raw remainder, since `prune()` re-derives them
   * from `key` itself.
   */
  keys?(): Promise<SnapshotKey[]>;
  /**
   * Called once from the `SnapshotService` constructor, so a storage that
   * resolves fresher data asynchronously can `publish()` it without the
   * consumer having to wire the two together by hand.
   */
  attach?(service: SnapshotService): void;
}

/**
 * Default storage: browser-local IndexedDB. Does NOT sync across devices.
 *
 * Blobs are stored natively (IndexedDB supports them directly) instead of
 * base64-encoding into a data URL — that would cost ~33% extra storage and
 * an encode/decode pass on every save/render. Displayable URLs are minted
 * via `URL.createObjectURL`, cached per key so a re-capture of the same key
 * revokes its old URL instead of leaking one per capture.
 */
export class IndexedDbSnapshotStorage implements SnapshotStorage {
  private objectUrls = new Map<string, string>();
  private service?: SnapshotService;

  attach(service: SnapshotService) {
    this.service = service;
  }

  async save(blob: Blob, key: SnapshotKey) {
    await set(IDB_PREFIX + key.key, blob);
    return this.mintObjectUrl(key.key, blob);
  }

  async load(key: SnapshotKey) {
    const cached = this.objectUrls.get(key.key);
    if (cached) return cached;
    const blob = await get<Blob>(IDB_PREFIX + key.key);
    return blob ? this.mintObjectUrl(key.key, blob) : null;
  }

  async remove(key: SnapshotKey) {
    this.revoke(key.key);
    await del(IDB_PREFIX + key.key);
  }

  /** One IndexedDB transaction for the whole list instead of one per row. */
  async loadMany(requested: SnapshotKey[]) {
    const result = new Map<string, string | null>();
    const missing: SnapshotKey[] = [];
    for (const key of requested) {
      const cached = this.objectUrls.get(key.key);
      if (cached) result.set(key.key, cached);
      else missing.push(key);
    }
    if (missing.length > 0) {
      const blobs = await getMany<Blob | undefined>(missing.map((key) => IDB_PREFIX + key.key));
      missing.forEach((key, i) => {
        const blob = blobs[i];
        result.set(key.key, blob ? this.mintObjectUrl(key.key, blob) : null);
      });
    }
    return result;
  }

  async keys() {
    const stored = await idbKeys<string>();
    return stored
      .filter((k): k is string => typeof k === 'string' && k.startsWith(IDB_PREFIX))
      .map((k) => {
        const key = k.slice(IDB_PREFIX.length);
        // Once attached, the service can split the key properly (it owns both
        // the keyPrefix and the '@variant' convention); standalone, the raw
        // remainder is the honest answer.
        return this.service?.parseKey(key) ?? { id: key, key };
      });
  }

  private mintObjectUrl(key: string, blob: Blob) {
    this.revoke(key);
    const url = URL.createObjectURL(blob);
    this.objectUrls.set(key, url);
    return url;
  }

  private revoke(key: string) {
    const existing = this.objectUrls.get(key);
    if (existing) {
      URL.revokeObjectURL(existing);
      this.objectUrls.delete(key);
    }
  }
}
