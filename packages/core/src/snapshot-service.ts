import type { EncodeOptions } from './encode';
import { encodeSnapshot } from './encode';
import { SnapshotDetachedElementError, SnapshotRenderError, SnapshotTaintedCanvasError } from './errors';
import type { SnapshotKey, SnapshotStorage } from './snapshot-storage';
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
  /** Re-encode applied to every capture before it's stored. Defaults to none (the raw html2canvas PNG). */
  encode?: EncodeOptions;
  /**
   * Escape hatch for an existing store whose keys don't follow
   * `keyPrefix + id [+ '@' + variant]` — return the key to use. Note that
   * `parseKey()` (and therefore `prune()`) can't reverse a custom shape.
   */
  keyFor?: (key: SnapshotKey) => string;
}

/** `url` is null when the id was removed (or invalidated) rather than (re)captured. */
type Listener = (id: string, url: string | null, variant?: string) => void;

export interface VariantOptions {
  /**
   * A second dimension on the id — a theme, a density, a locale. Stored under
   * its own key, so `get(id, { variant: 'dark' })` never returns the light one.
   */
  variant?: string;
}

export interface CaptureOptions extends VariantOptions {
  /** Per-call override of the instance `scale`. */
  scale?: number;
  /** Per-call override of the instance `encode`. */
  encode?: EncodeOptions;
}

const CONTENT_PADDING = 16;
const VARIANT_SEPARATOR = '@';

// Tracks keyPrefixes already claimed by a live SnapshotService instance, so
// two instances that both forget to set one (or pick the same one) get a
// loud warning instead of silently colliding on the same broadcast channel
// and storage keys. Entries are dropped on close(), so a hot-reload that
// re-instantiates a closed service doesn't warn.
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
  private encode?: EncodeOptions;
  private keyFor?: (key: SnapshotKey) => string;
  /** Absent under Node/SSR (or any environment without BroadcastChannel) — same-tab notification still works. */
  private channel?: BroadcastChannel;
  private listeners = new Set<Listener>();
  /** In-flight captures, keyed by storage key, so two callers racing on the same view do one render. */
  private capturing = new Map<string, Promise<string>>();

  constructor(config: SnapshotServiceConfig = {}) {
    this.storage = config.storage ?? new IndexedDbSnapshotStorage();
    this.scale = config.scale ?? 0.4;
    this.keyPrefix = config.keyPrefix ?? '';
    this.encode = config.encode;
    this.keyFor = config.keyFor;
    if (activeKeyPrefixes.has(this.keyPrefix)) {
      console.warn(
        `SnapshotService: another instance already uses keyPrefix "${this.keyPrefix}" — ` +
          'their storage keys and cross-tab notifications will collide. Give each instance its own keyPrefix.',
      );
    }
    activeKeyPrefixes.add(this.keyPrefix);
    if (typeof BroadcastChannel === 'function') {
      this.channel = new BroadcastChannel(`nav-snapshots:${this.keyPrefix}`);
      this.channel.onmessage = (e: MessageEvent<{ id: string; url: string | null; variant?: string }>) => {
        const { id, url, variant } = e.data;
        this.listeners.forEach((l) => l(id, url, variant));
      };
    }
    this.storage.attach?.(this);
  }

  /**
   * The fully-qualified storage key for an id (+ variant) under this instance.
   * `id`/`variant` are `encodeURIComponent`-escaped before joining, so a `@`
   * (or any other character) inside either can never be mistaken for the
   * separator itself — without escaping, `id: 'a@b'` and `id: 'a', variant: 'b'`
   * would otherwise land on the exact same key.
   */
  keyOf(id: string, opts: VariantOptions = {}): SnapshotKey {
    const base =
      opts.variant === undefined || opts.variant === ''
        ? `${this.keyPrefix}${encodeURIComponent(id)}`
        : `${this.keyPrefix}${encodeURIComponent(id)}${VARIANT_SEPARATOR}${encodeURIComponent(opts.variant)}`;
    const key: SnapshotKey = { id, key: base };
    if (opts.variant) key.variant = opts.variant;
    if (this.keyFor) key.key = this.keyFor(key);
    return key;
  }

  /**
   * Inverse of `keyOf()` for the default key shape — splits a stored key back
   * into `{ id, variant }`. Returns `null` for a key belonging to a different
   * `keyPrefix`, or for any key when a custom `keyFor` is configured (a custom
   * shape isn't reversible).
   */
  parseKey(key: string): SnapshotKey | null {
    if (this.keyFor) return null;
    if (!key.startsWith(this.keyPrefix)) return null;
    const rest = key.slice(this.keyPrefix.length);
    // Safe to split on the first raw '@': encodeURIComponent never emits one,
    // so a '@' here can only be the separator this class itself inserted.
    const at = rest.indexOf(VARIANT_SEPARATOR);
    if (at < 0) return { id: decodeURIComponent(rest), key };
    return { id: decodeURIComponent(rest.slice(0, at)), variant: decodeURIComponent(rest.slice(at + 1)), key };
  }

  /**
   * Capture works on any element — a snapshot-nav-list item is one convention,
   * not a requirement. Concurrent calls for the same id/variant share one
   * render instead of racing two.
   */
  async capture(el: HTMLElement, id: string, opts: CaptureOptions = {}): Promise<string> {
    // Declared `async` on purpose: `keyOf()` can throw synchronously (a
    // caller-supplied `keyFor` is free to), and without `async` that throw
    // would escape as a synchronous exception instead of a rejected promise,
    // bypassing a caller's chained `.catch()`.
    const key = this.keyOf(id, opts);
    const inFlight = this.capturing.get(key.key);
    if (inFlight) return inFlight;
    const run = this.runCapture(el, key, opts).finally(() => this.capturing.delete(key.key));
    this.capturing.set(key.key, run);
    return run;
  }

  private async runCapture(el: HTMLElement, key: SnapshotKey, opts: CaptureOptions) {
    // A detached element renders as an empty (or, under html2canvas, a failed)
    // clone — reject with something the caller can recognise instead of
    // storing a blank thumbnail over a good one.
    if (!el.isConnected) throw new SnapshotDetachedElementError(key.id);

    const crop = getContentBounds(el);
    // Imported on demand so `import '@anton-gustafsson/snapshot-core'` doesn't
    // pull a DOM-only dependency into a Node/SSR/Jest process that only wants
    // the types or a storage.
    const { default: html2canvas } = await import('html2canvas');
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(el, {
        scale: opts.scale ?? this.scale,
        logging: false,
        useCORS: true,
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height,
      });
    } catch (err) {
      // errors.ts documents every rejection from this library as a SnapshotError.
      throw new SnapshotRenderError(key.id, err);
    }
    const raw = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new SnapshotTaintedCanvasError(key.id))), 'image/png'),
    );
    const encode = opts.encode ?? this.encode;
    const blob = encode ? await encodeSnapshot(raw, encode) : raw;
    const url = await this.storage.save(blob, key);
    this.notify(key.id, url, key.variant);
    return url;
  }

  get(id: string, opts: VariantOptions = {}) {
    return this.storage.load(this.keyOf(id, opts));
  }

  /**
   * Batch read, keyed by bare id. Uses the storage's `loadMany()` when it has
   * one (a single query/round-trip for a whole list) and falls back to parallel
   * `load()`s when it doesn't.
   */
  async getMany(ids: string[], opts: VariantOptions = {}): Promise<Map<string, string | null>> {
    const keys = ids.map((id) => this.keyOf(id, opts));
    const byId = new Map<string, string | null>();
    if (this.storage.loadMany) {
      const byKey = await this.storage.loadMany(keys);
      for (const key of keys) byId.set(key.id, byKey.get(key.key) ?? null);
      return byId;
    }
    // allSettled, not all: one item's rejection (e.g. a flaky read for one row
    // of a ten-row list) shouldn't fail every other id's already-successful load.
    const results = await Promise.allSettled(keys.map((key) => this.storage.load(key)));
    keys.forEach((key, i) => {
      const result = results[i];
      byId.set(key.id, result.status === 'fulfilled' ? result.value : null);
    });
    return byId;
  }

  /** Deletes a stored snapshot and notifies subscribers (this tab and others) that `id` is gone. */
  async remove(id: string, opts: VariantOptions = {}) {
    const key = this.keyOf(id, opts);
    await this.storage.remove(key);
    this.notify(id, null, key.variant);
  }

  /**
   * Deletes every stored snapshot (all variants) whose id isn't in `keepIds`,
   * so thumbnails don't outlive the entities they belong to. Requires a storage
   * that implements `keys()`; returns the number of snapshots removed.
   */
  async prune(keepIds: Iterable<string>): Promise<number> {
    if (!this.storage.keys) {
      console.warn('SnapshotService: prune() needs a storage that implements keys() — nothing was removed.');
      return 0;
    }
    if (this.keyFor) {
      console.warn(
        'SnapshotService: prune() can\'t reverse a custom keyFor — parseKey() has no way to recover each ' +
          'entry\'s id, so every stored key is skipped. Nothing was removed.',
      );
      return 0;
    }
    const keep = new Set(keepIds);
    const stored = await this.storage.keys();
    let removed = 0;
    for (const entry of stored) {
      const parsed = this.parseKey(entry.key);
      // Not ours (different keyPrefix, or an unreversible custom shape) — leave it alone.
      if (!parsed || keep.has(parsed.id)) continue;
      await this.storage.remove(parsed);
      this.notify(parsed.id, null, parsed.variant);
      removed++;
    }
    return removed;
  }

  /**
   * Warms the storage for a list of ids ahead of render (one `loadMany()` where
   * the storage supports it) and publishes whatever it finds, so any mounted
   * `<snapshot-nav-list>` paints from the first frame instead of spinning.
   */
  async prefetch(ids: string[], opts: VariantOptions = {}) {
    const urls = await this.getMany(ids, opts);
    for (const [id, url] of urls) {
      if (url) this.notify(id, url, opts.variant);
    }
  }

  /**
   * Announces a URL for `id` to subscribers (this tab and others) without
   * touching storage. For a storage layer that resolves a fresher value
   * asynchronously after `get()` already returned a cached one — e.g. a fast
   * local cache in front of a slower authoritative database — call this once
   * the slow read settles so any mounted <snapshot-nav-list> updates live.
   */
  publish(id: string, url: string, opts: VariantOptions = {}) {
    this.notify(id, url, opts.variant);
  }

  /**
   * Tells subscribers to drop their locally cached thumbnail for `id` and
   * treat it as not-yet-loaded — without deleting anything from storage.
   * Unlike `remove()`, the data is still there; the next `get()` will fetch
   * it again. Useful when the underlying data changed out from under the
   * cache (or, for a demo, to replay a loading state on demand).
   */
  invalidate(id: string, opts: VariantOptions = {}) {
    this.notify(id, null, opts.variant);
  }

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  /** Releases the cross-tab BroadcastChannel. Call when this instance (a non-default, namespaced one) is no longer needed. */
  close() {
    this.channel?.close();
    this.listeners.clear();
    activeKeyPrefixes.delete(this.keyPrefix);
  }

  // BroadcastChannel never delivers a message back to its own sender, so
  // same-tab listeners have to be notified directly alongside the cross-tab
  // post — kept as one method so `capture()` and `remove()` can't drift.
  private notify(id: string, url: string | null, variant?: string) {
    this.channel?.postMessage({ id, url, variant });
    this.listeners.forEach((l) => l(id, url, variant));
  }
}

let defaultService: SnapshotService | undefined;

/**
 * The shared IndexedDB-backed instance, created on first call — so importing
 * this package never opens a BroadcastChannel or an IndexedDB connection an
 * app that brings its own `SnapshotService` would never use.
 */
export function getDefaultSnapshotService(): SnapshotService {
  return (defaultService ??= new SnapshotService());
}

/**
 * @deprecated Use `getDefaultSnapshotService()`. A lazy stand-in for the
 * default instance: it forwards every access to the real service, constructing
 * it on first touch rather than at import time.
 */
export const snapshotService: SnapshotService = new Proxy({} as SnapshotService, {
  get(_target, prop) {
    const service = getDefaultSnapshotService() as unknown as Record<string | symbol, unknown>;
    // No `receiver` on purpose — forwarding the proxy as `this` to an accessor
    // would loop straight back through this handler.
    const value = Reflect.get(service, prop);
    return typeof value === 'function' ? value.bind(service) : value;
  },
  set(_target, prop, value) {
    return Reflect.set(getDefaultSnapshotService() as unknown as object, prop, value);
  },
  has(_target, prop) {
    return prop in (getDefaultSnapshotService() as unknown as object);
  },
  getPrototypeOf() {
    return SnapshotService.prototype;
  },
});
