# Changelog

Both packages (`@anton-gustafsson/snapshot-core`, `@anton-gustafsson/snapshot-angular`) share a
version. Pre-1.0, so breaking changes ship with a migration note instead of a deprecation cycle.

## Unreleased

### Added

- **`<snapshot-nav-list placeholder-text>`** (and `NavItem.placeholderText` per row, `''` to opt a
  single row back out) — a caption in the frame of a card with no capture yet, e.g. "no snapshot
  yet". Previously the empty frame could only hold a glyph, via `NavItem.icon`, so the empty state
  had no way to say what it meant in words. Setting it drops the hatch and its tint — the frame goes
  see-through with a dashed edge — and stacks the caption under `icon` when a card has both. Plain
  text, never markup, unlike `icon`. Themeable via `--snapshot-nav-list-placeholder-font` /
  `-font-size` / `-letter-spacing` / `-color` / `-border` / `-bg`, or `::part(placeholder-text)`.

- **`CaptureOptions.onclone`** — passed straight through to html2canvas: a hook into the cloned
  document right before it's rendered, for anything that needs to touch the clone specifically
  rather than the live element (html2canvas re-resolves styles on the clone, so a live-DOM mutation
  made just before `capture()` isn't guaranteed to still apply by render time).
- **`CaptureOptions.neutralizeColors`** — html2canvas can't parse `oklch()`/`oklab()`, which
  `getComputedStyle` now resolves a growing share of real-world CSS to (any app on a palette defined
  in OKLCH — Tailwind v4's own default colors included — hits this, regardless of how the color was
  originally authored). Set to rewrite every resolved color on the page to a plain `hsl()` for the
  duration of the capture (colors mid-CSS-transition included — Chrome resolves those through oklab
  too) and restore it after. Off by default: it's a full-document style walk plus an on-demand import
  of `colorjs.io`, so only pay for it on a page that actually hits this.
- **`CaptureOptions.width`/`height`/`fit`/`background`** — capture `el` into an exact, pre-sized
  thumbnail regardless of its own shape. `fit: 'cover'` scales to fill and crops the overflow,
  centered (upscaling undersized content); `fit: 'contain'` scales to fit entirely inside, letterboxed
  with `background`. Implemented by cloning `el` off-screen into a `width`×`height` frame and
  capturing that — no framework-specific lifetime handling needed.
- **`CaptureOptions.contentCrop`** — every capture previously cropped to the bounding box of `el`'s
  visible children unconditionally, with no way to see or override it — reasonable for the library's
  normal case (an existing UI element with blank chrome around it), but silently fought any caller
  building an exact-size container on purpose. Pass `false` to capture `el` at its own full size
  instead. Defaults to `false` automatically once `fit` is set, since the frame `fit` produces is
  already the exact requested size.
- **`CONTENT_PADDING`** — the padding (in CSS px) the default content-crop applies, now exported
  instead of a caller having to hardcode `16` and hope it stays in sync.
- **`injectDetachedCapture()`** (Angular) — same contract as `injectSnapshotCapture()`, for when `el`
  isn't guaranteed to survive the whole capture (typically an un-awaited `canDeactivate` capture).
  Clones `el` onto a detached, off-screen node first, so the capture's lifetime is owned by the call
  instead of by whatever destroys the original view.

### Changed

- **BREAKING: `NavItem.icon` is markup-only.** A plain-text glyph (an emoji, a `+`, a `*`) is no
  longer rendered — it paints nothing and logs one warning per distinct value. A glyph inherited
  whatever font and size the frame happened to have and gave the empty state no way to say what it
  meant; `placeholderText` covers words, and `icon` covers art. Migration: wrap the glyph in an
  element (`icon: '<span>*</span>'`), swap it for an `<svg>`/`<img>`, or move the intent into
  `placeholderText`. `editIcon` is unaffected — it still takes a glyph or markup, and still
  defaults to `'✎'`.
- **The placeholder icon slot spans the frame** (minus the caption, if any) instead of shrinking to
  the glyph, so a fallback `<img>` can be sized as a percentage. Three new custom properties drive
  it: `--snapshot-nav-list-placeholder-icon-size` (default `1.6rem`), `-icon-opacity` (default
  `0.4`), `-icon-fit` (`<img>` only, default `contain`). The span is exposed as
  `::part(placeholder-icon)`.
- **The empty frame's hatch is now a custom property** — `--snapshot-nav-list-placeholder-hatch:
  none` clears it (real fallback art behind a hatch reads as a rendering bug), and
  `--snapshot-nav-list-placeholder-bg` recolors the fill under it.

- `neutralizeOklchColors()` is no longer exported — it was the right *fix*, but the wrong *shape*: an
  extra function a caller had to know existed, import, and sequence correctly around `capture()` by
  hand. That's now `CaptureOptions.neutralizeColors` instead — same behavior, wired up internally by
  `capture()` itself.

### Removed

- `waitForCanvasesToPaint()` (and the `CaptureOptions.waitForCanvases` option it briefly had in this
  same unreleased cycle) — canvas-chart captures are a narrow case, and the rAF-polling workaround is
  simple enough for a caller who actually hits it to write themselves rather than carrying it as
  library surface for everyone else.
- `<snapshot-nav-list>`'s `tile` and `list` variants, and every property that only existed for them:
  `variant`, `overlay-tint`, `text-overlay-opacity`, `image-overlay-opacity`, `overlay-blur`,
  `label-position` (and the `'icon-only'` legacy alias for `tile`). The component now always renders
  the `card` layout — the only one this library's consumers actually use — instead of carrying three
  layouts' worth of CSS and properties for two nobody was using. `--snapshot-nav-list-tile-width`,
  `-tile-height`, `-overlay-margin`, and `-overlay-radius` go with them; `--snapshot-nav-list-gap` is
  replaced by `--snapshot-nav-list-card-gap` (the card grid's own gap var, previously namespaced
  separately from the generic one). `edit-button-position`, `edit-icon`, `editable`, `variant-key`,
  and `scrollable` are unaffected — they apply to the card layout the same as before.

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
