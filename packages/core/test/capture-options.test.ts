// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeFit } from '../src/snapshot-service';
import type { SnapshotKey, SnapshotStorage } from '../src/snapshot-storage';

class MemoryStorage implements SnapshotStorage {
  blobs = new Map<string, Blob>();
  async save(blob: Blob, key: SnapshotKey) {
    this.blobs.set(key.key, blob);
    return `local:${key.key}`;
  }
  async load(key: SnapshotKey) {
    return this.blobs.has(key.key) ? `local:${key.key}` : null;
  }
  async remove(key: SnapshotKey) {
    this.blobs.delete(key.key);
  }
}

describe('computeFit', () => {
  it('cover: scales to fill the wider axis, centers the crop on the axis that overflows', () => {
    // 100x100 into 200x50 (4:1) — cover has to scale by the width ratio (2x)
    // to fill horizontally; that also makes the clone 200 tall against a
    // 50-tall frame, so the vertical crop is centered (75 off each side).
    const { scale, offsetX, offsetY } = computeFit({ width: 100, height: 100 }, { width: 200, height: 50 }, 'cover');
    expect(scale).toBe(2);
    expect(offsetX).toBe(0);
    expect(offsetY).toBe(75);
  });

  it('contain: downscales large content to fit inside, no negative offsets', () => {
    // 400x100 into 100x100 — contain scales by the smaller ratio (0.25) so
    // nothing is cropped; the 100-tall frame is left with 37.5px of
    // letterboxing on each side instead.
    const { scale, offsetX, offsetY } = computeFit({ width: 400, height: 100 }, { width: 100, height: 100 }, 'contain');
    expect(scale).toBe(0.25);
    expect(offsetX).toBe(0);
    expect(offsetY).toBe(-37.5);
  });

  it('exact match scales 1:1 with zero offset either way', () => {
    expect(computeFit({ width: 480, height: 240 }, { width: 480, height: 240 }, 'cover')).toEqual({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    expect(computeFit({ width: 480, height: 240 }, { width: 480, height: 240 }, 'contain')).toEqual({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

describe('SnapshotService.capture reliability options', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('html2canvas');
    vi.doUnmock('../src/neutralize-oklch');
    vi.resetModules();
  });

  async function setup() {
    const toBlob = vi.fn((cb: (b: Blob | null) => void) => cb(new Blob(['x'])));
    const html2canvasMock = vi.fn(async (_el: HTMLElement, _opts: Record<string, unknown>) => ({ toBlob }) as unknown as HTMLCanvasElement);
    vi.doMock('html2canvas', () => ({ default: html2canvasMock }));

    const restore = vi.fn();
    const neutralizeOklchColors = vi.fn(async () => restore);
    vi.doMock('../src/neutralize-oklch', () => ({ neutralizeOklchColors }));

    const { SnapshotService } = await import('../src/snapshot-service');
    const service = new SnapshotService({ storage: new MemoryStorage(), keyPrefix: 'opt:' });
    const el = document.createElement('div');
    document.body.appendChild(el);

    return { service, el, html2canvasMock, neutralizeOklchColors, restore };
  }

  it('leaves color-neutralizing off unless asked for', async () => {
    const { service, el, neutralizeOklchColors } = await setup();

    await service.capture(el, '1');

    expect(neutralizeOklchColors).not.toHaveBeenCalled();
  });

  it('neutralizes colors on the document root and restores after, when asked', async () => {
    const { service, el, neutralizeOklchColors, restore } = await setup();

    await service.capture(el, '1', { neutralizeColors: true });

    expect(neutralizeOklchColors).toHaveBeenCalledWith(document.documentElement);
    expect(restore).toHaveBeenCalledOnce();
  });

  it('builds an off-screen fit frame and hands that to html2canvas instead of el, then removes it', async () => {
    const { service, el, html2canvasMock } = await setup();
    Object.defineProperty(el, 'scrollWidth', { value: 100, configurable: true });
    Object.defineProperty(el, 'scrollHeight', { value: 100, configurable: true });

    await service.capture(el, '1', { width: 200, height: 50, fit: 'cover', background: 'red' });

    expect(html2canvasMock).toHaveBeenCalledOnce();
    const [target, opts] = html2canvasMock.mock.calls[0];
    expect(target).not.toBe(el);
    expect((target as HTMLElement).style.width).toBe('200px');
    expect((target as HTMLElement).style.height).toBe('50px');
    expect((target as HTMLElement).style.background).toBe('red');
    // contentCrop defaults to off once `fit` is set — the frame IS the exact
    // requested size already, so cropping to it is a no-op width/height, not
    // a real getContentBounds() crop.
    expect(opts).toMatchObject({ x: 0, y: 0, width: 200, height: 50 });
    expect((target as HTMLElement).isConnected).toBe(false);
  });
});
