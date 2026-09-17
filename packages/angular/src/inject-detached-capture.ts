import { ApplicationRef, inject } from '@angular/core';
import type { CaptureOptions, SnapshotService } from '@anton-gustafsson/snapshot-core';
import { SnapshotError } from '@anton-gustafsson/snapshot-core';
import { SNAPSHOT_SERVICE } from './provide-snapshot';

/**
 * Same contract as `injectSnapshotCapture()`, for when `el` isn't guaranteed
 * to survive the *whole* capture — not just be attached when the call
 * starts, but stay attached until `service.capture()` resolves. Typically a
 * `canDeactivate` guard that fires the capture without awaiting it (so
 * navigation isn't gated on a thumbnail), where the view — and `el` with it
 * — can be destroyed the moment the guard returns.
 *
 * Clones `el` onto a detached, off-screen node before capturing, so the
 * capture's lifetime is owned by the call rather than by whatever destroys
 * the original view.
 */
export function injectDetachedCapture() {
  const appRef = inject(ApplicationRef);
  const defaultService = inject(SNAPSHOT_SERVICE);

  return async (
    el: HTMLElement,
    id: string,
    opts?: CaptureOptions,
    service: SnapshotService = defaultService,
  ): Promise<string | null> => {
    let clone: HTMLElement | undefined;
    try {
      appRef.tick();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!el.isConnected) return null;

      clone = el.cloneNode(true) as HTMLElement;
      clone.style.position = 'fixed';
      clone.style.top = '-10000px';
      clone.style.left = '-10000px';
      clone.style.pointerEvents = 'none';
      document.body.append(clone);

      return await service.capture(clone, id, opts);
    } catch (err) {
      console.warn(
        err instanceof SnapshotError ? err.message : `injectDetachedCapture: capture failed for "${id}"`,
        err,
      );
      return null;
    } finally {
      clone?.remove();
    }
  };
}
