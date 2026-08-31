import { snapshotService } from 'snapshot-core';
import { DASHBOARDS, makeClickableNavList, pageHeader } from '../gallery-shared';

export const path = '/big-tiles';
export const label = 'Big tiles';

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Big tiles',
    'Same variant, larger frames via <code>--snapshot-nav-list-tile-width</code> / <code>-height</code>. ' +
      'Click a card to open its dashboard; coming back captures a real snapshot for the thumbnail.',
  );
  const bigTiles = makeClickableNavList(
    DASHBOARDS.slice(0, 4),
    { variant: 'icon-only' },
    snapshotService,
    'big-tiles',
    path,
    label,
  );
  bigTiles.style.setProperty('--snapshot-nav-list-tile-width', '260px');
  bigTiles.style.setProperty('--snapshot-nav-list-tile-height', '170px');
  container.append(bigTiles);
}
