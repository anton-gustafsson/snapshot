# Code Review Findings — PR #1 (feat/consumer-driven-api-0.4.0)

xhigh pass, `packages/core` + `packages/angular`. Ranked most severe first.

## Top 15

1. **`packages/core/src/snapshot-service.ts:137`** — `keyOf()`/`parseKey()` use an unescaped `@` as the id/variant separator, so an id containing `@` collides with an unrelated variant-suffixed key.
   *Failure:* `capture(elA, 'a@b')` and `capture(elB, 'a', {variant:'b'})` both key to `${prefix}a@b` — collide in storage and the object-URL cache. `prune(['user@example.com'])` misparses into id=`user`+variant=`example.com`, deleting a kept snapshot.

2. **`packages/core/src/cached-snapshot-storage.ts:88`** — `cachedSizes` is never populated on a local-cache hit, so the first `revalidate()` after any fresh instantiation always treats an unchanged remote copy as "changed".
   *Failure:* Reload the page after a warm load — `revalidate()`'s `cachedSizes.get(key)` is `undefined`, never equal to `blob.size`, so it unconditionally re-saves + republishes even with byte-identical content. Never converges if `encode`/`uploadEncode` configs differ.

3. **`packages/core/src/cached-snapshot-storage.ts:119`** — `remove()` swallows a failed remote delete instead of propagating it.
   *Failure:* `remote.remove()` rejects; the catch only warns, `notify(id, null)` still fires and the UI drops the thumbnail; next revalidation resurrects it from the still-live server copy.

4. **`packages/core/src/cached-snapshot-storage.ts:89`** — `remove()` doesn't fence a concurrent in-flight `revalidate()` for the same key.
   *Failure:* Background `revalidate()` started before `remove()`; `remove()` deletes; the stale revalidate resolves with pre-delete data, sees `undefined !== size`, re-saves and republishes the just-deleted snapshot.

5. **`packages/angular/src/inject-snapshot-capture.ts:26`** — `appRef.tick()` and the `requestAnimationFrame` await run before the `try/catch`, so a change-detection error anywhere in the tree throws uncaught instead of resolving `null` as documented.
   *Failure:* Any throwing getter/pipe during `tick()` rejects the promise; callers with no catch (`demo-angular-widgets` `save()`/`onSelect()`) silently fail to navigate on click.

6. **`packages/core/src/snapshot-service.ts:220`** — `getMany()`'s no-`loadMany` fallback uses `Promise.all` (fail-fast), losing the per-item failure isolation the old loop had.
   *Failure:* One item rejects among 10 on a storage without `loadMany()` (e.g. the shipped `SqliteSnapshotStorage`) — the whole `Promise.all` rejects, all 10 stuck on placeholder instead of just the failing one.

7. **`packages/core/src/snapshot-nav-list.ts:482`** — `loadThumbs()`'s `fetchingIds` guard isn't variant-scoped, so switching `variantKey` mid-flight leaves the new variant permanently stuck on placeholder.
   *Failure:* Mount `variant=light`, flip to `dark` before load resolves. Ids stuck in `fetchingIds` from the light call block the dark fetch; the stale light result is discarded on resolve but `finally` clears `fetchingIds` without retriggering a dark fetch.

8. **`packages/angular/src/inject-snapshot-capture.ts:23`** — always resolves the DI-token `SnapshotService`, ignoring a per-instance `[snapshotService]` override on `SnapshotNavListComponent`.
   *Failure:* Page uses a custom `[snapshotService]` on the nav list but captures via `injectSnapshotCapture()` in a guard — capture goes to the default service, custom list's thumbnail never updates.

9. **`packages/core/src/snapshot-service.ts:151`** — a configured `keyFor` makes `parseKey()` always return `null`, turning `prune()` into a permanent silent no-op (no warning, unlike the missing-`keys()` case).
   *Failure:* Consumer sets the documented `keyFor` escape hatch, calls `prune(keepIds)` — every entry short-circuits on `!parsed`, returns 0 removed, zero console output.

10. **`packages/core/src/cached-snapshot-storage.ts:126`** — `keys()` is unconditionally defined via `local.keys?.() ?? Promise.resolve([])`, so `prune()`'s missing-`keys()` warning never trips even when the wrapped local storage lacks `keys()`.
    *Failure:* `CachedSnapshotStorage` wraps a local storage without `keys()` (valid — it's optional) — `prune()` sees a defined method, skips the warning, silently no-ops forever.

11. **`packages/core/src/snapshot-nav-list.ts:416`** — live-update guard strictly compares `variant` to `this.variantKey`, but `keyOf()` folds `''` and `undefined` together.
    *Failure:* `nav.variantKey` set to `''` (not `undefined`); a plain capture notifies with `variant: undefined`; guard sees `undefined !== ''` and drops every subsequent live update, though the initial load painted fine.

12. **`packages/core/src/snapshot-service.ts:165`** — `capture()` no longer declared `async`, so a synchronous throw from a caller-supplied `keyFor` bypasses a chained `.catch()`.
    *Failure:* `dashboard.ts`/`main.ts` call `.capture(...).catch(...)` with no enclosing `try/catch`. If `keyFor` throws (documented option), the exception propagates synchronously past `.catch()`, hanging Navigo's `leave`-hook `done()` in `dashboard.ts`.

13. **`apps/gallery/src/pages/remote-storage.ts:137`** — "Drop local cache" button's async click handler has no `try/catch` or `.catch()`.
    *Failure:* `local.remove()` rejects (quota, private browsing) mid-loop — remaining items never `invalidate()`'d, status/navList refresh never runs, surfaces only as console "Uncaught (in promise)".

14. **`packages/core/src/snapshot-service.ts:184`** — `html2canvas()`'s own rejection isn't wrapped in `SnapshotError`, contradicting `errors.ts`'s documented contract that every library rejection extends `SnapshotError`.
    *Failure:* `runCapture()` has no `try/catch` around `await html2canvas(...)`. A documented failure ("Unable to find element in cloned iframe") reaches callers that branch on `instanceof SnapshotError` as an unrecognized error instead of a capture failure.

15. **`packages/core/src/encode.ts:43`** — `encodeSnapshot()`'s early-return checks only dimensions and MIME type, never quality.
    *Failure:* `encode` quality 0.9 vs `uploadEncode` quality 0.3, same type/maxEdge. Once content is already at maxEdge, `upload()`'s encode hits the early return and uploads the full quality-0.9 blob, breaking the "small copy for server" contract.

## Below cutoff (still real, lower severity)

- `snapshot-service.ts:~155` — `parseKey()` empty-id+variant boundary bug (`at <= 0` conflates "no separator" with "separator at index 0").
- `snapshot-service.ts:~264/276/287` — `prefetch()`/`publish()`/`invalidate()` pass `opts.variant` straight to `notify()` unnormalized, unlike `capture()`/`remove()` which fold `''`→`undefined` via `keyOf()`. Same family as #11; direct `subscribe()` consumers affected too.
- `snapshot-service.ts:179` vs `183` — crop bounds computed before the dynamic `await import('html2canvas')`; a layout shift during that first-load chunk fetch crops stale. First-capture-in-session only.
- `inject-snapshot-capture.ts:27` — the `requestAnimationFrame` wait has no timeout; browsers throttle/suspend rAF in a backgrounded tab, and this function is documented for `canDeactivate` guards that block navigation on it.
- `cypress/support/e2e.ts:8` — `indexedDB.deleteDatabase()` fires raw, unawaited, outside Cypress's command queue; can race a still-open connection from the previous test's page.
- `snapshot-nav-list.ts:5` — component still defaults to the deprecated `snapshotService` Proxy instead of `getDefaultSnapshotService()` (behaviorally inert, just inconsistent).

## Examples-page cleanup (separate from review, done alongside it)

11 files under `apps/gallery/src/`, working-tree changes, **not committed**:

- `gallery-shared.ts` — 6 new shared helpers: `sectionTitle`, `captionedRow`, `lightDarkPreview`, `codeSnippet`, `seedInBackground`, `resetSpinnerButton`.
- `config-builder.ts`, `dashboard-card.ts`, `elevation.ts`, `loading.ts`, `overlay.ts`, `remote-storage.ts`, `sqlite-only.ts`, `sqlite.ts`, `text-combos.ts`, `theming.ts` — rewired to use the shared helpers instead of duplicated DOM-construction code; deleted `theming.ts`'s dead private `swatchRow`; `sqlite.ts`/`sqlite-only.ts` now use existing `makeClickableNavList` instead of hand-rolled wiring.

Verified: `tsc --noEmit` clean, `vite build` clean, Cypress 12/12 passing (`capture-round-trip.cy.ts`, `nav-list.cy.ts`, `remote-storage.cy.ts`). Net -4 lines despite +110 in the shared file. No changes to `packages/core`/`packages/angular`.
