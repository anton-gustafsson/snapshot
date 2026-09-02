import { SnapshotService } from '@anton-gustafsson/snapshot-core';
import type { NavItem, SnapshotStorage } from '@anton-gustafsson/snapshot-core';
import { codeSnippet, lightDarkPreview, makeNavList, pageHeader, randomDashboardImage, sectionTitle } from '../gallery-shared';

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
  async remove() {}
}

const cardService = new SnapshotService({ storage: new MockDashboardStorage(), keyPrefix: 'gallery-dashboard-card' });

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Dashboard preview card',
    'The library\'s own <code>variant="card"</code>: a contained (never-cropped) screenshot with real title/description text below it — never overlaid, so it needs no tint. Colors come from <code>currentColor</code>, the same as every other variant, so it already follows light/dark automatically.',
  );

  sectionTitle(container, 'Light & dark, side by side');
  lightDarkPreview(container, CARDS.slice(0, 1), { variant: 'card' }, cardService);

  const note = document.createElement('p');
  note.className = 'dash-card-note';
  note.textContent = 'No overlay-tint, no theme attribute — the card border/background/shadow are all currentColor-derived, so a dark host just works.';
  container.append(note);

  sectionTitle(container, 'In a grid');
  container.append(makeNavList(CARDS, { variant: 'card' }, cardService));

  sectionTitle(container, 'Markup');
  codeSnippet(
    container,
    `<snapshot-nav-list variant="card"></snapshot-nav-list>

nav.items = [
  { id: 'apc', label: 'APC', description: 'Check current state of passenger flow.' },
  // ...
];`,
  );
}
