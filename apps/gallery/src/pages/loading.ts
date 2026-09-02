import { SnapshotService } from '@anton-gustafsson/snapshot-core';
import { DASHBOARDS, DelayedProceduralStorage, makeClickableNavList, pageHeader, resetSpinnerButton } from '../gallery-shared';

export const path = '/loading';
export const label = 'Loading state';

const LOADING_ITEMS = DASHBOARDS.slice(0, 4);
const loadingService = new SnapshotService({
  storage: new DelayedProceduralStorage(2200),
  keyPrefix: 'gallery-loading',
});

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Loading state',
    'Backed by a deliberately slow storage — watch the spinner before the thumbnails resolve. ' +
      'Click a card to open its dashboard; coming back captures a real snapshot (still behind the same delay).',
  );

  const loadingNavList = makeClickableNavList(
    LOADING_ITEMS,
    { variant: 'tile' },
    loadingService,
    'loading',
    path,
    label,
  );

  // invalidate()s each item's cached thumbnail (via the service, so the
  // nav-list's live-update subscription picks it up) and reassigns `items`
  // to a fresh array reference — `items` is only re-fetched when Lit sees
  // the array reference change, so a same-reference reassignment wouldn't
  // retrigger the loadThumb() that shows the spinner again.
  container.append(resetSpinnerButton(LOADING_ITEMS, loadingService, loadingNavList, 'loading'), loadingNavList);
}
