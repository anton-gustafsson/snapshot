import { snapshotService } from '@anton-gustafsson/snapshot-core';
import { DASHBOARDS, makeClickableNavList, pageHeader } from '../gallery-shared';

export const path = '/center-title';
export const label = 'Center title';

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Center title',
    '<code>label-position="center"</code> — frame number pinned to the corner, title centered over the image. ' +
      'Click a card to open its dashboard; coming back captures a real snapshot for the thumbnail.',
  );
  container.append(
    makeClickableNavList(
      DASHBOARDS.slice(0, 3),
      { variant: 'icon-only', 'label-position': 'center' },
      snapshotService,
      'center-title',
      path,
      label,
    ),
  );
}
