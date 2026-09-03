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

/**
 * A consumer-supplied icon, to show `edit-icon` taking markup rather than a text glyph.
 * Material Symbols renders "more_vert" as a ligature — the @font-face is global (see
 * index.html) so the font reaches inside the shadow root, but the `.material-symbols-outlined`
 * class does not: the font-family is applied through ::part(edit-button) in style.css.
 */
const MORE_VERT_ICON =
  '<span class="material-symbols-outlined" title="Row actions" aria-label="Row actions">more_vert</span>';

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

  const h3d = document.createElement('h3');
  h3d.textContent = 'Edit button placement';
  container.append(h3d);
  const editNote = document.createElement('p');
  editNote.innerHTML =
    '<code>edit-button-position="overlay"</code> (default) floats the button over the preview and reveals it on hover; ' +
    '<code>edit-button-position="meta"</code> pins it to the right edge on the title line, description below — always visible. ' +
    '<code>edit-icon</code> takes a glyph or raw markup — the second card below passes a Material Symbols ' +
    '<code>&lt;span&gt;</code> (the font-family reaches it via <code>::part(edit-button)</code>, since outer classes ' +
    'do not cross the shadow boundary), ' +
    'and the third restyles the button through <code>::part(edit-button)</code>: no background, bigger icon.';
  container.append(editNote);

  for (const { caption, attrs, className } of [
    { caption: 'overlay (default)', attrs: { variant: 'card', editable: '' } },
    {
      caption: 'meta + custom Material Symbols icon',
      attrs: { variant: 'card', editable: '', 'edit-button-position': 'meta', 'edit-icon': MORE_VERT_ICON },
      className: 'dash-card-symbol-edit',
    },
    {
      // Nothing library-side needed for this look — the button is exposed as
      // ::part(edit-button), so a host can drop the chip background and scale
      // the icon from its own stylesheet.
      caption: 'no background + bigger icon (::part(edit-button))',
      attrs: { variant: 'card', editable: '', 'edit-button-position': 'meta', 'edit-icon': MORE_VERT_ICON },
      className: 'dash-card-symbol-edit dash-card-bare-edit',
    },
  ] as const) {
    const h4 = document.createElement('h4');
    h4.textContent = caption;
    const list = makeNavList(CARDS.slice(0, 2), { ...attrs }, cardService);
    if (className) list.className = className;
    list.addEventListener('nav-edit', ((e: CustomEvent<{ id: string }>) => {
      console.log(`nav-edit: ${e.detail.id}`);
    }) as EventListener);
    container.append(h4, list);
  }

  const h3c = document.createElement('h3');
  h3c.textContent = 'Markup';
  container.append(h3c);
  const pre = document.createElement('pre');
  pre.className = 'config-snippet';
  const code = document.createElement('code');
  code.textContent = `<snapshot-nav-list variant="card"></snapshot-nav-list>

<!-- edit button beside the text instead of over the preview, with your own icon -->
<snapshot-nav-list
  variant="card"
  editable
  edit-button-position="meta"
  edit-icon='<span class="material-symbols-outlined">more_vert</span>'
></snapshot-nav-list>

<!-- the class itself cannot cross the shadow boundary; style the part instead -->
<style>
snapshot-nav-list::part(edit-button) {
  font-family: 'Material Symbols Outlined';
  font-size: 1.25rem;
}
</style>

<!-- bare, oversized icon button — restyled from outside the shadow root -->
<style>
snapshot-nav-list.bare-edit::part(edit-button) {
  width: 2rem;
  height: 2rem;
  background: none;
  border-radius: 0;
  font-size: 1.5rem;
  opacity: 0.65;
}
snapshot-nav-list.bare-edit::part(edit-button):hover {
  background: none;
  opacity: 1;
}
</style>

nav.items = [
  { id: 'apc', label: 'APC', description: 'Check current state of passenger flow.' },
  // ...
];`;
  pre.append(code);
  container.append(pre);
}
