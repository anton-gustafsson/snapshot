# `@anton-gustafsson/snapshot` — consumer-driven API proposal

**Package:** `@anton-gustafsson/snapshot-core` + `@anton-gustafsson/snapshot-angular` `0.0.6`
**Repo:** https://github.com/anton-gustafsson/snapshot (`packages/core`, `packages/angular`)
**Consumer studied:** Fleet Studio, `libs/features/dynamic-dashboard` — dashboard thumbnails on the admin
card/list view, gated by `DynamicDashboard_SnapshotLayout`.
**Written:** 2026-09-02
**Status:** implemented in `0.4.0` — all four releases landed in one pass. See `CHANGELOG.md` for the
shipped surface and the migration notes; where the implementation deviates from this document it is
noted there.

---

## 1. Summary

Atom is the first real (non-demo) consumer: server-backed storage, two thumbnails per entity
(light/dark), per-row edit rights, capture triggered from a router guard. Getting that working took
**365 lines of glue in three files**, and roughly **250 of them are generic** — they'd be written
again, the same way, by the next consumer with a backend.

| Consumer file | Lines | Generic share |
|---|---|---|
| `services/sql-indexed-db-snapshot-storage.ts` | 197 | ~90% — stale-while-revalidate cache over a remote store |
| `services/preview-image.ts` | 60 | 100% — downscale + WebP re-encode of the capture |
| `services/dashboard-snapshot.service.ts` | 108 | ~60% — theme-variant key folding, `attach()` wiring, DI holder |

Two of those are not merely boilerplate — they are the *subtle* parts (a 404 must not evict a local
capture; `whenStable` deadlocks inside `canDeactivate`), and every consumer will get them wrong once.

The package is pre-1.0, so breaking changes are cheap now and expensive in six months. This proposes
four releases, each making **one** breaking pass over **one** surface.

### Target end state for the consumer

```ts
readonly instance = new SnapshotService({
    keyPrefix: 'atom-dynamic-dashboard:',
    scale: 0.6,
    encode: { type: 'image/webp', quality: 0.8, maxEdge: 480 },
    storage: new CachedSnapshotStorage({
        remote: {
            load: (id) => firstValueFrom(this.#api.getPreview(+id).pipe(catchError(() => of(null)))),
            save: (id, blob) => firstValueFrom(this.#api.uploadPreview(+id, blob)),
        },
        onError: (err) => { if (err.status !== 403) console.warn(err); },
    }),
});
```

365 lines → ~40, and the three hardest behaviours become the library's problem.

### Explicitly *not* moving to the library

Listed so the seam is unambiguous:

- The `HttpClient` calls and endpoint shapes (`RESOURCE.AtomDashboardPreview`).
- `PreviewThemeType` and where the active theme comes from (`injectIsDarkTheme()`).
- `number` dashboard id ↔ `string` snapshot id conversion.
- The server's own 256 KiB cap (`MAX_UPLOAD_BYTES`) — a deployment fact, though the *check* becomes
  a library `maxBytes` option (§4.2).
- Deciding *when* to capture (Atom's `canDeactivate` guard) and what state to force first (leave edit
  mode, exit zoom).

---

## 2. Findings

Ordered by value to the consumer. IDs (F1…F14) are referenced by the release plan in §4.

| ID | Finding | Consumer cost today |
|---|---|---|
| F1 | No remote-backed storage; the cache-in-front-of-remote pattern is left to the consumer | 197-line file |
| F2 | Storage receives `keyPrefix + id`, but `publish()` takes the bare `id` | `#stripPrefix`, prefix passed twice |
| F3 | `capture()` hardcodes `image/png`; `scale` is instance-wide only | 60-line re-encode file, fat PNGs |
| F4 | No variant/theme dimension on ids | Consumer folds `theme` into the id string and re-parses it in storage |
| F5 | `NavItem.id` must be the storage key, so the domain id has nowhere to live | `route` abused as a payload + `#findDashboard` lookup per click |
| F6 | `editable` is component-wide, not per item | Per-row RBAC downgraded to a global `isAdmin()` — a real functional loss |
| F7 | `capture()` has no in-flight dedup, no detached-element guard, untyped errors | `#capturing` latch, `isConnected` recheck, string-matched errors |
| F8 | No framework-level "safe to capture now" helper | Consumer hand-rolled `appRef.tick()` + `requestAnimationFrame`, with a hard-won comment about why `whenStable` deadlocks |
| F9 | Angular wrapper is pre-signals (`@Input`/`EventEmitter`/`ngOnChanges`/`@ViewChild`), peer `>=17` | Only decorator-bearing code in an otherwise signals/zoneless app |
| F10 | No DI provider or injection token in the Angular package | A whole service exists mostly to hold `instance`, plus a `[snapshotService]` binding on every usage |
| F11 | Core types are not re-exported from the Angular package | Every consumer file imports from both packages |
| F12 | `export const snapshotService = new SnapshotService()` runs at import time | Unused `BroadcastChannel` + IndexedDB wiring; throws under Node/SSR/Jest |
| F13 | One `get()` per card, no batch | N HTTP round-trips per page render and per theme switch |
| F14 | `remove?` optional, no enumeration | Deleted dashboards keep their thumbnails forever, locally and server-side |

### Minor

| Finding | Fix |
|---|---|
| Host has no scroll affordance; consumer adds `flex: 1 1 auto; min-height: 0; overflow-y: auto` | `--snapshot-nav-list-max-height`, or a `scrollable` attribute |
| Default variant is `icon-only` (really "tile"); `card` is what a first-time consumer wants | Default to `card`; rename `icon-only` → `tile`, keep the old value as an alias |
| `keyPrefix` collision `console.warn` fires on HMR re-instantiation | Only warn when the previous holder hasn't been `close()`d |
| `subscribe()` returns `() => boolean` (a leaked `Set.delete`) | Return `() => void` |
| README/docs site never covers remote-backed storage — the one thing every real consumer needs | §4.5 |

---

## 3. Proposed API

### 3.1 Storage seam (F2, F4, F13, F14)

```ts
/** Passed alongside the bare id so a storage can key its own store without re-deriving anything. */
export interface SnapshotKey {
    /** Bare id as the caller passed it to capture()/get(). */
    id: string;
    /** Variant, if the call carried one (e.g. a theme). */
    variant?: string;
    /** Fully-qualified storage key: keyPrefix + id [+ variant]. Stable, safe to use verbatim. */
    key: string;
}

export interface SnapshotStorage {
    save(blob: Blob, key: SnapshotKey): Promise<string>;
    load(key: SnapshotKey): Promise<string | null>;
    /** No longer optional — see F14. */
    remove(key: SnapshotKey): Promise<void>;

    /** Optional batch read. When present, the nav list uses it instead of N loads. */
    loadMany?(keys: SnapshotKey[]): Promise<Map<string, string | null>>;
    /** Every key this storage holds. Enables prune(). */
    keys?(): Promise<SnapshotKey[]>;
    /** Called by SnapshotService's constructor. Removes the consumer-side attach() dance. */
    attach?(service: SnapshotService): void;
}
```

`SnapshotService` gains:

```ts
capture(el: HTMLElement, id: string, opts?: CaptureOptions): Promise<string>;
get(id: string, opts?: { variant?: string }): Promise<string | null>;
remove(id: string, opts?: { variant?: string }): Promise<void>;
/** Removes every stored snapshot whose id is not in `keepIds` (all variants). Needs storage.keys(). */
prune(keepIds: Iterable<string>): Promise<number>;
/** Warms the cache for a list of ids via loadMany when the storage supports it. */
prefetch(ids: string[], opts?: { variant?: string }): Promise<void>;
```

Notes:

- **Argument order** `save(blob, key)` — blob first, since the key is now an object. Worth the churn
  while pre-1.0.
- **Key format** `` `${keyPrefix}${id}` `` unchanged when no variant; `` `${keyPrefix}${id}@${variant}` ``
  with one. `@` is not produced by the current consumer's keys, so no collision with existing data —
  but see the migration note in §4.1.
- `publish(id, url)` keeps taking the bare id; storages now *have* the bare id, so nothing has to
  strip a prefix. Add a variant-aware overload `publish(id, url, { variant })`.

### 3.2 `CachedSnapshotStorage` (F1)

```ts
export interface RemoteSnapshotStorage {
    /** Resolve null for "nothing stored" — including a 404. Reject only for real failures. */
    load(id: string, key: SnapshotKey): Promise<Blob | null>;
    save(blob: Blob, key: SnapshotKey): Promise<void>;
    remove?(id: string, key: SnapshotKey): Promise<void>;
}

export interface CachedSnapshotStorageOptions {
    remote: RemoteSnapshotStorage;
    /** Defaults to a fresh IndexedDbSnapshotStorage. */
    local?: SnapshotStorage;
    /** Re-encode applied to the *remote* copy only; the local cache keeps the full capture. */
    uploadEncode?: EncodeOptions;
    /** Skip the upload (and warn) above this size. Mirrors a server-side cap. */
    maxBytes?: number;
    /** Called instead of console.warn for every swallowed failure, so a consumer can filter (e.g. a routine 403). */
    onError?(err: unknown, key: SnapshotKey, op: 'load' | 'save' | 'remove'): void;
}

export class CachedSnapshotStorage implements SnapshotStorage { /* … */ }
```

Behaviour to preserve exactly from the consumer implementation (these are the load-bearing bits):

1. `load()` returns the local hit **immediately** and revalidates in the background, publishing
   through the attached service when the remote copy lands. A cold miss awaits the remote and returns
   its URL directly rather than going through `publish`.
2. A remote answer of `null` / zero-byte blob **must not evict** a local capture. That is the normal
   "nobody has captured this yet" answer.
3. A rejected remote read is swallowed via `onError`; the local copy still stands (offline works).
4. `save()` awaits the **local** write so the caller gets a displayable URL synchronously-ish, then
   fires the upload without awaiting — a slow or rejected PUT must never delay navigation.
5. Freshness is delegated to the HTTP cache (`ETag` + `Cache-Control: no-cache`). No version
   bookkeeping in the library.

### 3.3 Encode pipeline (F3)

```ts
export interface EncodeOptions {
    type?: `image/${'png' | 'webp' | 'jpeg'}`;   // default 'image/webp', 'image/png' fallback
    quality?: number;                            // default 0.8
    /** Longest edge in px; downscales, never upscales. */
    maxEdge?: number;
}

export interface CaptureOptions {
    variant?: string;
    scale?: number;        // per-call override of the instance scale
    encode?: EncodeOptions;
}

/** Standalone so a consumer (or CachedSnapshotStorage) can re-encode a blob it already has. */
export function encodeSnapshot(blob: Blob, opts: EncodeOptions): Promise<Blob>;
```

Implementation is the consumer's `preview-image.ts` verbatim: `createImageBitmap` +
`OffscreenCanvas` + `convertToBlob`, returning the input blob untouched if either API is missing or
anything throws. Also probe `image/webp` support and fall back to PNG.

### 3.4 Item model (F5, F6)

```ts
export interface NavItem<T = unknown> {
    id: string;
    label: string;
    icon?: string;
    description?: string;
    /** @deprecated Use `data`. Kept for one release. */
    route?: string;
    /** Arbitrary consumer payload, echoed back on every event. */
    data?: T;
    /** Per-item override of the component-level `editable`. */
    editable?: boolean;
}
```

Events emit the whole item: `nav-select` / `nav-edit` detail becomes `NavItem<T>`, not
`{ id, route? }`. The Angular outputs become `OutputEmitterRef<NavItem<T>>`.

With F4 in place, `NavItem.id` is the plain domain id again and the component takes the variant:

```html
<ngx-snapshot-nav-list [items]="items()" [variant-key]="theme()" />
```

### 3.5 Capture robustness (F7, F8, F12)

Core:

- Per-`key` in-flight capture dedup (reads already have `fetchingIds`; writes have nothing).
- Reject with a typed error, not a prose string:
  `SnapshotDetachedElementError` (`!el.isConnected`), `SnapshotTaintedCanvasError`
  (`toBlob` → null), both extending `SnapshotError`.
- Lazy default instance: `getDefaultSnapshotService()`, with `snapshotService` kept as a deprecated
  getter. Guard `BroadcastChannel` / `indexedDB` so importing the package under Node (SSR, Jest)
  cannot throw.

Angular:

```ts
/** Flush pending renders, wait one frame, verify the element is still attached, then capture. */
export function injectSnapshotCapture(): (el: HTMLElement, id: string, opts?: CaptureOptions) => Promise<string | null>;
```

Uses `ApplicationRef.tick()` + one `requestAnimationFrame` — **not** `whenStable()`. This is the
part worth upstreaming as behaviour rather than documentation: inside a `canDeactivate` guard the
router holds a `PendingTasks` entry for the whole navigation, so `whenStable()` resolves only after
the view is destroyed and html2canvas then fails with *"Unable to find element in cloned iframe"*.
Resolves `null` (no throw) when the element went away mid-frame.

### 3.6 Angular DI (F9, F10, F11)

```ts
export function provideSnapshot(config?: SnapshotServiceConfig): EnvironmentProviders;
export const SNAPSHOT_SERVICE: InjectionToken<SnapshotService>;
```

`provideSnapshot()` registers a `SnapshotService` (calling `close()` on destroy) under
`SNAPSHOT_SERVICE`; the component injects it, so `[snapshotService]` becomes an override rather than
a requirement. Component rewritten with `input()` / `output()` / `viewChild.required()` — the
`ngOnChanges` + `ngAfterViewInit` `items` dance collapses into one `effect()`. Re-export the core
public types (`NavItem`, `SnapshotStorage`, `SnapshotService`, `CachedSnapshotStorage`,
`EncodeOptions`, …) from the Angular entry point. Bump peer to `>=19` (`input()`/`output()` are
stable from 17.3/19 respectively; `>=19` is the honest floor for the whole set).

---

## 4. Implementation plan

Each release is one breaking pass over one surface, so a consumer never has to fix the same call site
twice. File paths are the `packages/core/src/*` counterparts of the published `dist/*` names —
**verify against the repo**, they're inferred from the shipped bundle, not read from source.

### 4.1 `0.1.0` — storage seam and keys (F1, F2, F4, F13, F14)

The one genuinely breaking release. Do it first and get it over with.

| Step | Change | Files |
|---|---|---|
| 1 | Add `SnapshotKey`; change `SnapshotStorage` to `save(blob, key)` / `load(key)` / `remove(key)`; add optional `loadMany` / `keys` / `attach` | `snapshot-storage.ts` |
| 2 | `SnapshotService`: build the key (prefix + id + optional `@variant`), pass `SnapshotKey`, call `storage.attach?.(this)` in the constructor | `snapshot-service.ts` |
| 3 | `capture`/`get`/`remove` take `{ variant }`; `publish` gains a variant-aware overload | `snapshot-service.ts` |
| 4 | Add `prune(keepIds)` and `prefetch(ids, { variant })` | `snapshot-service.ts` |
| 5 | `IndexedDbSnapshotStorage`: adopt the new signatures, implement `keys()` (`idb-keyval`'s `keys()` filtered by the `snapshot:` prefix) and `loadMany()` | `snapshot-storage.ts` |
| 6 | Add `CachedSnapshotStorage` + `RemoteSnapshotStorage` per §3.2 | new `cached-snapshot-storage.ts` |
| 7 | Nav list: use `loadMany` when available; take a `variant-key` attribute and pass it through to `get()` | `snapshot-nav-list.ts` |
| 8 | Export everything new from `index.ts`; update `apps/gallery` + `apps/demo-angular-widgets` | `index.ts`, demo apps |

**Migration note for existing data.** Keys shift from `keyPrefix + id` to
`keyPrefix + id + '@' + variant` for variant-carrying calls. Atom's current keys are
`atom-dynamic-dashboard:<id>:<light|dark>` — a *different* shape, so its IndexedDB entries and its
server rows are orphaned by the switch. Acceptable here (thumbnails are regenerated on the next
visit, and the server read is a cheap 404), but the release notes must say so, and Atom's server-side
key derivation must change in the same deployment. Prefer a `keyFor?: (key: SnapshotKey) => string`
escape hatch on `SnapshotServiceConfig` so a consumer can pin the old shape.

**Verification:** unit-test `CachedSnapshotStorage` against a fake remote for the five behaviours in
§3.2 (local-hit-then-revalidate, cold miss, `null` doesn't evict, rejection doesn't evict,
`save` doesn't await the upload). Confirm whether `packages/core` has a test runner at all; if not,
add Vitest — this is the release that most needs tests.

### 4.2 `0.2.0` — capture pipeline (F3, F7, F12)

| Step | Change | Files |
|---|---|---|
| 1 | Add `EncodeOptions` + `encodeSnapshot()` (port `preview-image.ts`); probe WebP, fall back to PNG | new `encode.ts` |
| 2 | `SnapshotServiceConfig.encode` + `CaptureOptions.encode` / `.scale`; apply in `capture()` | `snapshot-service.ts` |
| 3 | `CachedSnapshotStorage`: `uploadEncode`, `maxBytes`, `onError` | `cached-snapshot-storage.ts` |
| 4 | Per-key in-flight capture dedup | `snapshot-service.ts` |
| 5 | `SnapshotError` / `SnapshotDetachedElementError` / `SnapshotTaintedCanvasError`; `capture()` rejects with the typed error when `!el.isConnected` | new `errors.ts`, `snapshot-service.ts` |
| 6 | `getDefaultSnapshotService()` (lazy); deprecate `snapshotService`; guard `BroadcastChannel` / `indexedDB` for Node | `snapshot-service.ts`, `index.ts` |

**Verification:** capture a `<div>` with a nested image in the gallery app at each `type` and confirm
size/format; assert importing `@anton-gustafsson/snapshot-core` in a bare Node script does not throw.

### 4.3 `0.3.0` — item model and component polish (F5, F6, minor)

| Step | Change | Files |
|---|---|---|
| 1 | `NavItem<T>` with `data` + per-item `editable`; deprecate `route` | `snapshot-nav-list.ts` |
| 2 | `nav-select` / `nav-edit` emit the whole item | `snapshot-nav-list.ts` |
| 3 | Per-item edit button visibility = `item.editable ?? this.editable` | `snapshot-nav-list.ts` |
| 4 | Default `variant` → `card`; add `tile` as the new name for `icon-only`, keep the old value working | `snapshot-nav-list.ts` |
| 5 | `--snapshot-nav-list-max-height` (or a `scrollable` attribute) so the host scrolls without consumer CSS | `snapshot-nav-list.ts` |
| 6 | `subscribe()` → `() => void`; only warn on a `keyPrefix` collision when the holder is still open | `snapshot-service.ts` |

### 4.4 `0.4.0` — Angular package (F8, F9, F10, F11)

| Step | Change | Files |
|---|---|---|
| 1 | Rewrite the component with `input()` / `output()` / `viewChild.required()`; drop `ngOnChanges` + `ngAfterViewInit` in favour of one `effect()` setting `items` | `packages/angular/src/snapshot-nav-list.component.ts` |
| 2 | `provideSnapshot()` + `SNAPSHOT_SERVICE`; the component injects the service, `[snapshotService]` becomes an optional override | new `provide-snapshot.ts` |
| 3 | `injectSnapshotCapture()` per §3.5 | new `inject-snapshot-capture.ts` |
| 4 | Re-export the core public surface from the Angular entry point | `public-api.ts` |
| 5 | Peer `@angular/core` `>=19`; note zoneless support | `packages/angular/package.json` |

**Verification:** the `demo-angular-widgets` app must run with `provideZonelessChangeDetection()` and
no `[snapshotService]` binding anywhere.

### 4.5 Docs (parallel, ships with each release)

- README section **"Backing snapshots with a server"** — the `CachedSnapshotStorage` recipe, with the
  five behaviour notes from §3.2 spelled out as the reasons the defaults are what they are.
- README section **"Capturing safely in a framework"** — the tick-not-`whenStable` trap.
- Gallery: add a "remote storage (simulated latency + 404s)" demo so the loading and revalidate
  states are visible.
- CHANGELOG with an explicit migration table for `0.1.0`.

### 4.6 Consumer migration (this repo, after each release)

| Release | Atom change | Δ lines |
|---|---|---|
| `0.1.0` | Delete `sql-indexed-db-snapshot-storage.ts`; rebuild `DashboardSnapshotService` on `CachedSnapshotStorage`; drop `previewKey`/`keyFor`/`#parse`/`#stripPrefix`/`attach` and pass `variant: previewTheme()`; server-side preview key derivation updated in the same deployment | −197, −40 |
| `0.2.0` | Delete `preview-image.ts`; move `MAX_EDGE`/WebP/quality into `encode`, `MAX_UPLOAD_BYTES` into `maxBytes`, the 403 filter into `onError` | −60 |
| `0.3.0` | `snapshotItems` carries `data: dashboard` and `editable: canEditDashboard(dashboard)`; delete `#findDashboard`; handlers take the item — **restores per-row edit rights on cards** | −15 |
| `0.4.0` | `provideSnapshot(...)` in the feature's route providers; drop `[snapshotService]`; `captureSnapshot()` uses `injectSnapshotCapture()`, dropping the `tick`/rAF/`isConnected`/`#capturing` block; single-package imports | −45 |

Cumulative: ~365 → ~40 lines, and `DynamicDashboard_SnapshotLayout` cards regain per-dashboard RBAC.

Each migration step is gated behind the existing `DynamicDashboard_SnapshotLayout` permission, so a
regression is contained to users who have opted into the card/list views.

---

## 5. Risks and open questions

| Risk | Mitigation |
|---|---|
| CI publishes on any push to `master` touching `packages/**` — a half-finished breaking change ships | Land each release on a branch; squash-merge once its demo app is updated |
| `0.1.0` orphans existing stored snapshots (§4.1) | Optional `keyFor` escape hatch + explicit CHANGELOG migration note |
| `CachedSnapshotStorage` bakes in one caching policy | Keep the primitives (`publish`, `IndexedDbSnapshotStorage`) public so an unusual consumer can still hand-roll — as Atom does today |
| Peer bump to `>=19` drops Angular 17/18 consumers | Pre-1.0, and `input()`/`output()`/zoneless are the reason a consumer wants this package in a modern app; state it in the release notes |
| `maxEdge` re-encode on the main thread on capture | `OffscreenCanvas` + `createImageBitmap` are already off the layout path; revisit with a worker only if measurably slow |

Open questions for the maintainer:

1. Should `variant` be a free string (theme today, density/locale tomorrow) or a closed
   `'light' | 'dark'`? **Recommendation: free string** — the library shouldn't own the taxonomy.
2. Should `CachedSnapshotStorage` live in `snapshot-core` or a separate `snapshot-remote` package?
   **Recommendation: core** — it needs no new dependencies, and splitting it means the docs for the
   common case live in a package nobody finds.
3. Does `packages/core` have a test runner today? `0.1.0` should not ship without one.
