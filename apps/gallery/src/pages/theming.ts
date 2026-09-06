import { DASHBOARDS, captionedRow, makeNavList, pageHeader, sectionTitle } from '../gallery-shared';

export const path = '/theming';
export const label = 'Theming';

const ACCENTS = [
  { name: 'Orange (default)', value: '#ff5a1f' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
];

const RADII = [
  { name: 'Square', radius: '0px', radiusSm: '0px' },
  { name: 'Default', radius: '10px', radiusSm: '7px' },
  { name: 'Rounded', radius: '18px', radiusSm: '14px' },
  { name: 'Pill', radius: '32px', radiusSm: '24px' },
];

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Theming',
    'Every visual knob is a CSS custom property set on the host element — no shadow-DOM piercing needed.',
  );

  sectionTitle(
    container,
    'Primary color',
    '<code>--snapshot-nav-list-accent</code> drives the focus outline and the corner registration marks — hover or tab to a tile to see it.',
  );
  captionedRow(
    container,
    ACCENTS,
    (accent) => accent.name,
    (accent) => {
      const nav = makeNavList([DASHBOARDS[0]], { variant: 'tile' });
      nav.style.setProperty('--snapshot-nav-list-accent', accent.value);
      return nav;
    },
  );

  sectionTitle(
    container,
    'Border radius',
    '<code>--snapshot-nav-list-radius</code> (tile) and <code>--snapshot-nav-list-radius-sm</code> (thumb) — set both together so the frame and image corners stay in sync.',
  );
  captionedRow(
    container,
    RADII,
    (r) => r.name,
    (r) => {
      const nav = makeNavList([DASHBOARDS[0]], { variant: 'tile' });
      nav.style.setProperty('--snapshot-nav-list-radius', r.radius);
      nav.style.setProperty('--snapshot-nav-list-radius-sm', r.radiusSm);
      return nav;
    },
  );
}
