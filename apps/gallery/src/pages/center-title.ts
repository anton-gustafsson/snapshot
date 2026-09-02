import { getDefaultSnapshotService } from '@anton-gustafsson/snapshot-core';
import { DASHBOARDS, makeClickableNavList, pageHeader } from '../gallery-shared';

export const path = '/center-title';
export const label = 'Center title';

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Center title',
    '<code>label-position="center"</code> — title centered over the image. ' +
      'Click a card to open its dashboard; coming back captures a real snapshot for the thumbnail.',
  );
  container.append(
    makeClickableNavList(
      DASHBOARDS.slice(0, 3),
      { variant: 'tile', 'label-position': 'center' },
      getDefaultSnapshotService(),
      'center-title',
      path,
      label,
    ),
  );
}
