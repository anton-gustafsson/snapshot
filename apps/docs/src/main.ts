import '@anton-gustafsson/snapshot-core';
import type { NavItem } from '@anton-gustafsson/snapshot-core';
import { getDefaultSnapshotService } from '@anton-gustafsson/snapshot-core';

/** `NavItem.icon` takes markup, not a glyph — one shared line icon keeps the playground's three cards honest about that. */
const CHART_ICON =
  '<svg viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 20h18"/><path d="M4 16l5-5 4 4 7-8"/></g></svg>';

const items: NavItem[] = [
  { id: 'revenue', label: 'Revenue', icon: CHART_ICON },
  { id: 'signups', label: 'Signups', icon: CHART_ICON },
  { id: 'churn', label: 'Churn', icon: CHART_ICON },
];

const WIDGET_COLORS = ['#6c5ce7', '#00b894', '#0984e3', '#fdcb6e', '#e17055'];

function requireElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`docs playground: expected #${id} in index.html but it's missing`);
  return el as T;
}

const navMount = requireElement<HTMLElement>('pg-nav-mount');
const canvas = requireElement<HTMLElement>('pg-canvas');
const addBtn = requireElement<HTMLButtonElement>('pg-add');
const saveBtn = requireElement<HTMLButtonElement>('pg-save');

const snapshotService = getDefaultSnapshotService();

const navList = document.createElement('snapshot-nav-list');
navList.items = items;
navMount.append(navList);

let activeId = items[0].id;

navList.addEventListener('nav-select', ((e: CustomEvent<NavItem>) => {
  activeId = e.detail.id;
  canvas.innerHTML = '';
}) as EventListener);

addBtn.onclick = () => {
  const el = document.createElement('div');
  el.className = 'widget';
  el.style.background = WIDGET_COLORS[Math.floor(Math.random() * WIDGET_COLORS.length)];
  el.textContent = `+${Math.floor(Math.random() * 20)}%`;
  canvas.append(el);
};

saveBtn.onclick = () => {
  snapshotService.capture(canvas, activeId).catch((err) => {
    console.error(`Failed to save snapshot for "${activeId}"`, err);
  });
};
