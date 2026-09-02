import '@anton-gustafsson/snapshot-core';
import { SnapshotService, IndexedDbSnapshotStorage } from '@anton-gustafsson/snapshot-core';
import type { NavItem, SnapshotKey, SnapshotNavList, SnapshotStorage } from '@anton-gustafsson/snapshot-core';
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

const DASHBOARD_TITLES = [
  'Revenue', 'Active users', 'Conversion', 'Latency p95', 'Signups',
  'Churn', 'Retention', 'Errors / min', 'Sessions', 'Throughput',
];

const DASHBOARD_PALETTES = [
  { bg: '#0b3d91', text: '#eaf1ff', accent: '#5ac8fa' },
  { bg: '#14532d', text: '#eafff1', accent: '#4ade80' },
  { bg: '#4c1d95', text: '#f4ecff', accent: '#c084fc' },
  { bg: '#7c2d12', text: '#fff3ea', accent: '#fb923c' },
  { bg: '#111827', text: '#f1f5f9', accent: '#38bdf8' },
  { bg: '#831843', text: '#ffe9f3', accent: '#f472b6' },
];

const CHART_ACCENTS = ['#5ac8fa', '#4ade80', '#c084fc', '#fb923c', '#f472b6', '#facc15'];

function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawBarChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  const bars = 5 + Math.floor(Math.random() * 3);
  const gap = (w / bars) * 0.3;
  const barW = w / bars - gap;
  ctx.fillStyle = color;
  for (let i = 0; i < bars; i++) {
    const barH = h * (0.25 + Math.random() * 0.75);
    ctx.globalAlpha = 0.5 + (i / bars) * 0.5;
    ctx.fillRect(x + i * (barW + gap), y + (h - barH), barW, barH);
  }
  ctx.globalAlpha = 1;
}

function drawLineChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  const points = 7;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, h * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, y + h * (0.3 + Math.random() * 0.4));
  for (let i = 1; i <= points; i++) {
    ctx.lineTo(x + (w / points) * i, y + h * (0.1 + Math.random() * 0.8));
  }
  ctx.stroke();
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.15;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawPieChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2;
  const slices = 3 + Math.floor(Math.random() * 2);
  const weights = Array.from({ length: slices }, () => 0.3 + Math.random() * 0.7);
  const total = weights.reduce((a, b) => a + b, 0);
  let start = -Math.PI / 2;
  for (let i = 0; i < slices; i++) {
    const slice = (weights[i] / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4 + (i / slices) * 0.6;
    ctx.fill();
    start += slice;
  }
  ctx.globalAlpha = 1;
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  textColor: string,
) {
  const value = (Math.random() * 900 + 100).toFixed(0);
  ctx.fillStyle = textColor;
  ctx.textBaseline = 'top';
  ctx.font = `700 ${Math.round(h * 0.42)}px system-ui, sans-serif`;
  ctx.fillText(value, x, y + h * 0.05);
  const delta = Math.random() * 24 - 6;
  ctx.font = `500 ${Math.round(h * 0.24)}px system-ui, sans-serif`;
  ctx.fillStyle = delta >= 0 ? '#4ade80' : '#f87171';
  ctx.fillText(`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`, x, y + h * 0.55);
  // tiny sparkline underneath, in the panel's own accent
  drawLineChart(ctx, x, y + h * 0.8, w, h * 0.2, color);
}

const WIDGET_KINDS = ['bar', 'line', 'donut', 'stat'] as const;

/**
 * A believable multi-widget dashboard screenshot — a header plus a 2x2 grid
 * of mini panels, each a different chart type in its own accent color — all
 * drawn on canvas so it's random and free, but reads like a real dashboard
 * instead of an abstract gradient blob. Meant to be regenerated on demand
 * (see the config-builder's "Randomize" button) to eyeball overlay/caption
 * legibility against varied real-looking content.
 */
export function randomDashboardImage(width = 480, height = 300): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const palette = DASHBOARD_PALETTES[Math.floor(Math.random() * DASHBOARD_PALETTES.length)];

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);

  const title = DASHBOARD_TITLES[Math.floor(Math.random() * DASHBOARD_TITLES.length)];
  ctx.fillStyle = palette.text;
  ctx.textBaseline = 'top';
  ctx.font = `600 ${Math.round(height * 0.075)}px system-ui, sans-serif`;
  ctx.fillText(title, width * 0.05, height * 0.05);

  const kinds = shuffled(WIDGET_KINDS);
  const accents = shuffled(CHART_ACCENTS);
  const pad = width * 0.05;
  const gridTop = height * 0.18;
  const cellW = (width - pad * 3) / 2;
  const cellH = (height - gridTop - pad * 2) / 2;

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (cellW + pad);
    const y = gridTop + row * (cellH + pad);
    const accent = accents[i % accents.length];

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(x, y, cellW, cellH, Math.min(8, cellH * 0.08));
    ctx.fill();

    const inset = Math.min(cellW, cellH) * 0.14;
    const label = DASHBOARD_TITLES[Math.floor(Math.random() * DASHBOARD_TITLES.length)];
    ctx.fillStyle = palette.text;
    ctx.globalAlpha = 0.75;
    ctx.font = `500 ${Math.round(cellH * 0.14)}px system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + inset, y + inset * 0.6);
    ctx.globalAlpha = 1;

    const chartY = y + inset * 2.2;
    const chartX = x + inset;
    const chartW = cellW - inset * 2;
    const chartH = cellH - inset * 2.8;

    switch (kinds[i]) {
      case 'bar':
        drawBarChart(ctx, chartX, chartY, chartW, chartH, accent);
        break;
      case 'line':
        drawLineChart(ctx, chartX, chartY, chartW, chartH, accent);
        break;
      case 'donut':
        drawPieChart(ctx, chartX, chartY, chartW, chartH, accent);
        break;
      case 'stat':
        drawStat(ctx, chartX, chartY, chartW, chartH, accent, palette.text);
        break;
    }
  }

  return canvas.toDataURL('image/png');
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
  async save(_blob: Blob, key: SnapshotKey) {
    return proceduralImage(key.id);
  }
  async load(key: SnapshotKey) {
    return proceduralImage(key.id);
  }
  async remove() {}
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
  save(blob: Blob, key: SnapshotKey) {
    return this.real.save(blob, key);
  }
  async load(key: SnapshotKey) {
    await new Promise((r) => setTimeout(r, this.delayMs));
    return (await this.real.load(key)) ?? proceduralImage(key.id);
  }
  remove(key: SnapshotKey) {
    return this.real.remove(key);
  }
}

export const instantService = new SnapshotService({ storage: new ProceduralStorage(), keyPrefix: 'gallery-instant' });

/** What the gallery hangs off `NavItem.data` — the route a click should follow. */
export interface GalleryItemData {
  route: string;
}

export type GalleryItem = NavItem<GalleryItemData>;

export const DASHBOARDS: GalleryItem[] = [
  { id: 'sales', label: 'Sales', icon: '📈' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'support', label: 'Support', icon: '🎧' },
  { id: 'ops', label: 'Operations', icon: '⚙' },
  { id: 'weather', label: 'Weather', icon: '☀' },
  { id: 'signups', label: 'Signups', icon: '✦' },
];

export function makeNavList<T>(
  items: NavItem<T>[],
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
export function toClickableItems(items: GalleryItem[], pageKey: string): GalleryItem[] {
  return items.map(({ icon: _icon, ...item }) => ({
    ...item,
    // `data` (not the deprecated `route`) — the whole item comes back on
    // nav-select, so the handler reads the route straight off the event.
    data: { route: `/dashboard/${pageKey}/${item.id}` },
  }));
}

export function makeClickableNavList(
  items: GalleryItem[],
  attrs: Record<string, string>,
  service: SnapshotService,
  pageKey: string,
  backPath: string,
  backLabel: string,
) {
  registerCaptureTarget(pageKey, { service, backPath, backLabel });
  const el = makeNavList(toClickableItems(items, pageKey), attrs, service);
  el.addEventListener('nav-select', ((e: CustomEvent<GalleryItem>) => {
    const route = e.detail.data?.route;
    if (route) router.navigate(route);
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

/** An <h3> sub-heading plus an optional <p> (HTML allowed) under it — pageHeader's h2/p pairing, one size down, for a section within a page. */
export function sectionTitle(container: HTMLElement, title: string, html?: string) {
  const h3 = document.createElement('h3');
  h3.textContent = title;
  container.append(h3);
  if (html !== undefined) {
    const p = document.createElement('p');
    p.innerHTML = html;
    container.append(p);
  }
}

/** A row of captioned cells — `.overlay-row` > `.overlay-cell` > caption + whatever `build` returns. The shape every page that lines up small labeled variants side by side needs. */
export function captionedRow<T>(
  container: HTMLElement,
  entries: readonly T[],
  caption: (entry: T) => string,
  build: (entry: T) => HTMLElement,
) {
  const row = document.createElement('div');
  row.className = 'overlay-row';
  for (const entry of entries) {
    const cell = document.createElement('div');
    cell.className = 'overlay-cell';
    const p = document.createElement('p');
    p.className = 'overlay-caption';
    p.textContent = caption(entry);
    cell.append(p, build(entry));
    row.append(cell);
  }
  container.append(row);
}

/**
 * Side-by-side "Light"/"Dark" preview panels — `.config-preview-row` > two
 * captioned `.config-preview-panel`s, each holding its own nav-list. Returns
 * the two nav-list elements (light, dark) so a caller can keep configuring
 * them (attrs, items) after creation.
 */
export function lightDarkPreview<T>(
  container: HTMLElement,
  items: NavItem<T>[],
  attrs: Record<string, string>,
  service: SnapshotService,
): [SnapshotNavList, SnapshotNavList] {
  const row = document.createElement('div');
  row.className = 'config-preview-row';
  const navs = (['Light', 'Dark'] as const).map((name) => {
    const panel = document.createElement('div');
    panel.className = `config-preview-panel config-preview-${name.toLowerCase()}`;
    const caption = document.createElement('p');
    caption.className = 'config-preview-caption';
    caption.textContent = name;
    const nav = makeNavList(items, attrs, service);
    panel.append(caption, nav);
    row.append(panel);
    return nav;
  });
  container.append(row);
  return navs as [SnapshotNavList, SnapshotNavList];
}

/** A `<pre class="config-snippet"><code>` block — returns the `<code>` element so a caller can set/replace its text later (a live-updating snippet, a growing request log). */
export function codeSnippet(container: HTMLElement, text = ''): HTMLElement {
  const pre = document.createElement('pre');
  pre.className = 'config-snippet';
  const code = document.createElement('code');
  code.textContent = text;
  pre.append(code);
  container.append(pre);
  return code;
}

/**
 * Seeds `items` through `seed`, one at a time, in the background (module
 * load) — then logs and swallows any failure, since a demo page's canned
 * data shouldn't crash the app if seeding fails.
 */
export function seedInBackground<T>(items: readonly T[], seed: (item: T) => Promise<void>, label: string): Promise<void> {
  return (async () => {
    for (const item of items) await seed(item);
  })().catch((err) => console.error(`${label} seeding failed`, err));
}

/**
 * "Reset (replay spinner)" button: invalidate()s every item (via the
 * service, so the nav-list's live-update subscription picks it up) and
 * reassigns `navList.items` to a fresh array reference — a same-reference
 * reassignment wouldn't retrigger the loadThumb() that shows the spinner
 * again. Returned unattached so the caller controls where it lands relative
 * to the nav-list.
 */
export function resetSpinnerButton(
  items: GalleryItem[],
  service: SnapshotService,
  navList: SnapshotNavList,
  pageKey: string,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Reset (replay spinner)';
  btn.addEventListener('click', () => {
    items.forEach((item) => service.invalidate(item.id));
    navList.items = toClickableItems(items, pageKey);
  });
  return btn;
}
