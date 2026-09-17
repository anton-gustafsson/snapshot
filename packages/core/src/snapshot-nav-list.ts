import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { snapshotService as defaultSnapshotService } from './snapshot-service';
import type { SnapshotService } from './snapshot-service';

export interface NavItem<T = unknown> {
  /** The snapshot id — a plain domain id. Anything else the consumer needs belongs in `data`. */
  id: string;
  label: string;
  /** A plain-text glyph (e.g. an emoji), or markup — a string starting with `<` renders as raw HTML/SVG instead of text, so a consumer can pass its own icon (e.g. `<svg>...</svg>`). Only the placeholder frame shown before a card's first capture. */
  icon?: string;
  description?: string;
  /** Arbitrary consumer payload — echoed back verbatim on `nav-select` / `nav-edit`, so no lookup-by-id is needed in the handler. */
  data?: T;
  /** Per-item override of the component-level `editable` — for per-row rights. */
  editable?: boolean;
  /** @deprecated Put the route in `data` and read it off the emitted item. Kept for one release. */
  route?: string;
}

function isMarkupIcon(icon: string): boolean {
  return icon.trimStart().startsWith('<');
}

/** `overlay` floats the edit button over the thumbnail (top-right, reveals on hover); `meta` pins it to the right edge of the title's line (description below), always visible. */
export type SnapshotNavListEditButtonPosition = 'overlay' | 'meta';

const DEFAULT_EDIT_ICON = '✎';

/**
 * A grid of preview cards: a contained (never-cropped) screenshot above real
 * title/description text below it — the text never sits on top of the
 * image, so it needs no overlay tint to stay legible.
 */
export class SnapshotNavList extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family: var(--snapshot-nav-list-font, inherit);
      --frame-accent: var(--snapshot-nav-list-accent, #ff5a1f);
      max-height: var(--snapshot-nav-list-max-height, none);
    }
    /* scrollable: the host owns the scroll, so a long list in a flex sidebar
       doesn't push its siblings off-screen and the consumer doesn't have to
       reach in with its own overflow/min-height CSS. */
    :host([scrollable]) {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--snapshot-nav-list-card-min-width, 220px), 1fr));
      gap: var(--snapshot-nav-list-card-gap, 1.25rem);
    }
    li {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0;
      cursor: pointer;
      padding: var(--snapshot-nav-list-card-padding, 0.5rem);
      border-radius: var(--snapshot-nav-list-radius, 10px);
      background: var(--snapshot-nav-list-card-bg, transparent);
      border: 1px solid color-mix(in srgb, currentColor 12%, transparent);
      box-shadow: none;
      transition:
        box-shadow var(--snapshot-nav-list-card-transition-dur, 0.15s) ease,
        border-color var(--snapshot-nav-list-card-transition-dur, 0.15s) ease;
    }
    li:hover,
    li:focus-visible {
      background: var(--snapshot-nav-list-card-bg, transparent);
      box-shadow: var(--snapshot-nav-list-card-shadow, 0 2px 8px color-mix(in srgb, currentColor 18%, transparent));
      border-color: color-mix(in srgb, currentColor 22%, transparent);
      outline: none;
    }
    li:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--frame-accent) 55%, transparent);
    }

    .thumb-wrap {
      position: relative;
      width: 100%;
      height: auto;
      aspect-ratio: 2 / 1;
      border-radius: var(--snapshot-nav-list-radius-sm, 7px);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 12%, transparent);
      background: color-mix(in srgb, currentColor 4%, transparent);
      display: grid;
      place-items: center;
      overflow: hidden;
    }

    .thumb {
      width: 100%;
      height: 100%;
      display: block;
    }
    img.thumb {
      /* contain, not cover — the whole preview stays readable, nothing cropped */
      object-fit: contain;
      object-position: center;
      background: transparent;
    }
    /* unexposed frame: fine diagonal hatch instead of a generic gradient blob */
    .thumb-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: color-mix(in srgb, currentColor 7%, transparent);
      background-image: repeating-linear-gradient(
        135deg,
        color-mix(in srgb, currentColor 16%, transparent) 0px,
        color-mix(in srgb, currentColor 16%, transparent) 1.5px,
        transparent 1.5px,
        transparent 7px
      );
    }
    .icon-lg {
      font-size: 1.6rem;
      opacity: 0.4;
    }
    .icon-lg svg {
      width: 1.6rem;
      height: 1.6rem;
      display: block;
      fill: currentColor;
    }
    .thumb-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, currentColor 5%, transparent);
    }
    .spinner {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid color-mix(in srgb, currentColor 18%, transparent);
      border-top-color: var(--frame-accent);
      animation: snapshot-nav-list-spin 0.8s linear infinite;
    }
    @keyframes snapshot-nav-list-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 2.4s;
      }
    }

    .meta {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
      padding: 0.75rem 0.5rem 0.5rem;
    }
    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: normal;
      color: inherit;
      font-weight: 600;
      font-size: 1rem;
    }
    .description {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: normal;
      color: color-mix(in srgb, currentColor 60%, transparent);
      font-size: 0.8125rem;
    }

    .edit-button {
      position: absolute;
      top: 4px;
      right: 4px;
      z-index: 3;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 6px;
      background: color-mix(in srgb, #000 55%, transparent);
      color: #fff;
      font-size: 0.85rem;
      line-height: 1;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.15s ease;
    }
    li:hover .edit-button,
    li:focus-within .edit-button {
      opacity: 1;
    }
    .edit-button:hover {
      background: color-mix(in srgb, #000 75%, transparent);
    }
    .edit-button:focus-visible {
      opacity: 1;
      outline: 2px solid var(--frame-accent);
      outline-offset: 1px;
    }
    .edit-button svg {
      width: 1em;
      height: 1em;
      display: block;
      fill: currentColor;
    }

    /* Transparent by default (display: contents) so .label/.meta keep applying
       unchanged; it only becomes a real row when the edit button moves in
       beside the title. */
    .label-row {
      display: contents;
    }
    /* edit-button-position="meta": button on the title's line, description
       still on its own line underneath. */
    :host([edit-button-position='meta']) .label-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }
    /* the title takes the whole row so the button lands on the card's right
       edge, still on the title's own line (the description sits below it);
       min-width: 0 keeps a long title ellipsising instead of pushing out. */
    :host([edit-button-position='meta']) .label {
      flex: 1;
      min-width: 0;
    }
    :host([edit-button-position='meta']) .edit-button {
      position: static;
      flex-shrink: 0;
      /* in-flow, over the host's own background: currentColor-derived instead
         of the overlay's dark scrim, and always visible (it isn't covering
         anything, so hiding it until hover would just make it hard to find) */
      background: color-mix(in srgb, currentColor 10%, transparent);
      color: inherit;
      opacity: 1;
    }
    :host([edit-button-position='meta']) .edit-button:hover {
      background: color-mix(in srgb, currentColor 20%, transparent);
    }
  `;

  @property({ type: Array }) items: NavItem[] = [];
  /**
   * Second dimension on every id — typically the active theme, so a light and a
   * dark capture of the same view are stored (and read) separately. Passed
   * straight through to `SnapshotService.get()` as `variant`.
   */
  @property({ attribute: 'variant-key' }) variantKey?: string;
  /** Lets the host itself scroll (see `--snapshot-nav-list-max-height`) instead of growing unbounded. */
  @property({ type: Boolean, reflect: true }) scrollable = false;

  /** Defaults to the shared singleton — set your own instance (e.g. a namespaced or custom-storage SnapshotService) per <snapshot-nav-list> if needed. */
  @property({ attribute: false }) snapshotService: SnapshotService = defaultSnapshotService;
  /** Shows an edit button per card. Off by default — clicking it fires `nav-edit` instead of `nav-select`; the host decides what "edit" means (e.g. open its own dialog component). Overridable per row via `NavItem.editable`. */
  @property({ type: Boolean }) editable = false;
  /** Where the edit button sits: `overlay` (default) floats it over the thumbnail; `meta` pins it to the right edge of the title row, with the description below. */
  @property({ reflect: true, attribute: 'edit-button-position' })
  editButtonPosition: SnapshotNavListEditButtonPosition = 'overlay';
  /** Edit button glyph. Same convention as `NavItem.icon`: a plain-text glyph (e.g. an emoji), or markup — a string starting with `<` renders as raw HTML/SVG, so a consumer can pass its own icon (e.g. `<svg>...</svg>`). */
  @property({ attribute: 'edit-icon' }) editIcon = DEFAULT_EDIT_ICON;

  @state() private thumbs = new Map<string, string>();
  @state() private loadingIds = new Set<string>();
  /**
   * In-flight dedup guard, separate from `loadingIds` (which is only for
   * spinner display) so a repeat `loadThumb` call for an id already being
   * fetched is a no-op. Keyed by `${variant}\0${id}` — not just `id` — so a
   * `variantKey` switch mid-flight doesn't have the new variant's fetch
   * silently dropped because the *previous* variant's id is still marked
   * in-flight.
   */
  private fetchingIds = new Set<string>();
  private unsubscribe?: () => void;

  private fetchKey(variant: string | undefined, id: string) {
    return `${variant ?? ''}\0${id}`;
  }

  private subscribeToService() {
    this.unsubscribe?.();
    this.unsubscribe = this.snapshotService.subscribe((id, url, variant) => {
      // Ignore captures for ids this list isn't showing — the service is
      // often a shared singleton, so without this guard `thumbs` would grow
      // forever with urls for every snapshot captured anywhere on the page,
      // not just this list's own items.
      if (!this.items.some((item) => item.id === id)) return;
      // Same reason, one dimension over: a dark-theme capture must not
      // overwrite the light-theme tile this list is currently showing. Folds
      // '' and undefined together on both sides — SnapshotService.keyOf()
      // does the same, so a caller that sets variantKey to '' instead of
      // leaving it undefined must still match a plain (no-variant) capture.
      if ((variant || undefined) !== (this.variantKey || undefined)) return;
      if (url === null) {
        this.thumbs.delete(id);
      } else {
        this.thumbs.set(id, url);
      }
      this.requestUpdate();
    });
  }

  override connectedCallback() {
    super.connectedCallback();
    // No initial loadThumb() loop needed here — Lit always calls updated()
    // with every reactive property (including `items`) marked changed after
    // the first render, so the branch below covers it.
    this.subscribeToService();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }

  // Runs before render, so mutating `loadingIds` here lands in the *current*
  // update instead of triggering Lit's "update scheduled from updated()"
  // warning that came from doing this same flip inside updated().
  override willUpdate(changed: Map<string, unknown>) {
    // A variant-key switch (e.g. light -> dark) invalidates every thumbnail:
    // they're separate snapshots under separate keys.
    if (changed.has('variantKey')) this.thumbs.clear();

    if (changed.has('items') || changed.has('variantKey')) {
      const ids = new Set(this.items.map((item) => item.id));
      for (const id of this.thumbs.keys()) {
        if (!ids.has(id)) this.thumbs.delete(id);
      }
      for (const item of this.items) {
        if (!this.thumbs.has(item.id) && !this.fetchingIds.has(this.fetchKey(this.variantKey, item.id))) {
          this.loadingIds.add(item.id);
        }
      }
    }
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('snapshotService')) {
      this.subscribeToService();
    }
    if (changed.has('items') || changed.has('variantKey')) {
      void this.loadThumbs();
    }
  }

  /**
   * One batched read for the whole list — `getMany()` collapses to a single
   * query/round-trip on a storage that implements `loadMany`, instead of one
   * per row. `fetchingIds` still guards per id, so an `items` reassignment
   * mid-flight doesn't re-request what's already coming.
   */
  private async loadThumbs() {
    const variant = this.variantKey;
    const wanted = this.items.filter(
      (item) => !this.thumbs.has(item.id) && !this.fetchingIds.has(this.fetchKey(variant, item.id)),
    );
    if (wanted.length === 0) return;
    const ids = wanted.map((item) => item.id);
    ids.forEach((id) => this.fetchingIds.add(this.fetchKey(variant, id)));
    try {
      const urls = await this.snapshotService.getMany(ids, { variant });
      // Dropped if the variant changed while the read was in flight — those
      // urls belong to the previous theme.
      if (variant !== this.variantKey) return;
      for (const [id, url] of urls) {
        if (url) this.thumbs.set(id, url);
      }
    } catch (err) {
      console.error('snapshot-nav-list: failed to load thumbnails', err);
    } finally {
      ids.forEach((id) => {
        this.fetchingIds.delete(this.fetchKey(variant, id));
        this.loadingIds.delete(id);
      });
      this.requestUpdate();
    }
  }

  // Both events carry the whole item — including `data` — so a handler never
  // has to look the item back up by id.
  private select(item: NavItem) {
    this.dispatchEvent(new CustomEvent<NavItem>('nav-select', { detail: item, bubbles: true, composed: true }));
  }

  private edit(e: Event, item: NavItem) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent<NavItem>('nav-edit', { detail: item, bubbles: true, composed: true }));
  }

  private isEditable(item: NavItem) {
    return item.editable ?? this.editable;
  }

  private renderEditButton(item: NavItem) {
    const icon = this.editIcon || DEFAULT_EDIT_ICON;
    return html`<button
      type="button"
      class="edit-button"
      part="edit-button"
      aria-label="Edit ${item.label}"
      @click=${(e: Event) => this.edit(e, item)}
    >
      ${isMarkupIcon(icon) ? unsafeHTML(icon) : icon}
    </button>`;
  }

  override render() {
    const editInMeta = this.editButtonPosition === 'meta';
    return html`
      <ul role="listbox">
        ${this.items.map(
          (item) => html`
            <li
              role="option"
              aria-label=${item.label}
              tabindex="0"
              @click=${() => this.select(item)}
              @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.select(item)}
            >
              <div class="thumb-wrap" part="frame">
                ${this.thumbs.has(item.id)
                  ? html`<img class="thumb" part="thumb" src=${this.thumbs.get(item.id)!} alt="" />`
                  : this.loadingIds.has(item.id)
                    ? html`<div class="thumb thumb-loading" part="thumb" aria-hidden="true">
                        <span class="spinner" part="spinner"></span>
                      </div>`
                    : html`<div class="thumb thumb-placeholder" part="thumb" aria-hidden="true">
                        <span class="icon-lg"
                          >${item.icon ? (isMarkupIcon(item.icon) ? unsafeHTML(item.icon) : item.icon) : ''}</span
                        >
                      </div>`}
                ${this.isEditable(item) && !editInMeta ? this.renderEditButton(item) : ''}
              </div>
              <div class="meta" part="meta">
                <div class="label-row" part="label-row">
                  <span class="label" part="label">${item.label}</span>
                  ${this.isEditable(item) && editInMeta ? this.renderEditButton(item) : ''}
                </div>
                ${item.description ? html`<span class="description" part="description">${item.description}</span>` : ''}
              </div>
            </li>
          `,
        )}
      </ul>
    `;
  }
}

/** Detail type of both `nav-select` and `nav-edit` — the clicked item itself. */
export type SnapshotNavEvent<T = unknown> = CustomEvent<NavItem<T>>;

// Guarded so importing this package in a DOM-less process (SSR, Node, a test
// runner without jsdom) is a no-op instead of a crash.
if (typeof customElements !== 'undefined' && !customElements.get('snapshot-nav-list')) {
  customElements.define('snapshot-nav-list', SnapshotNavList);
}

declare global {
  interface HTMLElementTagNameMap {
    'snapshot-nav-list': SnapshotNavList;
  }
  interface HTMLElementEventMap {
    'nav-select': SnapshotNavEvent;
    'nav-edit': SnapshotNavEvent;
  }
}
