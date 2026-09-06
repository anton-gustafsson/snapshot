import { ApplicationRef, inject } from '@angular/core';
import type { CaptureOptions, SnapshotService } from '@anton-gustafsson/snapshot-core';
import { SnapshotError } from '@anton-gustafsson/snapshot-core';
import { SNAPSHOT_SERVICE } from './provide-snapshot';

/**
 * Returns a capture function that is safe to call from wherever a view is
 * about to disappear — most usefully a `canDeactivate` guard.
 *
 * It flushes pending renders with `ApplicationRef.tick()` and waits one frame
 * for layout, then re-checks that the element is still attached before handing
 * it to html2canvas. Resolves `null` (rather than throwing) when the element
 * went away mid-frame, the `tick()` itself threw (a change-detection error
 * anywhere in the tree), or the capture failed for a reason a thumbnail isn't
 * worth blocking navigation over.
 *
 * Deliberately **not** `whenStable()`: inside a `canDeactivate` guard the
 * router holds a `PendingTasks` entry for the entire navigation, so
 * `whenStable()` doesn't resolve until the view is already destroyed — and
 * html2canvas then fails with "Unable to find element in cloned iframe".
 */
export function injectSnapshotCapture() {
  const appRef = inject(ApplicationRef);
  const defaultService = inject(SNAPSHOT_SERVICE);

  /**
   * `service` defaults to the injected instance — pass the same instance
   * given to a specific `<ngx-snapshot-nav-list [snapshotService]>` when
   * this capture is meant to land in that list rather than the app-wide one.
   */
  return async (
    el: HTMLElement,
    id: string,
    opts?: CaptureOptions,
    service: SnapshotService = defaultService,
  ): Promise<string | null> => {
    try {
      appRef.tick();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!el.isConnected) return null;
      return await service.capture(el, id, opts);
    } catch (err) {
      // A thumbnail is a nice-to-have, not a gate on navigation.
      console.warn(
        err instanceof SnapshotError ? err.message : `injectSnapshotCapture: capture failed for "${id}"`,
        err,
      );
      return null;
    }
  };
}
