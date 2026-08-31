import { snapshotService } from '@anton-gustafsson/snapshot-core';
import { DASHBOARDS, makeClickableNavList, pageHeader } from '../gallery-shared';

export const path = '/list-variant';
export const label = 'List variant';

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'List variant',
    '<code>variant="list"</code> — compact rows for a narrow sidebar, label beside the thumb. ' +
      'Click a row to open its dashboard; coming back captures a real snapshot for the thumbnail.',
  );
  container.append(
    makeClickableNavList(DASHBOARDS, { variant: 'list' }, snapshotService, 'list-variant', path, label),
  );
}
