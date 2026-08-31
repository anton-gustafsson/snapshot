import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  CUSTOM_ELEMENTS_SCHEMA,
  type DoCheck,
} from '@angular/core';
import '@snapshot/core';
import { snapshotService as defaultSnapshotService } from '@snapshot/core';
import type { NavItem, SnapshotNavList, SnapshotNavListVariant, SnapshotService } from '@snapshot/core';

/**
 * Thin Angular wrapper around <snapshot-nav-list>. Keeps CUSTOM_ELEMENTS_SCHEMA
 * contained here instead of leaking it into consuming app modules.
 *
 * `snapshotService` is bound as a real DOM property (objects can't cross an
 * HTML attribute); the rest are plain string/number values forwarded as
 * attributes for the Lit element's own attribute converters to parse.
 *
 * `items` is set by hand in `ngDoCheck` instead of a template binding: both
 * Angular's property binding and Lit's default property dirty-check only
 * propagate a change when the array *reference* changes, so a consumer
 * mutating `items` in place (`.push()`) would otherwise never reach the
 * element. Reassigning a fresh shallow copy every check makes that visible
 * to both regardless of what the consumer does with the reference.
 */
@Component({
  selector: 'app-snapshot-nav-list',
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
export class NgSnapshotNavListComponent implements DoCheck {
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

  ngDoCheck() {
    this.elRef.nativeElement.items = [...this.items];
  }

  onNavSelect(event: Event) {
    this.select.emit((event as CustomEvent<{ id: string; route?: string }>).detail);
  }
}
