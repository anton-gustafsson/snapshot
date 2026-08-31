import html2canvas from 'html2canvas';
import type { SnapshotStorage } from './snapshot-storage';
import { IndexedDbSnapshotStorage } from './snapshot-storage';

export interface SnapshotServiceConfig {
  /** Provide your own backend-backed implementation to persist across devices. */
  storage?: SnapshotStorage;
  /** html2canvas render scale. Lower = smaller/faster thumbnails. */
  scale?: number;
  /**
   * Prepended to every id before it reaches storage (and to the cross-tab
   * broadcast channel name). Namespaces multiple SnapshotService instances —
   * or multiple apps on the same origin — sharing one storage backend so
   * their keys and live-update notifications can't collide.
   */
  keyPrefix?: string;
}

/** `url` is null when the id was removed rather than (re)captured. */
type Listener = (id: string, url: string | null) => void;

const CONTENT_PADDING = 16;

// Tracks keyPrefixes already claimed by a live SnapshotService instance, so
// two instances that both forget to set one (or pick the same one) get a
// loud warning instead of silently colliding on the same broadcast channel
// and storage keys.
const activeKeyPrefixes = new Set<string>();

/** So a container much bigger than its content (e.g. a full-page canvas with one small widget) doesn't capture as mostly empty space — crop to the actual children's bounding box, padded, instead of the whole element. */
function getContentBounds(el: HTMLElement) {
  const full = { x: 0, y: 0, width: el.clientWidth, height: el.clientHeight };
  // Ignore children that don't actually occupy visible space (display:none, or
  // otherwise zero-size) — otherwise a single hidden sibling collapses the
  // whole crop back to `full`, defeating the point of this function.
  const children = (Array.from(el.children) as HTMLElement[]).filter(
    (child) =>
      (child.offsetWidth > 0 || child.offsetHeight > 0) &&
      getComputedStyle(child).display !== 'none',
  );
  if (children.length === 0) return full;

  // el.clientWidth/clientHeight are content-box (border excluded), but
  // getBoundingClientRect() is border-box — offset by clientLeft/clientTop
  // (the border width) so child positions line up with `full`'s coordinate
  // space instead of drifting by the border width on a bordered container.
  const elRect = el.getBoundingClientRect();
  const originX = elRect.left + el.clientLeft;
  const originY = elRect.top + el.clientTop;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const child of children) {
    const r = child.getBoundingClientRect();
    minX = Math.min(minX, r.left - originX);
    minY = Math.min(minY, r.top - originY);
    maxX = Math.max(maxX, r.right - originX);
    maxY = Math.max(maxY, r.bottom - originY);
  }

  const x = Math.max(0, minX - CONTENT_PADDING);
  const y = Math.max(0, minY - CONTENT_PADDING);
  const width = Math.min(full.width - x, maxX - minX + CONTENT_PADDING * 2);
  const height = Math.min(full.height - y, maxY - minY + CONTENT_PADDING * 2);
  if (width <= 0 || height <= 0) return full;
  return { x, y, width, height };
}

export class SnapshotService {
  private storage: SnapshotStorage;
  private scale: number;
  private keyPrefix: string;
  private channel: BroadcastChannel;
  private listeners = new Set<Listener>();

  constructor(config: SnapshotServiceConfig = {}) {
    this.storage = config.storage ?? new IndexedDbSnapshotStorage();
    this.scale = config.scale ?? 0.4;
    this.keyPrefix = config.keyPrefix ?? '';
    if (activeKeyPrefixes.has(this.keyPrefix)) {
      console.warn(
        `SnapshotService: another instance already uses keyPrefix "${this.keyPrefix}" — ` +
          'their storage keys and cross-tab notifications will collide. Give each instance its own keyPrefix.',
      );
    }
    activeKeyPrefixes.add(this.keyPrefix);
    this.channel = new BroadcastChannel(`nav-snapshots:${this.keyPrefix}`);
    this.channel.onmessage = (e: MessageEvent<{ id: string; url: string | null }>) => {
      const { id, url } = e.data;
      this.listeners.forEach((l) => l(id, url));
    };
  }

  /** Capture works on any element — a snapshot-nav-list item is one convention, not a requirement. */
  async capture(el: HTMLElement, id: string) {
    const crop = getContentBounds(el);
    const canvas = await html2canvas(el, {
      scale: this.scale,
      logging: false,
      useCORS: true,
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
    });
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(
                new Error(
                  'SnapshotService: canvas.toBlob() returned null — the captured element likely contains tainted (cross-origin, no CORS headers) content, or has zero size.',
                ),
              ),
        'image/png',
      ),
    );
    const url = await this.storage.save(this.keyPrefix + id, blob);
    this.notify(id, url);
    return url;
  }

  get(id: string) {
    return this.storage.load(this.keyPrefix + id);
  }

  /** Deletes a stored snapshot and notifies subscribers (this tab and others) that `id` is gone. */
  async remove(id: string) {
    await this.storage.remove?.(this.keyPrefix + id);
    this.notify(id, null);
  }

  /**
   * Announces a URL for `id` to subscribers (this tab and others) without
   * touching storage. For a storage layer that resolves a fresher value
   * asynchronously after `get()` already returned a cached one — e.g. a fast
   * local cache in front of a slower authoritative database — call this once
   * the slow read settles so any mounted <snapshot-nav-list> updates live.
   */
  publish(id: string, url: string) {
    this.notify(id, url);
  }

  /**
   * Tells subscribers to drop their locally cached thumbnail for `id` and
   * treat it as not-yet-loaded — without deleting anything from storage.
   * Unlike `remove()`, the data is still there; the next `get()` will fetch
   * it again. Useful when the underlying data changed out from under the
   * cache (or, for a demo, to replay a loading state on demand).
   */
  invalidate(id: string) {
    this.notify(id, null);
  }

  subscribe(cb: Listener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Releases the cross-tab BroadcastChannel. Call when this instance (a non-default, namespaced one) is no longer needed. */
  close() {
    this.channel.close();
    this.listeners.clear();
    activeKeyPrefixes.delete(this.keyPrefix);
  }

  // BroadcastChannel never delivers a message back to its own sender, so
  // same-tab listeners have to be notified directly alongside the cross-tab
  // post — kept as one method so `capture()` and `remove()` can't drift.
  private notify(id: string, url: string | null) {
    this.channel.postMessage({ id, url });
    this.listeners.forEach((l) => l(id, url));
  }
}

/** Default singleton (IndexedDB-backed). Replace with your own SnapshotService({ storage }) if you need a real backend. */
export const snapshotService = new SnapshotService();
