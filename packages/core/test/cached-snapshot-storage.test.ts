import { describe, expect, it, vi } from 'vitest';
import { CachedSnapshotStorage } from '../src/cached-snapshot-storage';
import { SnapshotService } from '../src/snapshot-service';
import type { RemoteSnapshotStorage } from '../src/cached-snapshot-storage';
import type { SnapshotKey, SnapshotStorage } from '../src/snapshot-storage';

/** In-memory stand-in for IndexedDbSnapshotStorage — no browser APIs involved. */
class MemoryStorage implements SnapshotStorage {
  blobs = new Map<string, Blob>();
  saves = 0;

  async save(blob: Blob, key: SnapshotKey) {
    this.saves++;
    this.blobs.set(key.key, blob);
    return `local:${key.key}:${blob.size}`;
  }
  async load(key: SnapshotKey) {
    const blob = this.blobs.get(key.key);
    return blob ? `local:${key.key}:${blob.size}` : null;
  }
  async remove(key: SnapshotKey) {
    this.blobs.delete(key.key);
  }
  async keys() {
    return [...this.blobs.keys()].map((key) => ({ id: key, key }));
  }
}

function blobOf(size: number) {
  return new Blob(['x'.repeat(size)]);
}

/** Lets a test settle the microtasks a fire-and-forget upload/revalidation runs in. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(remote: RemoteSnapshotStorage, options: { keyPrefix?: string } = {}) {
  const local = new MemoryStorage();
  const storage = new CachedSnapshotStorage({ remote, local });
  const service = new SnapshotService({ storage, keyPrefix: options.keyPrefix ?? `test-${Math.random()}:` });
  return { local, storage, service };
}

describe('CachedSnapshotStorage', () => {
  it('returns the local hit immediately and publishes the revalidated remote copy', async () => {
    const remote: RemoteSnapshotStorage = {
      load: async () => blobOf(20),
      save: async () => {},
    };
    const { local, service } = setup(remote);
    await local.save(blobOf(10), service.keyOf('a'));

    const published: Array<[string, string | null]> = [];
    service.subscribe((id, url) => published.push([id, url]));

    // The cached copy comes back without waiting on the remote read.
    await expect(service.get('a')).resolves.toBe(`local:${service.keyOf('a').key}:10`);

    await flush();
    expect(published).toEqual([['a', `local:${service.keyOf('a').key}:20`]]);
  });

  it('awaits the remote on a cold miss and returns its url directly', async () => {
    const remote: RemoteSnapshotStorage = {
      load: async () => blobOf(30),
      save: async () => {},
    };
    const { service } = setup(remote);
    const published: string[] = [];
    service.subscribe((id) => published.push(id));

    await expect(service.get('a')).resolves.toBe(`local:${service.keyOf('a').key}:30`);
    // Returned directly, not announced — nothing is mounted waiting for it yet.
    expect(published).toEqual([]);
  });

  it('does not evict a local capture when the remote has nothing (404)', async () => {
    const remote: RemoteSnapshotStorage = {
      load: async () => null,
      save: async () => {},
    };
    const { local, service } = setup(remote);
    await local.save(blobOf(10), service.keyOf('a'));
    const published: unknown[] = [];
    service.subscribe((id, url) => published.push([id, url]));

    await expect(service.get('a')).resolves.toBe(`local:${service.keyOf('a').key}:10`);
    await flush();

    expect(local.blobs.has(service.keyOf('a').key)).toBe(true);
    expect(published).toEqual([]);
  });

  it('does not evict a local capture when the remote read rejects, and reports it once', async () => {
    const onError = vi.fn();
    const remote: RemoteSnapshotStorage = {
      load: async () => {
        throw new Error('offline');
      },
      save: async () => {},
    };
    const local = new MemoryStorage();
    const storage = new CachedSnapshotStorage({ remote, local, onError });
    const service = new SnapshotService({ storage, keyPrefix: 'reject:' });
    await local.save(blobOf(10), service.keyOf('a'));

    await expect(service.get('a')).resolves.toBe('local:reject:a:10');
    await flush();

    expect(local.blobs.has('reject:a')).toBe(true);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][2]).toBe('load');
  });

  it('does not make the caller wait for the upload', async () => {
    let resolveUpload: (() => void) | undefined;
    const remote: RemoteSnapshotStorage = {
      load: async () => null,
      save: () => new Promise<void>((resolve) => (resolveUpload = resolve)),
    };
    const { storage, service } = setup(remote);

    const url = await storage.save(blobOf(10), service.keyOf('a'));
    expect(url).toBe(`local:${service.keyOf('a').key}:10`);
    // The PUT is still hanging — the save resolved anyway.
    expect(resolveUpload).toBeTypeOf('function');
    resolveUpload?.();
  });

  it('skips an upload above maxBytes and reports it', async () => {
    const onError = vi.fn();
    const save = vi.fn(async () => {});
    const storage = new CachedSnapshotStorage({
      remote: { load: async () => null, save },
      local: new MemoryStorage(),
      maxBytes: 16,
      onError,
    });
    const service = new SnapshotService({ storage, keyPrefix: 'cap:' });

    await storage.save(blobOf(64), service.keyOf('a'));
    await flush();

    expect(save).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][2]).toBe('save');
  });

  it('revalidates once per key even when a whole list asks at the same time', async () => {
    const load = vi.fn(async () => blobOf(10));
    const local = new MemoryStorage();
    const storage = new CachedSnapshotStorage({ remote: { load, save: async () => {} }, local });
    const service = new SnapshotService({ storage, keyPrefix: 'batch:' });
    await local.save(blobOf(10), service.keyOf('a'));

    await Promise.all([service.get('a'), service.get('a'), service.get('a')]);
    await flush();

    expect(load).toHaveBeenCalledTimes(1);
    // Two writes: the test's own seed, then the first revalidation adopting
    // the remote copy (whose size this instance hadn't recorded yet).
    expect(local.saves).toBe(2);

    // Now the size is known, so an identical remote copy is a no-op — a warm
    // list doesn't rewrite IndexedDB or swap every <img> src on every visit.
    await service.get('a');
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(local.saves).toBe(2);
  });
});
