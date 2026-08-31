import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { snapshotService as defaultSnapshotService } from './snapshot-service';
import type { SnapshotService } from './snapshot-service';

export interface NavItem {
  id: string;
  label: string;
  /** A plain-text glyph (e.g. an emoji), or markup — a string starting with `<` renders as raw HTML/SVG instead of text, so a consumer can pass its own icon (e.g. `<svg>...</svg>`). Only the placeholder frame shown before a card's first capture. */
  icon?: string;
  route?: string;
  description?: string;
}

function isMarkupIcon(icon: string): boolean {
  return icon.trimStart().startsWith('<');
}

export type SnapshotNavListVariant = 'list' | 'icon-only';

/**
 * Visual identity: a contact sheet. Every tile is a "frame" — numbered like a strip
 * of negatives — because that's literally what a snapshot thumbnail is. All colors
 * come from CSS custom properties (themeable) with sensible fallbacks derived from
 * `currentColor`, so an unstyled host still looks intentional.
 */
export class SnapshotNavList extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font-family: var(--snapshot-nav-list-font, inherit);
      --frame-accent: var(--snapshot-nav-list-accent, #ff5a1f);
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--snapshot-nav-list-gap, 0.3rem);
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      cursor: pointer;
      padding: 0.45rem 0.55rem;
      border-radius: var(--snapshot-nav-list-radius, 10px);
    }
    li:hover,
    li:focus-visible {
      background: color-mix(in srgb, currentColor 7%, transparent);
      outline: none;
    }
    li:focus-visible .thumb-wrap {
      outline: 2px solid var(--frame-accent);
      outline-offset: 2px;
    }

    .thumb-wrap {
      position: relative;
      width: 160px;
      height: 100px;
      border-radius: var(--snapshot-nav-list-radius-sm, 7px);
      flex-shrink: 0;
      overflow: hidden;
      box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 16%, transparent);
    }
    /* signature: registration-mark corners, like a photo mount */
    .thumb-wrap::before,
    .thumb-wrap::after {
      content: '';
      position: absolute;
      width: 9px;
      height: 9px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
      z-index: 2;
    }
    .thumb-wrap::before {
      top: 4px;
      left: 4px;
      border-top: 2px solid var(--frame-accent);
      border-left: 2px solid var(--frame-accent);
    }
    .thumb-wrap::after {
      bottom: 4px;
      right: 4px;
      border-bottom: 2px solid var(--frame-accent);
      border-right: 2px solid var(--frame-accent);
    }
    li:hover .thumb-wrap::before,
    li:hover .thumb-wrap::after,
    li:focus-visible .thumb-wrap::before,
    li:focus-visible .thumb-wrap::after {
      opacity: 1;
    }

    .thumb {
      width: 100%;
      height: 100%;
      display: block;
    }
    img.thumb {
      object-fit: cover;
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

    /* tint/blur controls apply only to the image, via this scrim layered on top of it */
    .image-overlay {
      position: absolute;
      inset: 0;
      background: var(--overlay-bg, transparent);
      backdrop-filter: blur(var(--overlay-blur, 0px));
      -webkit-backdrop-filter: blur(var(--overlay-blur, 0px));
      pointer-events: none;
    }
    /* the overlay exists so icon-only's overlaid title stays legible — list
       variant shows the label beside the thumb, not on top of it, so the
       tint has nothing to do there. */
    :host(:not([variant='icon-only'])) .image-overlay {
      display: none;
    }

    .meta {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }
    .label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: inherit;
      font-weight: 500;
    }
    .description {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: color-mix(in srgb, currentColor 60%, transparent);
      font-size: 0.75rem;
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

    /* list: a compact thumb reads better in a narrow sidebar than the grid's 160x100 */
    :host([variant='list']) .thumb-wrap {
      width: 108px;
      height: 68px;
    }

    /* icon-only: contact-sheet grid, caption strip pinned to the bottom of each frame */
    :host([variant='icon-only']) ul {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    :host([variant='icon-only']) li {
      position: relative;
      width: var(--snapshot-nav-list-tile-width, 160px);
      height: var(--snapshot-nav-list-tile-height, 100px);
      padding: 0;
      overflow: hidden;
    }
    :host([variant='icon-only']) .thumb-wrap {
      width: 100%;
      height: 100%;
      border-radius: var(--snapshot-nav-list-radius, 10px);
    }
    :host([variant='icon-only']) .meta {
      position: absolute;
      inset: auto 0 0 0;
      margin: var(--snapshot-nav-list-overlay-margin, 0);
      border-radius: var(--snapshot-nav-list-overlay-radius, 0);
      align-items: flex-start;
      gap: 0.15rem;
      padding: 0.4rem 0.5rem;
      color: var(--overlay-text, #fff);
      background: var(--overlay-bg, transparent);
      backdrop-filter: blur(var(--overlay-blur, 0px));
      -webkit-backdrop-filter: blur(var(--overlay-blur, 0px));
    }
    :host([variant='icon-only']) .label {
      white-space: normal;
    }
    :host([variant='icon-only']) .description {
      color: color-mix(in srgb, var(--overlay-text, #fff) 75%, transparent);
    }

    /* label-position="center": title big and centered */
    :host([variant='icon-only'][label-position='center']) .meta {
      inset: 0;
      align-items: center;
      justify-content: center;
      padding: 0.6rem;
    }
    :host([variant='icon-only'][label-position='center']) .label {
      font-size: 1.15rem;
      font-weight: 600;
      text-align: center;
    }
  `;

  @property({ type: Array }) items: NavItem[] = [];
  @property({ reflect: true }) variant: SnapshotNavListVariant = 'icon-only';

  /** icon-only tile overlay: tint behind the title so it stays legible over any image. Transparent by default — opt into a scrim explicitly. */
  @property({ attribute: 'overlay-tint' }) overlayTint: 'dark' | 'light' | 'none' = 'none';
  /** overlay tint strength, 0-1 */
  @property({ type: Number, attribute: 'overlay-opacity' }) overlayOpacity = 0.35;
  /** backdrop blur behind the title, in px */
  @property({ type: Number, attribute: 'overlay-blur' }) overlayBlur = 0;
  /** icon-only only: 'bottom' is the caption strip (default), 'center' centers a larger title. */
  @property({ reflect: true, attribute: 'label-position' }) labelPosition: 'bottom' | 'center' = 'bottom';
  /** Defaults to the shared singleton — set your own instance (e.g. a namespaced or custom-storage SnapshotService) per <snapshot-nav-list> if needed. */
  @property({ attribute: false }) snapshotService: SnapshotService = defaultSnapshotService;
  /** Shows a top-right edit button per card. Off by default — clicking it fires `nav-edit` instead of `nav-select`; the host decides what "edit" means (e.g. open its own dialog component). */
  @property({ type: Boolean }) editable = false;

  @state() private thumbs = new Map<string, string>();
  @state() private loadingIds = new Set<string>();
  /** In-flight dedup guard, separate from `loadingIds` (which is only for spinner display) so a repeat `loadThumb` call for an id already being fetched is a no-op. */
  private fetchingIds = new Set<string>();
  private unsubscribe?: () => void;

  private subscribeToService() {
    this.unsubscribe?.();
    this.unsubscribe = this.snapshotService.subscribe((id, url) => {
      // Ignore captures for ids this list isn't showing — the service is
      // often a shared singleton, so without this guard `thumbs` would grow
      // forever with urls for every snapshot captured anywhere on the page,
      // not just this list's own items.
      if (!this.items.some((item) => item.id === id)) return;
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
    if (changed.has('items')) {
      const ids = new Set(this.items.map((item) => item.id));
      for (const id of this.thumbs.keys()) {
        if (!ids.has(id)) this.thumbs.delete(id);
      }
      for (const item of this.items) {
        if (!this.thumbs.has(item.id) && !this.fetchingIds.has(item.id)) {
          this.loadingIds.add(item.id);
        }
      }
    }
  }

  override updated(changed: Map<string, unknown>) {
    if (changed.has('snapshotService')) {
      this.subscribeToService();
    }
    if (changed.has('items')) {
      this.items.forEach((item) => this.loadThumb(item.id));
    }
  }

  private async loadThumb(id: string) {
    if (this.thumbs.has(id) || this.fetchingIds.has(id)) return;
    this.fetchingIds.add(id);
    try {
      const url = await this.snapshotService.get(id);
      if (url) this.thumbs.set(id, url);
    } catch (err) {
      console.error(`snapshot-nav-list: failed to load thumbnail for "${id}"`, err);
    } finally {
      this.fetchingIds.delete(id);
      this.loadingIds.delete(id);
      this.requestUpdate();
    }
  }

  private get overlayStyle() {
    const blur = `${this.overlayBlur}px`;
    if (this.overlayTint === 'none') {
      return { '--overlay-bg': 'transparent', '--overlay-text': 'inherit', '--overlay-blur': blur };
    }
    const tintColor = this.overlayTint === 'light' ? '#fff' : '#000';
    const bg = `color-mix(in srgb, ${tintColor} ${Math.round(this.overlayOpacity * 100)}%, transparent)`;
    const text = this.overlayTint === 'light' ? '#111' : '#fff';
    return { '--overlay-bg': bg, '--overlay-text': text, '--overlay-blur': blur };
  }

  private select(item: NavItem) {
    this.dispatchEvent(
      new CustomEvent('nav-select', {
        detail: { id: item.id, route: item.route },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private edit(e: Event, item: NavItem) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('nav-edit', {
        detail: { id: item.id, route: item.route },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override render() {
    const overlayStyle = this.overlayStyle;
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
                <div class="image-overlay" part="overlay" style=${styleMap(overlayStyle)}></div>
                ${this.editable
                  ? html`<button
                      type="button"
                      class="edit-button"
                      part="edit-button"
                      aria-label="Edit ${item.label}"
                      @click=${(e: Event) => this.edit(e, item)}
                    >
                      ✎
                    </button>`
                  : ''}
              </div>
              <div class="meta" part="meta" style=${styleMap(overlayStyle)}>
                <span class="label" part="label">${item.label}</span>
                ${item.description ? html`<span class="description" part="description">${item.description}</span>` : ''}
              </div>
            </li>
          `,
        )}
      </ul>
    `;
  }
}

if (!customElements.get('snapshot-nav-list')) {
  customElements.define('snapshot-nav-list', SnapshotNavList);
}

declare global {
  interface HTMLElementTagNameMap {
    'snapshot-nav-list': SnapshotNavList;
  }
}
