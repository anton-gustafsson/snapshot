import {
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import '@anton-gustafsson/snapshot-core';
import type { NavItem, SnapshotNavList, SnapshotNavListVariant, SnapshotService } from '@anton-gustafsson/snapshot-core';
import { SNAPSHOT_SERVICE } from './provide-snapshot';

/**
 * Thin Angular wrapper around <snapshot-nav-list>. Keeps CUSTOM_ELEMENTS_SCHEMA
 * contained here instead of leaking it into consuming app modules.
 *
 * The `SnapshotService` comes from DI (`provideSnapshot()`, or the package
 * default), so the `snapshotService` input is an override rather than a
 * requirement. It's bound as a real DOM property — objects can't cross an HTML
 * attribute — as is `items`; the rest are plain string/number values forwarded
 * as attributes for the Lit element's own converters to parse.
 *
 * `items` is assigned in an `effect()` rather than a template binding because
 * Lit only reacts to a changed array *reference*. That's the correct,
 * zoneless-safe behavior — pass a new array when items change rather than
 * mutating in place (`.push()`), since nothing here polls for in-place
 * mutations.
 */
@Component({
  selector: 'ngx-snapshot-nav-list',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<snapshot-nav-list
    #el
    [snapshotService]="service()"
    [attr.variant]="variant()"
    [attr.variant-key]="variantKey()"
    [attr.overlay-tint]="overlayTint()"
    [attr.text-overlay-opacity]="textOverlayOpacity()"
    [attr.image-overlay-opacity]="imageOverlayOpacity()"
    [attr.overlay-blur]="overlayBlur()"
    [attr.label-position]="labelPosition()"
    [attr.editable]="editable() ? '' : null"
    [attr.scrollable]="scrollable() ? '' : null"
    (nav-select)="onNavSelect($event)"
    (nav-edit)="onNavEdit($event)"
  ></snapshot-nav-list>`,
})
export class SnapshotNavListComponent<T = unknown> {
  readonly items = input<NavItem<T>[]>([]);
  readonly variant = input<SnapshotNavListVariant>('card');
  /** Second dimension on every id — typically the active theme, so light and dark captures stay separate. */
  readonly variantKey = input<string | undefined>(undefined);
  readonly overlayTint = input<'dark' | 'light' | 'none'>('none');
  readonly textOverlayOpacity = input(0.35);
  readonly imageOverlayOpacity = input(0);
  readonly overlayBlur = input(0);
  /** 'bottom' is the caption strip (default); 'center' centers a larger title (tile variant only). */
  readonly labelPosition = input<'bottom' | 'center'>('bottom');
  /** Shows a top-right edit button per card — clicking it fires `edit` instead of `select`. Overridable per row via `NavItem.editable`. */
  readonly editable = input(false);
  /** Lets the component itself scroll (see `--snapshot-nav-list-max-height`) instead of growing unbounded. */
  readonly scrollable = input(false);
  /** Optional override of the injected `SnapshotService` (see `provideSnapshot()`). */
  readonly snapshotService = input<SnapshotService | undefined>(undefined);

  /** Both events carry the whole item, `data` included — no lookup-by-id in the handler. */
  readonly select = output<NavItem<T>>();
  readonly edit = output<NavItem<T>>();

  private readonly injected = inject(SNAPSHOT_SERVICE);
  protected readonly service = computed(() => this.snapshotService() ?? this.injected);

  private readonly el = viewChild.required<ElementRef<SnapshotNavList>>('el');

  constructor() {
    effect(() => {
      // Copied so a later in-place mutation by the caller can't silently
      // change what the element is rendering.
      this.el().nativeElement.items = [...this.items()];
    });
  }

  protected onNavSelect(event: Event) {
    this.select.emit((event as CustomEvent<NavItem<T>>).detail);
  }

  protected onNavEdit(event: Event) {
    this.edit.emit((event as CustomEvent<NavItem<T>>).detail);
  }
}
