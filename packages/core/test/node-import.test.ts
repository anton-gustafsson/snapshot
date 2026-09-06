import { describe, expect, it } from 'vitest';

/**
 * Vitest's default `node` environment has no `document`/`customElements`, so
 * this is the SSR/Jest smoke test: importing the package must not touch the
 * DOM, open a BroadcastChannel, or connect to IndexedDB. Only `capture()`
 * needs a browser, and html2canvas is imported on demand there.
 */
describe('importing the package outside a browser', () => {
  it('does not throw, and does not construct the default service', async () => {
    const core = await import('../src/index');

    expect(typeof core.SnapshotService).toBe('function');
    expect(typeof core.getDefaultSnapshotService).toBe('function');
    expect(typeof core.CachedSnapshotStorage).toBe('function');
    expect(typeof core.encodeSnapshot).toBe('function');
    // The element is only defined where a registry exists — under Node that's
    // lit's SSR dom shim, and it must not have needed a real document.
    expect(typeof globalThis.document).toBe('undefined');
  });

  it('leaves encodeSnapshot a no-op where OffscreenCanvas is missing', async () => {
    const { encodeSnapshot } = await import('../src/encode');
    const blob = new Blob(['x']);
    await expect(encodeSnapshot(blob, { type: 'image/webp' })).resolves.toBe(blob);
  });
});
