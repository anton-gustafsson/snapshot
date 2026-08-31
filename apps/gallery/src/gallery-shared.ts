import '@snapshot/core';
import { SnapshotService, IndexedDbSnapshotStorage } from '@snapshot/core';
import type { NavItem, SnapshotStorage } from '@snapshot/core';
import { router } from './router';
import { registerCaptureTarget } from './gallery-registry';

/**
 * Renders a deterministic gradient "photo" per id — so every example on this
 * page shows a real image without needing a live capture target or network
 * access. Not part of the library; purely for this gallery.
 */
export function proceduralCanvas(seed: string, width = 480, height = 300, badge?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${hue} 70% 42%)`);
  gradient.addColorStop(1, `hsl(${(hue + 50) % 360} 70% 30%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc((hash * (i + 3)) % width, (hash * (i + 7)) % height, 40 + (i * hash) % 60, 0, Math.PI * 2);
    ctx.fill();
  }
  if (badge) {
    ctx.font = `700 ${Math.round(height * 0.11)}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, ctx.measureText(badge).width + 20, height * 0.16 + 14);
    ctx.fillStyle = '#fff';
    ctx.fillText(badge, 10, 8);
  }
  return canvas;
}

export function proceduralImage(seed: string, width = 480, height = 300, badge?: string): string {
  return proceduralCanvas(seed, width, height, badge).toDataURL('image/png');
}

export function proceduralBlob(seed: string, width = 480, height = 300, badge?: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    proceduralCanvas(seed, width, height, badge).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      'image/png',
    );
  });
}

/** Always resolves instantly with a generated image — no real capture/storage involved. */
export class ProceduralStorage implements SnapshotStorage {
  async save(id: string) {
    return proceduralImage(id);
  }
  async load(id: string) {
    return proceduralImage(id);
  }
}

/**
 * Same delay as above, but real captures are actually persisted (via a
 * wrapped IndexedDbSnapshotStorage) instead of discarded — falls back to a
 * generated image only for an id nothing's ever been captured for. That way
 * the artificial delay/spinner stays real even after this page's cards are
 * made clickable and start holding real dashboard captures.
 */
export class DelayedProceduralStorage implements SnapshotStorage {
  private real = new IndexedDbSnapshotStorage();
  constructor(private delayMs: number) {}
  save(id: string, blob: Blob) {
    return this.real.save(id, blob);
  }
  async load(id: string) {
    await new Promise((r) => setTimeout(r, this.delayMs));
    return (await this.real.load(id)) ?? proceduralImage(id);
  }
  remove(id: string) {
    return this.real.remove(id);
  }
}

export const instantService = new SnapshotService({ storage: new ProceduralStorage(), keyPrefix: 'gallery-instant' });

export const DASHBOARDS: NavItem[] = [
  { id: 'sales', label: 'Sales', icon: '📈' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'support', label: 'Support', icon: '🎧' },
  { id: 'ops', label: 'Operations', icon: '⚙' },
  { id: 'weather', label: 'Weather', icon: '☀' },
  { id: 'signups', label: 'Signups', icon: '✦' },
];

export function makeNavList(
  items: NavItem[],
  attrs: Record<string, string> = {},
  service: SnapshotService = instantService,
) {
  const el = document.createElement('snapshot-nav-list');
  el.items = items;
  el.snapshotService = service;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  return el;
}

/**
 * Same as `makeNavList`, but each item routes to `/dashboard/{pageKey}/{id}`
 * — clicking it opens an auto-generated dashboard; navigating back captures
 * it through `service` (whichever storage that page is demonstrating) and
 * the card shows the real capture from then on. Registers `pageKey` so the
 * dashboard route knows where "back" goes and which service to capture
 * through. Icons are dropped: before a card's first capture it's just the
 * placeholder hatch, which is the point — click it to give it a real look.
 */
export function toClickableItems(items: NavItem[], pageKey: string): NavItem[] {
  return items.map(({ icon: _icon, ...item }) => ({
    ...item,
    route: `/dashboard/${pageKey}/${item.id}`,
  }));
}

export function makeClickableNavList(
  items: NavItem[],
  attrs: Record<string, string>,
  service: SnapshotService,
  pageKey: string,
  backPath: string,
  backLabel: string,
) {
  registerCaptureTarget(pageKey, { service, backPath, backLabel });
  const el = makeNavList(toClickableItems(items, pageKey), attrs, service);
  el.addEventListener('nav-select', ((e: CustomEvent<{ route?: string }>) => {
    if (e.detail.route) router.navigate(e.detail.route);
  }) as EventListener);
  return el;
}

/** Standard page chrome: an <h2>/<p> pair, then whatever else the page appends. */
export function pageHeader(container: HTMLElement, title: string, descriptionHtml: string) {
  const h2 = document.createElement('h2');
  h2.textContent = title;
  const p = document.createElement('p');
  p.innerHTML = descriptionHtml;
  container.append(h2, p);
}
