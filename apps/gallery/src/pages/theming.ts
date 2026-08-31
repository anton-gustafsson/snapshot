import { DASHBOARDS, makeNavList, pageHeader } from '../gallery-shared';

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

function swatchRow<T extends { name: string }>(
  container: HTMLElement,
  entries: T[],
  apply: (nav: HTMLElement, entry: T) => void,
) {
  const row = document.createElement('div');
  row.className = 'overlay-row';
  for (const entry of entries) {
    const wrap = document.createElement('div');
    wrap.className = 'overlay-cell';
    const caption = document.createElement('p');
    caption.className = 'overlay-caption';
    caption.textContent = entry.name;
    const nav = makeNavList([DASHBOARDS[0]], { variant: 'icon-only' });
    apply(nav, entry);
    wrap.append(caption, nav);
    row.append(wrap);
  }
  container.append(row);
}

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Theming',
    'Every visual knob is a CSS custom property set on the host element — no shadow-DOM piercing needed.',
  );

  const h3a = document.createElement('h3');
  h3a.textContent = 'Primary color';
  const pa = document.createElement('p');
  pa.innerHTML =
    '<code>--snapshot-nav-list-accent</code> drives the focus outline and the corner registration marks — hover or tab to a tile to see it.';
  container.append(h3a, pa);
  swatchRow(container, ACCENTS, (nav, accent) => {
    nav.style.setProperty('--snapshot-nav-list-accent', accent.value);
  });

  const h3b = document.createElement('h3');
  h3b.textContent = 'Border radius';
  const pb = document.createElement('p');
  pb.innerHTML =
    '<code>--snapshot-nav-list-radius</code> (tile) and <code>--snapshot-nav-list-radius-sm</code> (thumb) — set both together so the frame and image corners stay in sync.';
  container.append(h3b, pb);
  swatchRow(container, RADII, (nav, r) => {
    nav.style.setProperty('--snapshot-nav-list-radius', r.radius);
    nav.style.setProperty('--snapshot-nav-list-radius-sm', r.radiusSm);
  });
}
