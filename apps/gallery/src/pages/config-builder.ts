import { SnapshotService } from '@anton-gustafsson/snapshot-core';
import { DASHBOARDS, ProceduralStorage, codeSnippet, lightDarkPreview, pageHeader, randomDashboardImage } from '../gallery-shared';

// Own instance (not the shared `instantService`) so randomizing backgrounds
// here doesn't leak — via the cross-tab broadcast channel — into other
// gallery pages/tabs that happen to show items with the same ids.
const previewService = new SnapshotService({ storage: new ProceduralStorage(), keyPrefix: 'gallery-config-builder' });

export const path = '/config-builder';
export const label = 'Config builder';

interface Config {
  showDescription: boolean;
  variant: 'list' | 'tile' | 'card';
  labelPosition: 'bottom' | 'center';
  overlayTint: 'dark' | 'light' | 'none';
  textOverlayOpacity: number;
  imageOverlayOpacity: number;
  overlayBlur: number;
  editable: boolean;
  accent: string;
  radius: number;
  radiusSm: number;
  gap: number;
  tileWidth: number;
  tileHeight: number;
  overlayMargin: number;
  overlayRadius: number;
}

const DEFAULTS: Config = {
  showDescription: false,
  variant: 'tile',
  labelPosition: 'bottom',
  overlayTint: 'none',
  textOverlayOpacity: 0.35,
  imageOverlayOpacity: 0,
  overlayBlur: 0,
  editable: false,
  accent: '#ff5a1f',
  radius: 10,
  radiusSm: 7,
  gap: 0.3,
  tileWidth: 160,
  tileHeight: 100,
  overlayMargin: 0,
  overlayRadius: 0,
};

function applyConfig(nav: HTMLElement, c: Config) {
  nav.setAttribute('variant', c.variant);
  nav.setAttribute('label-position', c.labelPosition);
  nav.setAttribute('overlay-tint', c.overlayTint);
  nav.setAttribute('text-overlay-opacity', String(c.textOverlayOpacity));
  nav.setAttribute('image-overlay-opacity', String(c.imageOverlayOpacity));
  nav.setAttribute('overlay-blur', String(c.overlayBlur));
  nav.toggleAttribute('editable', c.editable);
  nav.style.setProperty('--snapshot-nav-list-accent', c.accent);
  nav.style.setProperty('--snapshot-nav-list-radius', `${c.radius}px`);
  nav.style.setProperty('--snapshot-nav-list-radius-sm', `${c.radiusSm}px`);
  nav.style.setProperty('--snapshot-nav-list-gap', `${c.gap}rem`);
  nav.style.setProperty('--snapshot-nav-list-tile-width', `${c.tileWidth}px`);
  nav.style.setProperty('--snapshot-nav-list-tile-height', `${c.tileHeight}px`);
  nav.style.setProperty('--snapshot-nav-list-overlay-margin', `${c.overlayMargin}px`);
  nav.style.setProperty('--snapshot-nav-list-overlay-radius', `${c.overlayRadius}px`);
}

function snippet(c: Config): string {
  const attrs = [
    `variant="${c.variant}"`,
    `label-position="${c.labelPosition}"`,
    `overlay-tint="${c.overlayTint}"`,
    `text-overlay-opacity="${c.textOverlayOpacity}"`,
    `image-overlay-opacity="${c.imageOverlayOpacity}"`,
    `overlay-blur="${c.overlayBlur}"`,
    ...(c.editable ? ['editable'] : []),
  ].join('\n  ');

  const vars: [keyof Config, string, string][] = [
    ['accent', '--snapshot-nav-list-accent', c.accent],
    ['radius', '--snapshot-nav-list-radius', `${c.radius}px`],
    ['radiusSm', '--snapshot-nav-list-radius-sm', `${c.radiusSm}px`],
    ['gap', '--snapshot-nav-list-gap', `${c.gap}rem`],
    ['tileWidth', '--snapshot-nav-list-tile-width', `${c.tileWidth}px`],
    ['tileHeight', '--snapshot-nav-list-tile-height', `${c.tileHeight}px`],
    ['overlayMargin', '--snapshot-nav-list-overlay-margin', `${c.overlayMargin}px`],
    ['overlayRadius', '--snapshot-nav-list-overlay-radius', `${c.overlayRadius}px`],
  ];

  const rules = vars
    .filter(([key]) => c[key] !== DEFAULTS[key])
    .map(([, prop, value]) => `  ${prop}: ${value};`)
    .join('\n');

  const style = rules ? `\n<style>\nsnapshot-nav-list {\n${rules}\n}\n</style>` : '';

  const items = c.showDescription
    ? `\n\nnav.items = [\n  { id: 'sales', label: 'Sales', description: 'Sales overview' },\n  // ...\n];`
    : '';

  return `<snapshot-nav-list\n  ${attrs}\n></snapshot-nav-list>${style}${items}`;
}

// Every non-default setting round-trips through the URL query string, so the
// current page link fully reproduces what's on screen — share it as-is.
function configToParams(c: Config): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of Object.keys(DEFAULTS) as (keyof Config)[]) {
    if (c[key] !== DEFAULTS[key]) params.set(key, String(c[key]));
  }
  return params;
}

function configFromUrl(): Partial<Config> {
  const params = new URLSearchParams(location.search);
  const partial: Partial<Config> = {};
  for (const key of Object.keys(DEFAULTS) as (keyof Config)[]) {
    if (!params.has(key)) continue;
    const raw = params.get(key)!;
    const defaultValue = DEFAULTS[key];
    if (typeof defaultValue === 'boolean') {
      (partial as Record<string, unknown>)[key] = raw === 'true';
    } else if (typeof defaultValue === 'number') {
      const n = Number(raw);
      if (!Number.isNaN(n)) (partial as Record<string, unknown>)[key] = n;
    } else {
      (partial as Record<string, unknown>)[key] = raw;
    }
  }
  return partial;
}

function field(
  label: string,
  input: HTMLElement,
  valueEl?: HTMLElement,
): HTMLLabelElement {
  const wrap = document.createElement('label');
  const text = document.createElement('span');
  text.textContent = label;
  wrap.append(text, input);
  if (valueEl) text.append(' ', valueEl);
  return wrap;
}

/** "Copy"/"Copy link" button: writes `getText()` to the clipboard, flashes to "Copied", then reverts. */
function copyButton(className: string, label: string, getText: () => string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(getText());
    btn.textContent = 'Copied';
    setTimeout(() => (btn.textContent = label), 1200);
  });
  return btn;
}

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Config builder',
    'Every attribute and CSS custom property on <code>&lt;snapshot-nav-list&gt;</code>, live — dial one in, then copy the markup out.',
  );

  const config: Config = { ...DEFAULTS, ...configFromUrl() };

  function group(title: string): HTMLDivElement {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'config-group';
    const legend = document.createElement('legend');
    legend.textContent = title;
    const grid = document.createElement('div');
    grid.className = 'config-grid';
    fieldset.append(legend, grid);
    container.append(fieldset);
    return grid;
  }

  const contentGrid = group('Content');
  const layoutGrid = group('Layout');
  const overlayGrid = group('Overlay');
  const themingGrid = group('Theming (CSS custom properties)');

  const baseItems = DASHBOARDS.slice(0, 4);

  const navs = lightDarkPreview(container, baseItems, {}, previewService);

  const randomizeBtn = document.createElement('button');
  randomizeBtn.type = 'button';
  randomizeBtn.className = 'config-randomize';
  randomizeBtn.textContent = '🎲 Randomize backgrounds';
  randomizeBtn.addEventListener('click', () => {
    for (const item of baseItems) previewService.publish(item.id, randomDashboardImage());
  });
  container.append(randomizeBtn);

  const snippetWrap = document.createElement('div');
  snippetWrap.className = 'config-snippet-wrap';
  const code = codeSnippet(snippetWrap);
  snippetWrap.append(
    copyButton('config-copy', 'Copy', () => code.textContent ?? ''),
    copyButton('config-copy config-share', 'Copy link', () => location.href),
  );
  container.append(snippetWrap);

  function refresh() {
    const items = config.showDescription
      ? baseItems.map((item) => ({ ...item, description: `${item.label} overview` }))
      : baseItems;
    for (const nav of navs) {
      nav.items = items;
      applyConfig(nav, config);
    }
    code.textContent = snippet(config);

    const qs = configToParams(config).toString();
    history.replaceState(null, '', qs ? `${location.pathname}?${qs}` : location.pathname);
  }

  function select<K extends keyof Config>(grid: HTMLElement, key: K, label: string, options: string[]) {
    const el = document.createElement('select');
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      if (opt === config[key]) o.selected = true;
      el.append(o);
    }
    el.addEventListener('change', () => {
      (config[key] as unknown as string) = el.value;
      refresh();
    });
    grid.append(field(label, el));
  }

  function range<K extends keyof Config>(
    grid: HTMLElement,
    key: K,
    label: string,
    min: number,
    max: number,
    step: number,
    unit = '',
  ) {
    const el = document.createElement('input');
    el.type = 'range';
    el.min = String(min);
    el.max = String(max);
    el.step = String(step);
    el.value = String(config[key]);
    const valueEl = document.createElement('span');
    valueEl.className = 'config-value';
    valueEl.textContent = `${config[key]}${unit}`;
    el.addEventListener('input', () => {
      (config[key] as unknown as number) = Number(el.value);
      valueEl.textContent = `${el.value}${unit}`;
      refresh();
    });
    grid.append(field(label, el, valueEl));
  }

  function color<K extends keyof Config>(grid: HTMLElement, key: K, label: string) {
    const el = document.createElement('input');
    el.type = 'color';
    el.value = config[key] as unknown as string;
    el.addEventListener('input', () => {
      (config[key] as unknown as string) = el.value;
      refresh();
    });
    grid.append(field(label, el));
  }

  function checkbox<K extends keyof Config>(grid: HTMLElement, key: K, label: string) {
    const el = document.createElement('input');
    el.type = 'checkbox';
    el.checked = config[key] as unknown as boolean;
    el.addEventListener('change', () => {
      (config[key] as unknown as boolean) = el.checked;
      refresh();
    });
    const wrap = document.createElement('label');
    wrap.className = 'config-checkbox';
    wrap.append(el, document.createTextNode(label));
    grid.append(wrap);
  }

  checkbox(contentGrid, 'showDescription', 'Description');

  select(layoutGrid, 'variant', 'Variant', ['card', 'tile', 'list']);
  select(layoutGrid, 'labelPosition', 'Label position (tile)', ['bottom', 'center']);
  checkbox(layoutGrid, 'editable', 'Editable');

  select(overlayGrid, 'overlayTint', 'Overlay tint', ['none', 'dark', 'light']);
  range(overlayGrid, 'textOverlayOpacity', 'Text overlay opacity', 0, 1, 0.05);
  range(overlayGrid, 'imageOverlayOpacity', 'Image overlay opacity', 0, 1, 0.05);
  range(overlayGrid, 'overlayBlur', 'Overlay blur', 0, 20, 1, 'px');
  range(overlayGrid, 'overlayMargin', 'Overlay margin (tile)', 0, 20, 1, 'px');
  range(overlayGrid, 'overlayRadius', 'Overlay radius (tile)', 0, 20, 1, 'px');

  color(themingGrid, 'accent', 'Accent');
  range(themingGrid, 'radius', 'Tile radius', 0, 40, 1, 'px');
  range(themingGrid, 'radiusSm', 'Thumb radius', 0, 40, 1, 'px');
  range(themingGrid, 'gap', 'Gap', 0, 2, 0.05, 'rem');
  range(themingGrid, 'tileWidth', 'Tile width (tile)', 100, 300, 5, 'px');
  range(themingGrid, 'tileHeight', 'Tile height (tile)', 60, 200, 5, 'px');

  refresh();
}
