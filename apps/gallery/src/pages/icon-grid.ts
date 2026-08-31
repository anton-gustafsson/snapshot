import { snapshotService } from 'snapshot-core';
import { DASHBOARDS, makeClickableNavList, pageHeader } from '../gallery-shared';

export const path = '/icon-grid';
export const label = 'Icon grid';

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Icon grid',
    'Default <code>variant="icon-only"</code> — a contact-sheet grid, caption pinned to the bottom of each frame. ' +
      'Click a card to open its dashboard; coming back captures a real snapshot for the thumbnail.',
  );
  container.append(
    makeClickableNavList(DASHBOARDS, { variant: 'icon-only' }, snapshotService, 'icon-grid', path, label),
  );
}
