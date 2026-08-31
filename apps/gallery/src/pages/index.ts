export interface GalleryPage {
  path: string;
  label: string;
  load: () => Promise<{ render(container: HTMLElement): void }>;
}

// Each entry lazy-loads its module on first visit — the two SQLite pages
// pull in sql.js's ~650KB WASM binary, which visitors who never click those
// links shouldn't have to download.
export const pages: GalleryPage[] = [
  { path: '/icon-grid', label: 'Icon grid', load: () => import('./icon-grid') },
  { path: '/big-tiles', label: 'Big tiles', load: () => import('./big-tiles') },
  { path: '/center-title', label: 'Center title', load: () => import('./center-title') },
  { path: '/overlay', label: 'Overlay tint', load: () => import('./overlay') },
  { path: '/config-builder', label: 'Config builder', load: () => import('./config-builder') },
  { path: '/theming', label: 'Theming', load: () => import('./theming') },
  { path: '/loading', label: 'Loading state', load: () => import('./loading') },
  { path: '/list-variant', label: 'List variant', load: () => import('./list-variant') },
  { path: '/text-combos', label: 'Text & edit', load: () => import('./text-combos') },
  { path: '/elevation', label: 'Elevation', load: () => import('./elevation') },
  { path: '/sqlite', label: 'SQLite + IndexedDB preload', load: () => import('./sqlite') },
  { path: '/sqlite-only', label: 'SQLite only', load: () => import('./sqlite-only') },
];
