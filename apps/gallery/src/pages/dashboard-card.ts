import { SnapshotService } from '@anton-gustafsson/snapshot-core';
import type { NavItem, SnapshotStorage } from '@anton-gustafsson/snapshot-core';
import { makeNavList, pageHeader, randomDashboardImage } from '../gallery-shared';

export const path = '/dashboard-card';
export const label = 'Dashboard preview card';

const CARDS: NavItem[] = [
  { id: 'apc', label: 'APC', description: 'Check current state of passenger flow.' },
  { id: 'punctuality', label: 'Punctuality', description: 'Track on-time performance across every line.' },
  { id: 'fleet', label: 'Fleet health', description: 'Monitor vehicle availability and open faults.' },
];

/** Believable dashboard screenshots instead of the usual gradient blob, so the contained (never-cropped) preview reads as a real chart layout. */
class MockDashboardStorage implements SnapshotStorage {
  async save() {
    return randomDashboardImage();
  }
  async load() {
    return randomDashboardImage();
  }
}

const cardService = new SnapshotService({ storage: new MockDashboardStorage(), keyPrefix: 'gallery-dashboard-card' });

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Dashboard preview card',
    'The library\'s own <code>variant="card"</code>: a contained (never-cropped) screenshot with real title/description text below it — never overlaid, so it needs no tint. Colors come from <code>currentColor</code>, the same as every other variant, so it already follows light/dark automatically.',
  );

  const h3 = document.createElement('h3');
  h3.textContent = 'Light & dark, side by side';
  container.append(h3);

  const previewRow = document.createElement('div');
  previewRow.className = 'config-preview-row';
  for (const theme of ['light', 'dark'] as const) {
    const panel = document.createElement('div');
    panel.className = `config-preview-panel config-preview-${theme}`;
    const caption = document.createElement('p');
    caption.className = 'config-preview-caption';
    caption.textContent = theme;
    panel.append(caption, makeNavList(CARDS.slice(0, 1), { variant: 'card' }, cardService));
    previewRow.append(panel);
  }
  container.append(previewRow);

  const note = document.createElement('p');
  note.className = 'dash-card-note';
  note.textContent = 'No overlay-tint, no theme attribute — the card border/background/shadow are all currentColor-derived, so a dark host just works.';
  container.append(note);

  const h3b = document.createElement('h3');
  h3b.textContent = 'In a grid';
  container.append(h3b);
  container.append(makeNavList(CARDS, { variant: 'card' }, cardService));

  const h3c = document.createElement('h3');
  h3c.textContent = 'Markup';
  container.append(h3c);
  const pre = document.createElement('pre');
  pre.className = 'config-snippet';
  const code = document.createElement('code');
  code.textContent = `<snapshot-nav-list variant="card"></snapshot-nav-list>

nav.items = [
  { id: 'apc', label: 'APC', description: 'Check current state of passenger flow.' },
  // ...
];`;
  pre.append(code);
  container.append(pre);
}
