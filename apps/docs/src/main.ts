import '@snapshot/core';
import type { NavItem } from '@snapshot/core';
import { snapshotService } from '@snapshot/core';

const items: NavItem[] = [
  { id: 'revenue', label: 'Revenue', icon: '💰' },
  { id: 'signups', label: 'Signups', icon: '✦' },
  { id: 'churn', label: 'Churn', icon: '⤴' },
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

const navList = document.createElement('snapshot-nav-list');
navList.items = items;
navMount.append(navList);

let activeId = items[0].id;

navList.addEventListener('nav-select', ((e: CustomEvent<{ id: string }>) => {
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
