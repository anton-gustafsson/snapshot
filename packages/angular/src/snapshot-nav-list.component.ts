import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  CUSTOM_ELEMENTS_SCHEMA,
  type AfterViewInit,
  type OnChanges,
  type SimpleChanges,
} from '@angular/core';
import '@anton-gustafsson/snapshot-core';
import { snapshotService as defaultSnapshotService } from '@anton-gustafsson/snapshot-core';
import type { NavItem, SnapshotNavList, SnapshotNavListVariant, SnapshotService } from '@anton-gustafsson/snapshot-core';

/**
 * Thin Angular wrapper around <snapshot-nav-list>. Keeps CUSTOM_ELEMENTS_SCHEMA
 * contained here instead of leaking it into consuming app modules.
 *
 * `snapshotService` is bound as a real DOM property (objects can't cross an
 * HTML attribute); the rest are plain string/number values forwarded as
 * attributes for the Lit element's own attribute converters to parse.
 *
 * `items` is set by hand (ngOnChanges + ngAfterViewInit) instead of a
 * template binding: Angular's property binding only propagates when the
 * array *reference* changes. That's the correct, zoneless-safe behavior —
 * pass a new array when `items` changes rather than mutating in place
 * (`.push()`), since nothing here polls for in-place mutations.
 */
@Component({
  selector: 'ngx-snapshot-nav-list',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<snapshot-nav-list
    #el
    [snapshotService]="snapshotService"
    [attr.variant]="variant"
    [attr.overlay-tint]="overlayTint"
    [attr.overlay-opacity]="overlayOpacity"
    [attr.overlay-blur]="overlayBlur"
    [attr.label-position]="labelPosition"
    (nav-select)="onNavSelect($event)"
  ></snapshot-nav-list>`,
})
export class SnapshotNavListComponent implements OnChanges, AfterViewInit {
  @Input() items: NavItem[] = [];
  @Input() variant: SnapshotNavListVariant = 'icon-only';
  @Input() overlayTint: 'dark' | 'light' | 'none' = 'dark';
  @Input() overlayOpacity = 0.35;
  @Input() overlayBlur = 0;
  /** 'bottom' is the caption strip (default); 'center' pins the frame number to the corner and centers a larger title (icon-only variant only). */
  @Input() labelPosition: 'bottom' | 'center' = 'bottom';
  /** Defaults to the shared singleton — pass your own instance (e.g. a namespaced or custom-storage SnapshotService) if needed. */
  @Input() snapshotService: SnapshotService = defaultSnapshotService;
  @Output() select = new EventEmitter<{ id: string; route?: string }>();

  @ViewChild('el') private elRef!: ElementRef<SnapshotNavList>;

  ngOnChanges(changes: SimpleChanges) {
    // Guard: ngOnChanges fires before the view (and @ViewChild) exists on the first pass.
    if (changes['items'] && this.elRef) this.elRef.nativeElement.items = [...this.items];
  }

  ngAfterViewInit() {
    this.elRef.nativeElement.items = [...this.items];
  }

  onNavSelect(event: Event) {
    this.select.emit((event as CustomEvent<{ id: string; route?: string }>).detail);
  }
}
