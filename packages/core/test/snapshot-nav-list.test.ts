// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { SnapshotService } from '../src/snapshot-service';
import type { NavItem, SnapshotNavList } from '../src/snapshot-nav-list';
import type { SnapshotKey, SnapshotStorage } from '../src/snapshot-storage';

/** Records what the component asked for, and answers with a fake URL per key. */
class SpyStorage implements SnapshotStorage {
  batches: string[][] = [];
  singles: string[] = [];
  has = new Set<string>();

  async save(_blob: Blob, key: SnapshotKey) {
    this.has.add(key.key);
    return `url:${key.key}`;
  }
  async load(key: SnapshotKey) {
    this.singles.push(key.key);
    return this.has.has(key.key) ? `url:${key.key}` : null;
  }
  async remove(key: SnapshotKey) {
    this.has.delete(key.key);
  }
  async loadMany(keys: SnapshotKey[]) {
    this.batches.push(keys.map((k) => k.key));
    return new Map(keys.map((k) => [k.key, this.has.has(k.key) ? `url:${k.key}` : null] as const));
  }
}

let counter = 0;

async function mount(items: NavItem[], attrs: Record<string, string> = {}) {
  // Imported here (not at module scope) so jsdom exists before lit registers
  // the element.
  await import('../src/snapshot-nav-list');
  const storage = new SpyStorage();
  const service = new SnapshotService({ storage, keyPrefix: `nav${counter++}:` });
  const el = document.createElement('snapshot-nav-list') as SnapshotNavList;
  el.snapshotService = service;
  el.items = items;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.append(el);
  await el.updateComplete;
  // One more turn for the async thumbnail read to settle.
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  return { el, storage, service };
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('<snapshot-nav-list>', () => {
  it('reads the whole list in one batch and renders what came back', async () => {
    const { el, storage } = await mount([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ]);

    expect(storage.singles).toEqual([]);
    expect(storage.batches).toHaveLength(1);
    expect(storage.batches[0]).toHaveLength(2);
    // Nothing stored yet, so both frames show the placeholder rather than an <img>.
    expect(el.shadowRoot!.querySelectorAll('img.thumb')).toHaveLength(0);
    expect(el.shadowRoot!.querySelectorAll('.thumb-placeholder')).toHaveLength(2);
  });

  it('paints a stored snapshot, and re-reads under the new key when variant-key changes', async () => {
    const { el, storage, service } = await mount([{ id: 'a', label: 'A' }]);
    await storage.save(new Blob(['x']), service.keyOf('a', { variant: 'dark' }));

    el.setAttribute('variant-key', 'dark');
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;

    expect(storage.batches.at(-1)).toEqual([service.keyOf('a', { variant: 'dark' }).key]);
    const img = el.shadowRoot!.querySelector<HTMLImageElement>('img.thumb');
    expect(img?.getAttribute('src')).toBe(`url:${service.keyOf('a', { variant: 'dark' }).key}`);
  });

  it('ignores a capture published for a different variant', async () => {
    const { el, service } = await mount([{ id: 'a', label: 'A' }], { 'variant-key': 'light' });

    service.publish('a', 'url:dark-one', { variant: 'dark' });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('img.thumb')).toHaveLength(0);

    service.publish('a', 'url:light-one', { variant: 'light' });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector<HTMLImageElement>('img.thumb')?.getAttribute('src')).toBe('url:light-one');
  });

  it('normalises the legacy icon-only variant to tile', async () => {
    const { el } = await mount([{ id: 'a', label: 'A' }], { variant: 'icon-only' });

    expect(el.variant).toBe('tile');
    expect(el.getAttribute('variant')).toBe('tile');
  });

  it('shows the edit button per item, overriding the component-wide flag', async () => {
    const { el } = await mount(
      [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B', editable: false },
        { id: 'c', label: 'C', editable: true },
      ],
      { editable: '' },
    );

    const labels = Array.from(el.shadowRoot!.querySelectorAll('.edit-button'), (b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(['Edit A', 'Edit C']);
  });

  it('emits the whole item, data included', async () => {
    const item: NavItem<{ route: string }> = { id: 'a', label: 'A', data: { route: '/a' } };
    const { el } = await mount([item]);

    const selected: unknown[] = [];
    el.addEventListener('nav-select', (e) => {
      selected.push(e.detail);
    });
    el.shadowRoot!.querySelector<HTMLElement>('li')!.click();

    expect(selected).toEqual([item]);
  });
});
