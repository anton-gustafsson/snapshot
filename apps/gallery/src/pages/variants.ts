import { getDefaultSnapshotService } from '@anton-gustafsson/snapshot-core';
import { DASHBOARDS, makeClickableNavList, pageHeader } from '../gallery-shared';

export const path = '/variants';
export const label = 'Layout variants';

interface Preset {
  name: string;
  description: string;
  attrs: Record<string, string>;
  vars?: Record<string, string>;
}

const PRESETS: Preset[] = [
  {
    name: 'Tile',
    description: 'Default <code>variant="tile"</code> — a contact-sheet grid, caption pinned to the bottom of each frame.',
    attrs: { variant: 'tile' },
  },
  {
    name: 'Big tiles',
    description: 'Same variant, larger frames via <code>--snapshot-nav-list-tile-width</code> / <code>-height</code>.',
    attrs: { variant: 'tile' },
    vars: { '--snapshot-nav-list-tile-width': '260px', '--snapshot-nav-list-tile-height': '170px' },
  },
  {
    name: 'Center title',
    description: '<code>label-position="center"</code> — title centered over the image.',
    attrs: { variant: 'tile', 'label-position': 'center' },
  },
  {
    name: 'List',
    description: '<code>variant="list"</code> — compact rows for a narrow sidebar, label beside the thumb.',
    attrs: { variant: 'list' },
  },
];

// Every var any preset sets — cleared before applying the next preset so a
// left-over from the previous one (e.g. big tiles' width/height) doesn't
// bleed into a preset that never mentions it.
const ALL_VAR_NAMES = [...new Set(PRESETS.flatMap((p) => Object.keys(p.vars ?? {})))];
const ALL_ATTR_NAMES = [...new Set(PRESETS.flatMap((p) => Object.keys(p.attrs)))];

export function render(container: HTMLElement) {
  pageHeader(
    container,
    'Layout variants',
    'The same clickable list, four ways — pick a preset below. Click a card to open its dashboard; ' +
      'coming back captures a real snapshot for the thumbnail.',
  );

  const tabs = document.createElement('div');
  tabs.className = 'variant-tabs';
  container.append(tabs);

  const description = document.createElement('p');
  container.append(description);

  const nav = makeClickableNavList(DASHBOARDS, PRESETS[0].attrs, getDefaultSnapshotService(), 'variants', path, label);
  container.append(nav);

  function applyPreset(preset: Preset) {
    for (const name of ALL_ATTR_NAMES) nav.removeAttribute(name);
    for (const [name, value] of Object.entries(preset.attrs)) nav.setAttribute(name, value);
    for (const name of ALL_VAR_NAMES) nav.style.removeProperty(name);
    for (const [name, value] of Object.entries(preset.vars ?? {})) nav.style.setProperty(name, value);
    description.innerHTML = preset.description;
  }

  const buttons = PRESETS.map((preset) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'variant-tab';
    btn.textContent = preset.name;
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.toggle('active', b === btn));
      applyPreset(preset);
    });
    tabs.append(btn);
    return btn;
  });

  buttons[0].classList.add('active');
  applyPreset(PRESETS[0]);
}
