# Changelog

Both packages (`@anton-gustafsson/snapshot-core`, `@anton-gustafsson/snapshot-angular`) share a
version. Pre-1.0, so breaking changes ship with a migration note instead of a deprecation cycle.

## Unreleased

### Added

- **`CaptureOptions.onclone`** — passed straight through to html2canvas: a hook into the cloned
  document right before it's rendered, for anything that needs to touch the clone specifically
  rather than the live element (html2canvas re-resolves styles on the clone, so a live-DOM mutation
  made just before `capture()` isn't guaranteed to still apply by render time).
- **`neutralizeOklchColors(root)`** — html2canvas can't parse `oklch()`/`oklab()`, which
  `getComputedStyle` now resolves a growing share of real-world CSS to (any app on a palette
  defined in OKLCH — Tailwind v4's own default colors included — hits this, regardless of how the
  color was originally authored). Walks a subtree and pins every resolved color as a plain inline
  `hsl()`, `!important`. Also neutralizes `transition`/`animation` first — writing a new color is
  itself a style change, so on a transitionable element it can trigger one, and a read straight
  after lands mid-transition (Chrome interpolates color transitions through oklab by default) rather
  than on the value just written; without this the symptom looks identical to the fix having done
  nothing at all. Returns a restore callback. `colorjs.io` is imported on demand, so a consumer that
  never calls this pays nothing for it in their initial bundle.
- **`waitForCanvasesToPaint(root, maxFrames?)`** — a `<canvas>`-based chart typically paints through
  its own `ResizeObserver`/`requestAnimationFrame` cycle, decoupled from any framework's change
  detection; `injectSnapshotCapture()`'s tick-plus-one-frame wait can still race a chart's own
  pending redraw, and html2canvas only ever copies whatever's currently in the canvas's pixel
  buffer — losing that race silently produces a capture with a blank rectangle where the chart
  should be, no error. Polls every canvas under `root` until each has non-transparent pixel data or
  `maxFrames` is exhausted. Best-effort by design: a canvas still blank after `maxFrames` is left as
  is rather than blocking navigation indefinitely.

## 0.4.0 — consumer-driven API pass

Implements `SNAPSHOT_PACKAGE_API_PROPOSAL.md` in one release: the storage seam, the capture
pipeline, the item model, and the Angular package. Roughly 250 lines of generic glue every
server-backed consumer was writing by hand now live in the library.

### Added

- **`CachedSnapshotStorage`** — a local IndexedDB cache in front of a `RemoteSnapshotStorage` you
  supply (two calls: `load`, `save`). Stale-while-revalidate reads, fire-and-forget uploads, and the
  three rules that are easy to get wrong: a remote `null`/404 never evicts a local capture, a
  rejected read never evicts either, and a save never waits for the upload. `uploadEncode`,
  `maxBytes` and `onError` cover the rest of what a real endpoint needs.
- **Variants** — every read/write takes `{ variant }` (a theme, a density, a locale), stored under
  its own key. `<snapshot-nav-list>` takes a matching `variant-key` attribute.
- **`encodeSnapshot()` + `EncodeOptions`** — WebP/JPEG/PNG re-encode and `maxEdge` downscale via
  `OffscreenCanvas`, wired into `SnapshotServiceConfig.encode` and per-call `CaptureOptions.encode`.
  Never throws: an unsupported browser or a failed encode returns the input blob.
- **`SnapshotService`**: `getMany()`, `prefetch()`, `prune(keepIds)`, `keyOf()`, `parseKey()`,
  per-key in-flight capture dedup, and a per-call `scale` override.
- **`SnapshotStorage`**: optional `loadMany()` (one round-trip per list — the nav list uses it),
  `keys()` (enables `prune()`), and `attach(service)` (a storage can `publish()` without the
  consumer wiring it up).
- **Typed errors** — `SnapshotError`, `SnapshotDetachedElementError`, `SnapshotTaintedCanvasError`,
  `SnapshotTooLargeError`. `capture()` rejects on a detached element instead of storing a blank.
- **`NavItem<T>`** — `data` for an arbitrary consumer payload and `editable` for per-row rights;
  `nav-select` / `nav-edit` now carry the whole item.
- **Component**: `scrollable` attribute + `--snapshot-nav-list-max-height`.
- **Angular**: `provideSnapshot()` + `SNAPSHOT_SERVICE`, `injectSnapshotCapture()`, core types
  re-exported from the entry point.
- **Tests** — Vitest in `packages/core` (`npm test -w packages/core`), covering the
  `CachedSnapshotStorage` behaviours above, key/variant round-tripping, batch reads, `prune()`, and a
  DOM-less import smoke test.
- **UI tests** — Cypress against the gallery app (`npm run test:e2e`): the capture round trip
  (including surviving a reload), the rendering contract, and `CachedSnapshotStorage` against a fake
  HTTP API with latency, a 404 and a 403.
- **Gallery**: a `/remote-storage` page (fake HTTP API with ~0.9s latency, a 404 and a 403) so the
  loading and revalidate states are visible.

### Changed (breaking)

| Before | After |
|---|---|
| `SnapshotStorage.save(id, blob)` | `save(blob, key: SnapshotKey)` |
| `SnapshotStorage.load(id)` | `load(key: SnapshotKey)` |
| `SnapshotStorage.remove?(id)` | `remove(key: SnapshotKey)` — no longer optional |
| `subscribe(cb)` returned `() => boolean` | returns `() => void`; `cb` gains a third `variant` arg |
| `nav-select` / `nav-edit` detail `{ id, route? }` | the whole `NavItem<T>` |
| Angular `@Input`/`@Output`/`ngOnChanges` | `input()` / `output()` / `viewChild.required()` |
| Angular peer `@angular/core >= 17` | `>= 19` |
| `variant` default `'icon-only'` | `'card'`; `'tile'` is the new name for `'icon-only'`, which still works as an alias |
| `capture()` hardcoded `image/png` at the instance `scale` | `capture(el, id, { scale, encode, variant })` |
| `export const snapshotService = new SnapshotService()` ran at import time | `getDefaultSnapshotService()` (lazy); `snapshotService` is a deprecated lazy stand-in |

Also: `html2canvas` is imported on demand inside `capture()`, so importing the package under
Node/SSR/Jest no longer pulls in a DOM-only dependency (and the browser bundle defers ~200 kB until
the first capture). `BroadcastChannel` and `customElements` are feature-detected.

### Migration

- **Storage implementations** — swap the argument order and read `key.key` instead of concatenating
  a prefix yourself; `key.id` is the bare id. Add `remove()` if you didn't have one.
- **Stored data** — a variant-carrying call now writes `keyPrefix + id + '@' + variant`. If your
  existing rows use a different shape, either accept that they're orphaned (thumbnails regenerate on
  the next visit) or pin the old shape with `keyFor` on `SnapshotServiceConfig`. A server-side key
  derivation must change in the same deployment.
- **Event handlers** — `e.detail` is the item, so `e.detail.id` still works; move a `route` payload
  from the deprecated `NavItem.route` into `data`.
- **Angular** — call `provideSnapshot(...)` in your root or route providers, drop
  `[snapshotService]`, and replace a hand-rolled `tick()` + `requestAnimationFrame` +
  `isConnected` block with `injectSnapshotCapture()`.
