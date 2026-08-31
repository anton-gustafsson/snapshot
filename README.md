# snapshot

A pluggable snapshot service that turns any DOM element into a stored, shareable image — with an optional `<snapshot-nav-list>` web component to display them.

```ts
import { snapshotService } from '@snapshot/core';

await snapshotService.capture(el, 'my-view');   // store a thumbnail
const url = await snapshotService.get('my-view'); // read it back
```

Capture works on any element, in any framework. Storage defaults to IndexedDB (browser-local) but is swappable for a backend that syncs across devices. The UI piece — `<snapshot-nav-list>`, a Lit web component — is optional; use the service on its own and render results anywhere.

## How it works

1. **Capture on the way out** — call `snapshotService.capture(el, id)` when the user leaves a view.
2. **It's stored, keyed by id** — IndexedDB by default; bring your own `SnapshotStorage` for a real backend.
3. **Show it wherever** — `snapshotService.get(id)` returns a displayable URL. Feed it to an `<img>`, a `<snapshot-nav-list>` tile, or anything else.

## Packages & apps

| Path | What it is |
|---|---|
| `packages/core` | `@snapshot/core` — the service, storage interface, and `<snapshot-nav-list>` component |
| `apps/docs` | Marketing/docs site |
| `apps/gallery` | Interactive demo gallery (list variants, sqlite-backed storage example, etc.) |
| `apps/demo-angular-widgets` | Angular integration demo |

## Deploy

`netlify.toml` builds `apps/docs` and `apps/gallery` together and publishes them as one site — docs at `/`, the gallery at `/examples/`. Connect the repo in Netlify and it picks this up automatically.

## Getting started

```bash
npm install
npm run dev          # runs widgets + docs + gallery together
npm run dev:docs      # docs site only
npm run dev:gallery   # gallery only
npm run dev:widgets   # Angular demo only
```

## API

### `SnapshotService`

```ts
new SnapshotService(config?: {
  storage?: SnapshotStorage;  // defaults to IndexedDB
  scale?: number;              // html2canvas render scale (default 0.4)
  keyPrefix?: string;          // namespaces storage keys + cross-tab broadcast
})
```

- `capture(el, id)` — renders `el` to a cropped thumbnail (via `html2canvas`) and stores it.
- `get(id)` — returns the stored image URL, or `null`.
- `remove(id)` — deletes a stored snapshot.
- `subscribe(cb)` — live updates across tabs when a snapshot changes.
- `publish(id, url)` / `invalidate(id)` — notify subscribers without touching storage.

A default singleton, `snapshotService`, is exported for convenience; construct your own `new SnapshotService({ storage, keyPrefix })` when you need a custom backend or namespacing.

### `<snapshot-nav-list>`

A Lit web component styled as a contact sheet of numbered frames. Point it at a `SnapshotService` instance and a list of nav items; fully themeable via CSS custom properties.
