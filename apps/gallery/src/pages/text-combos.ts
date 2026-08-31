import { DASHBOARDS, makeNavList, pageHeader } from '../gallery-shared';
import type { NavItem } from '@anton-gustafsson/snapshot-core';

export const path = '/text-combos';
export const label = 'Text & edit';

const LONG_DESCRIPTION =
  'A description long enough to get clipped by the ellipsis instead of wrapping or overflowing the card.';

function withDescription(item: NavItem, description?: string): NavItem {
  return description === undefined ? { ...item } : { ...item, description };
}

interface Combo {
  caption: string;
  items: NavItem[];
  attrs: Record<string, string>;
}

const COMBOS: Combo[] = [
  {
    caption: 'label only',
    items: [withDescription(DASHBOARDS[0])],
    attrs: { variant: 'list' },
  },
  {
    caption: 'label + description',
    items: [withDescription(DASHBOARDS[1], 'Stock levels across every warehouse')],
    attrs: { variant: 'list' },
  },
  {
    caption: 'label + long description (truncates)',
    items: [withDescription(DASHBOARDS[2], LONG_DESCRIPTION)],
    attrs: { variant: 'list' },
  },
  {
    caption: 'editable (hover for the edit button)',
    items: [withDescription(DASHBOARDS[3], 'Fleet health and throughput')],
    attrs: { variant: 'list', editable: '' },
  },
  {
    caption: 'icon-only + description',
    items: [withDescription(DASHBOARDS[4], 'Regional forecast widgets')],
    attrs: { variant: 'icon-only' },
  },
  {
    caption: 'icon-only + description + editable',
    items: [withDescription(DASHBOARDS[5], 'New signups this week')],
    attrs: { variant: 'icon-only', editable: '' },
  },
];

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Text & edit',
    'Combinations of <code>description</code> and <code>editable</code> across variants. ' +
      'These cards aren\'t wired to a dashboard route — this page is about the text and the edit button, not navigation. ' +
      'Editing fires <code>nav-edit</code> instead of <code>nav-select</code>; nothing here listens for it beyond a console log.',
  );

  const row = document.createElement('div');
  row.className = 'overlay-row';
  for (const combo of COMBOS) {
    const wrap = document.createElement('div');
    wrap.className = 'overlay-cell';
    const caption = document.createElement('p');
    caption.className = 'overlay-caption';
    caption.textContent = combo.caption;
    const el = makeNavList(combo.items, combo.attrs);
    el.addEventListener('nav-edit', ((e: CustomEvent<{ id: string }>) => {
      console.log(`nav-edit: ${e.detail.id}`);
    }) as EventListener);
    wrap.append(caption, el);
    row.append(wrap);
  }
  container.append(row);
}
