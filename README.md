# snapshot

**[Docs & examples →](https://snapshot.moimob.com/)**

A pluggable snapshot service that turns any DOM element into a stored, shareable image — with an optional `<snapshot-nav-list>` web component to display them.

```ts
import { getDefaultSnapshotService } from '@anton-gustafsson/snapshot-core';

const snapshots = getDefaultSnapshotService();

await snapshots.capture(el, 'my-view');    // store a thumbnail
const url = await snapshots.get('my-view'); // read it back
```

Capture works on any element, in any framework. Storage defaults to IndexedDB (browser-local) but is swappable for a backend that syncs across devices. The UI piece — `<snapshot-nav-list>`, a Lit web component — is optional; use the service on its own and render results anywhere.

## How it works

1. **Capture on the way out** — call `capture(el, id)` when the user leaves a view.
2. **It's stored, keyed by id** — IndexedDB by default; `CachedSnapshotStorage` for a server-backed one; or bring your own `SnapshotStorage`.
3. **Show it wherever** — `get(id)` returns a displayable URL. Feed it to an `<img>`, a `<snapshot-nav-list>` tile, or anything else.

## Packages & apps

| Path | What it is |
|---|---|
| `packages/core` | `@anton-gustafsson/snapshot-core` — the service, storage interface, and `<snapshot-nav-list>` component |
| `packages/angular` | `@anton-gustafsson/snapshot-angular` — thin Angular wrapper (`<ngx-snapshot-nav-list>`) around the same web component |
| `apps/docs` | Marketing/docs site |
| `apps/gallery` | Interactive demo gallery (list variants, sqlite-backed storage example, etc.) |
| `apps/demo-angular-widgets` | Angular integration demo |

## Publishing

`.github/workflows/publish.yml` patch-bumps and publishes `@anton-gustafsson/snapshot-core` and `@anton-gustafsson/snapshot-angular` to npm on every push to `master` that touches `packages/**`. Requires an `NPM_TOKEN` repo secret (an npm Automation token, or a granular token with "bypass 2FA" enabled).

## Deploy

Live at [snapshot.moimob.com](https://snapshot.moimob.com/) — `netlify.toml` builds `apps/docs` and `apps/gallery` together and publishes them as one site, docs at `/` and the gallery at `/examples/`.

## Getting started

```bash
npm install
npm run dev          # runs widgets + docs + gallery together
npm run dev:docs      # docs site only
npm run dev:gallery   # gallery only
npm run dev:widgets   # Angular demo only
```

## Tests

```bash
npm test              # unit: Vitest in packages/core (service, storage, component in jsdom)
npm run test:e2e      # UI: Cypress against the gallery app (starts it, runs headless, stops it)
npm run test:e2e:open # the same, interactive
npm run test:all      # both
npm run typecheck     # tsc over packages/core (incl. tests) + the Cypress specs
```

The Cypress specs run against `apps/gallery` because that's the only place the whole loop is real —
a live `<snapshot-nav-list>`, real html2canvas captures, real IndexedDB, and one page per storage
recipe. They cover the capture round trip (open a view, leave it, the frame shows the capture; it
survives a reload), the rendering contract (variants, placeholders, per-row edit buttons,
`scrollable`), and `CachedSnapshotStorage` against a fake HTTP API with latency, a 404 and a 403.
Queries go through `cy.frames()` — a shadow-piercing helper, since a descendant selector can't cross
a shadow boundary.

## API

### `SnapshotService`

```ts
new SnapshotService(config?: {
  storage?: SnapshotStorage;   // defaults to IndexedDB
  scale?: number;              // html2canvas render scale (default 0.4)
  keyPrefix?: string;          // namespaces storage keys + cross-tab broadcast
  encode?: EncodeOptions;      // re-encode captures, e.g. { type: 'image/webp', maxEdge: 480 }
  keyFor?: (key: SnapshotKey) => string; // escape hatch for a pre-existing key shape
})
```

- `capture(el, id, opts?)` — renders `el` to a cropped thumbnail (via `html2canvas`), optionally re-encodes it, and stores it. Concurrent calls for the same key share one render. Rejects with `SnapshotDetachedElementError` / `SnapshotTaintedCanvasError`.
- `get(id, opts?)` — returns the stored image URL, or `null`.
- `getMany(ids, opts?)` / `prefetch(ids, opts?)` — one batched read for a whole list (uses `storage.loadMany` when available).
- `remove(id, opts?)` — deletes a stored snapshot.
- `prune(keepIds)` — deletes every snapshot (all variants) whose id isn't in `keepIds`. Needs `storage.keys()`.
- `keyOf(id, opts?)` / `parseKey(key)` — the storage key for an id, and back again.
- `subscribe(cb)` — live updates across tabs when a snapshot changes; `cb(id, url, variant)`.
- `publish(id, url, opts?)` / `invalidate(id, opts?)` — notify subscribers without touching storage.

Every read/write takes an optional `{ variant }` — a second dimension on the id (a theme, a density,
a locale) stored under its own key, so a dark capture never comes back for a light request.

`getDefaultSnapshotService()` returns a lazily-created shared instance; construct your own
`new SnapshotService({ storage, keyPrefix })` when you need a custom backend or namespacing. (The old
`snapshotService` export still works and now forwards to the same lazy instance.)

### Storage

```ts
interface SnapshotStorage {
  save(blob: Blob, key: SnapshotKey): Promise<string>;  // returns a displayable URL
  load(key: SnapshotKey): Promise<string | null>;
  remove(key: SnapshotKey): Promise<void>;
  loadMany?(keys: SnapshotKey[]): Promise<Map<string, string | null>>;  // batch read
  keys?(): Promise<SnapshotKey[]>;                                      // enables prune()
  attach?(service: SnapshotService): void;                              // lets it publish()
}
```

`SnapshotKey` is `{ id, variant?, key }` — the bare id, the variant if the call carried one, and the
fully-qualified `key` (`keyPrefix + id [+ '@' + variant]`) that's safe to use verbatim.

### Backing snapshots with a server

`CachedSnapshotStorage` is the recipe you'd otherwise write by hand: a local IndexedDB cache in front
of your API, where you supply only the two calls that are yours to make.

```ts
import { CachedSnapshotStorage, SnapshotService } from '@anton-gustafsson/snapshot-core';

export const snapshots = new SnapshotService({
  keyPrefix: 'reports:',
  encode: { type: 'image/webp', quality: 0.8, maxEdge: 640 },
  storage: new CachedSnapshotStorage({
    remote: {
      // null (not a rejection) for "nothing stored yet" — a 404 included
      load: async (id) => {
        const res = await fetch(`/api/snapshots/${id}`);
        if (res.status === 404) return null;
        if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status });
        return res.blob();
      },
      save: async (blob, id) => {
        const body = new FormData();
        body.append('file', blob, `${id}.webp`);
        await fetch(`/api/snapshots/${id}`, { method: 'PUT', body });
      },
    },
    uploadEncode: { type: 'image/webp', quality: 0.8, maxEdge: 480 }, // small copy for the server
    maxBytes: 256 * 1024,                                             // mirror the server's cap
    onError: (err, key, op) => {                                      // filter the routine failures
      if ((err as { status?: number }).status !== 403) console.warn(op, key.key, err);
    },
  }),
});
```

Why the defaults are what they are — the five behaviours worth not re-deriving:

1. **Local first, revalidate behind it.** `load()` returns the cached image immediately and reads the
   remote in the background, publishing only if what came back actually differs. A cold miss awaits
   the remote and returns its URL directly.
2. **A remote answer of "nothing" never evicts a local capture.** A 404 is the normal answer for a
   snapshot nobody has uploaded yet.
3. **A failed read never evicts either.** Rejections go to `onError`; the local copy stands, so
   thumbnails work offline.
4. **Saves don't wait for the upload.** The local write is awaited (you get a URL); the PUT is fired
   and forgotten, so a slow or refused upload can't delay a navigation.
5. **Freshness is the HTTP cache's job** (`ETag` + `Cache-Control: no-cache`) — no version
   bookkeeping in the library.

Live demos: gallery `/remote-storage` (fake HTTP with latency, a 404 and a 403) and `/sqlite` (the
same recipe over real SQLite via sql.js).

### Capturing safely in a framework

Capture the frame the user is about to leave, not the one that's already gone: flush pending renders,
wait one animation frame, then check the element is still attached. In Angular that whole dance is
`injectSnapshotCapture()`. Do **not** wait on `whenStable()` inside a `canDeactivate` guard — the
router holds a pending task for the whole navigation, so it resolves only after the view is
destroyed, and html2canvas then fails with *"Unable to find element in cloned iframe"*.

### `<snapshot-nav-list>`

A Lit web component styled as a contact sheet of numbered frames. Point it at a list of nav items
(and, optionally, a `SnapshotService` instance); fully themeable via CSS custom properties.

- `variant` — `'card'` (default), `'tile'`, `'list'`. `'icon-only'` is the old name for `'tile'` and still works.
- `variant-key` — passed through to `get()` as `variant`; bind it to the active theme.
- `editable` — per-card edit button firing `nav-edit`; `NavItem.editable` overrides it per row.
- `scrollable` — the host scrolls itself, with `--snapshot-nav-list-max-height`.
- `nav-select` / `nav-edit` — detail is the whole `NavItem<T>`, `data` payload included.

### `@anton-gustafsson/snapshot-angular`

```ts
import {
  SnapshotNavListComponent,
  provideSnapshot,
  injectSnapshotCapture,
  type NavItem,
} from '@anton-gustafsson/snapshot-angular';
```

A thin standalone wrapper (`<ngx-snapshot-nav-list>`) around `<snapshot-nav-list>`, built on signal
inputs/outputs (`items`, `variant`, `variantKey`, `overlayTint`, `textOverlayOpacity`,
`imageOverlayOpacity`, `overlayBlur`, `labelPosition`, `editable`, `scrollable`, `(select)`,
`(edit)`) — Angular-idiomatic bindings instead of raw attributes/DOM events, zoneless-safe.

- `provideSnapshot(config?)` — registers a configured `SnapshotService` under `SNAPSHOT_SERVICE` for
  this injector (root, or a lazy route's providers) and `close()`s it on destroy. The component
  injects it, so `[snapshotService]` is an override, not a requirement.
- `injectSnapshotCapture()` — `(el, id, opts?) => Promise<string | null>`; ticks, waits a frame,
  re-checks the element, and resolves `null` instead of throwing.
- The package re-exports the core public surface, so a consumer imports from one package.

Peer requirement: `@angular/core >= 19`.
