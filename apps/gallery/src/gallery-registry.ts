import type { SnapshotService } from '@snapshot/core';

export interface CaptureTarget {
  /** The service a captured dashboard should be saved through — whichever the source page itself uses. */
  service: SnapshotService;
  backPath: string;
  backLabel: string;
}

/**
 * Keyed by the URL segment identifying which example page linked to
 * `/dashboard/:page/:id` — populated by each clickable page's module as it
 * loads (see `makeClickableNavList`), read by the dashboard route to know
 * which service to capture through and where "back" goes.
 */
export const captureTargets = new Map<string, CaptureTarget>();

export function registerCaptureTarget(key: string, target: CaptureTarget) {
  captureTargets.set(key, target);
}
