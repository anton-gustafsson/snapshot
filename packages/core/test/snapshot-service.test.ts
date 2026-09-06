import { describe, expect, it, vi } from 'vitest';
import { SnapshotService } from '../src/snapshot-service';
import type { SnapshotKey, SnapshotStorage } from '../src/snapshot-storage';

class MemoryStorage implements SnapshotStorage {
  blobs = new Map<string, Blob>();
  loads: string[] = [];
  attached?: SnapshotService;

  attach(service: SnapshotService) {
    this.attached = service;
  }
  async save(blob: Blob, key: SnapshotKey) {
    this.blobs.set(key.key, blob);
    return `local:${key.key}`;
  }
  async load(key: SnapshotKey) {
    this.loads.push(key.key);
    return this.blobs.has(key.key) ? `local:${key.key}` : null;
  }
  async remove(key: SnapshotKey) {
    this.blobs.delete(key.key);
  }
  async keys() {
    return [...this.blobs.keys()].map((key) => ({ id: key, key }));
  }
}

/** A storage with a batch read, to prove the service prefers it. */
class BatchStorage extends MemoryStorage {
  batches = 0;
  async loadMany(keys: SnapshotKey[]) {
    this.batches++;
    return new Map(keys.map((key) => [key.key, this.blobs.has(key.key) ? `local:${key.key}` : null] as const));
  }
}

describe('SnapshotService keys', () => {
  it('folds a variant into the key and back out again', () => {
    const service = new SnapshotService({ storage: new MemoryStorage(), keyPrefix: 'keys:' });

    expect(service.keyOf('7')).toEqual({ id: '7', key: 'keys:7' });
    expect(service.keyOf('7', { variant: 'dark' })).toEqual({ id: '7', variant: 'dark', key: 'keys:7@dark' });
    expect(service.parseKey('keys:7@dark')).toEqual({ id: '7', variant: 'dark', key: 'keys:7@dark' });
    expect(service.parseKey('keys:7')).toEqual({ id: '7', key: 'keys:7' });
    // Another instance's namespace — not ours to touch.
    expect(service.parseKey('other:7')).toBeNull();
  });

  it('honours a custom keyFor, and stops claiming keys are parseable', () => {
    const storage = new MemoryStorage();
    const service = new SnapshotService({
      storage,
      keyPrefix: 'custom:',
      keyFor: ({ id, variant }) => `custom:${id}:${variant ?? 'light'}`,
    });

    expect(service.keyOf('7', { variant: 'dark' }).key).toBe('custom:7:dark');
    expect(service.parseKey('custom:7:dark')).toBeNull();
  });

  it('attaches itself to its storage', () => {
    const storage = new MemoryStorage();
    const service = new SnapshotService({ storage, keyPrefix: 'attach:' });
    expect(storage.attached).toBe(service);
  });
});

describe('SnapshotService reads', () => {
  it('reads a variant separately from the default', async () => {
    const storage = new MemoryStorage();
    const service = new SnapshotService({ storage, keyPrefix: 'r:' });
    await storage.save(new Blob(['light']), service.keyOf('7'));

    await expect(service.get('7')).resolves.toBe('local:r:7');
    await expect(service.get('7', { variant: 'dark' })).resolves.toBeNull();
  });

  it('uses the storage batch read when there is one, keyed by bare id', async () => {
    const storage = new BatchStorage();
    const service = new SnapshotService({ storage, keyPrefix: 'b:' });
    await storage.save(new Blob(['a']), service.keyOf('1', { variant: 'dark' }));

    const urls = await service.getMany(['1', '2'], { variant: 'dark' });

    expect(storage.batches).toBe(1);
    expect(storage.loads).toEqual([]);
    expect([...urls]).toEqual([
      ['1', 'local:b:1@dark'],
      ['2', null],
    ]);
  });

  it('falls back to parallel loads without loadMany', async () => {
    const storage = new MemoryStorage();
    const service = new SnapshotService({ storage, keyPrefix: 'f:' });

    await service.getMany(['1', '2']);
    expect(storage.loads).toEqual(['f:1', 'f:2']);
  });

  it('publishes what prefetch finds so a mounted list paints straight away', async () => {
    const storage = new BatchStorage();
    const service = new SnapshotService({ storage, keyPrefix: 'p:' });
    await storage.save(new Blob(['a']), service.keyOf('1'));
    const seen: Array<[string, string | null, string | undefined]> = [];
    service.subscribe((id, url, variant) => seen.push([id, url, variant]));

    await service.prefetch(['1', '2']);

    expect(seen).toEqual([['1', 'local:p:1', undefined]]);
  });
});

describe('SnapshotService.prune', () => {
  it('removes every variant of an id that is gone, and leaves other namespaces alone', async () => {
    const storage = new MemoryStorage();
    const service = new SnapshotService({ storage, keyPrefix: 'app:' });
    await storage.save(new Blob(['a']), service.keyOf('1'));
    await storage.save(new Blob(['a']), service.keyOf('1', { variant: 'dark' }));
    await storage.save(new Blob(['a']), service.keyOf('2'));
    await storage.save(new Blob(['a']), { id: '9', key: 'other:9' });

    const removed = await service.prune(['1']);

    expect(removed).toBe(1);
    expect([...storage.blobs.keys()]).toEqual(['app:1', 'app:1@dark', 'other:9']);
  });

  it('warns instead of throwing on a storage without keys()', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // No keys() at all — the capability is optional on the interface.
    const storage: SnapshotStorage = {
      save: async (_blob, key) => `local:${key.key}`,
      load: async () => null,
      remove: async () => {},
    };
    const service = new SnapshotService({ storage, keyPrefix: 'nokeys:' });

    await expect(service.prune(['1'])).resolves.toBe(0);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
