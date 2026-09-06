export interface GalleryPage {
  path: string;
  label: string;
  load: () => Promise<{ render(container: HTMLElement): void }>;
}

// Each entry lazy-loads its module on first visit — the two SQLite pages
// pull in sql.js's ~650KB WASM binary, which visitors who never click those
// links shouldn't have to download.
export const pages: GalleryPage[] = [
  { path: '/variants', label: 'Layout variants', load: () => import('./variants') },
  { path: '/overlay', label: 'Overlay tint', load: () => import('./overlay') },
  { path: '/config-builder', label: 'Config builder', load: () => import('./config-builder') },
  { path: '/theming', label: 'Theming', load: () => import('./theming') },
  { path: '/loading', label: 'Loading state', load: () => import('./loading') },
  { path: '/text-combos', label: 'Text & edit', load: () => import('./text-combos') },
  { path: '/elevation', label: 'Elevation', load: () => import('./elevation') },
  { path: '/dashboard-card', label: 'Dashboard preview card', load: () => import('./dashboard-card') },
  { path: '/remote-storage', label: 'Remote storage', load: () => import('./remote-storage') },
  { path: '/sqlite', label: 'SQLite + IndexedDB preload', load: () => import('./sqlite') },
  { path: '/sqlite-only', label: 'SQLite only', load: () => import('./sqlite-only') },
];
