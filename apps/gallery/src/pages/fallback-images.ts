import { SnapshotService } from '@anton-gustafsson/snapshot-core';
import type { SnapshotKey, SnapshotStorage } from '@anton-gustafsson/snapshot-core';
import {
  DASHBOARDS,
  captionedRow,
  codeSnippet,
  makeNavList,
  pageHeader,
  sectionTitle,
  strokeIcon,
  type GalleryItem,
} from '../gallery-shared';

export const path = '/fallback-images';
export const label = 'Fallback images';

/**
 * Nothing is ever stored or found, so every card here stays in its
 * pre-capture state — which is the entire subject of this page. The other
 * gallery pages use `ProceduralStorage`, which always answers with an image.
 */
class EmptyStorage implements SnapshotStorage {
  async save() {
    return '';
  }
  async load() {
    return null;
  }
  async remove() {}
  async loadMany(keys: SnapshotKey[]): Promise<Map<string, string | null>> {
    return new Map(keys.map((k) => [k.key, null] as [string, string | null]));
  }
}

const emptyService = new SnapshotService({ storage: new EmptyStorage(), keyPrefix: 'gallery-fallback:' });

const IMAGE_ICON = strokeIcon(
  '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
);

interface Variant {
  caption: string;
  item: GalleryItem;
  /** Attributes on the nav-list itself — `placeholder-text` lives here when every card shares one. */
  attrs?: Record<string, string>;
}

const [sales, inventory, support, ops] = DASHBOARDS;

const VARIANTS: Variant[] = [
  {
    caption: 'nothing set — the hatch',
    item: { ...sales, icon: undefined },
  },
  {
    caption: 'placeholder-text only',
    item: { ...inventory, icon: undefined },
    attrs: { 'placeholder-text': 'no snapshot yet' },
  },
  {
    caption: 'icon markup (svg)',
    item: support,
  },
  {
    caption: 'icon + caption',
    item: { ...ops, icon: IMAGE_ICON, placeholderText: 'not visited yet' },
  },
];

const SNIPPET = `// icon is markup — an <svg>, an <img>, anything. A bare emoji is ignored.
nav.items = [
  { id: 'support', label: 'Support', icon: '<svg>...</svg>' },
  { id: 'ops', label: 'Operations', placeholderText: 'not visited yet' },
];

// one caption for every uncaptured card in the list
nav.setAttribute('placeholder-text', 'no snapshot yet');`;

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Fallback images',
    'What fills a card before its first capture. Every list on this page is wired to a storage that ' +
      'never returns anything, so the frames stay empty on purpose. ' +
      '<code>NavItem.icon</code> takes markup only — an <code>&lt;svg&gt;</code> or an <code>&lt;img&gt;</code> ' +
      'of your own art; a bare emoji is ignored (it used to render as a stray character), so words belong in ' +
      '<code>placeholder-text</code> instead.',
  );

  captionedRow(
    container,
    VARIANTS,
    (v) => v.caption,
    (v) => makeNavList([v.item], v.attrs ?? {}, emptyService),
  );

  sectionTitle(
    container,
    'In code',
    'The frame is themeable from outside the shadow root: ' +
      '<code>--snapshot-nav-list-placeholder-icon-size</code> / <code>-icon-opacity</code> / ' +
      '<code>-icon-fit</code> size the icon, <code>-hatch</code> and <code>-bg</code> cover the frame itself, ' +
      'and <code>::part(placeholder-icon)</code> / <code>::part(placeholder-text)</code> catch the rest.',
  );
  codeSnippet(container, SNIPPET);
}
