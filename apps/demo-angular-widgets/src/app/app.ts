import { Component, ElementRef, computed, signal, viewChild, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
// One package: the component, the DI helpers, and the core types.
import { SnapshotNavListComponent, injectSnapshotCapture } from '@anton-gustafsson/snapshot-angular';
import type { NavItem } from '@anton-gustafsson/snapshot-angular';
import {
  DashboardComponent as NgxDashboardComponent,
  WidgetListComponent,
  createEmptyDashboard,
  type ReservedSpace,
  type DashboardDataDto,
} from '@dragonworks/ngx-dashboard';
import { EditDashboardDialogComponent } from './edit-dashboard-dialog.component';

// Custom icons: <snapshot-nav-list> renders `icon` as raw markup instead of text
// whenever it starts with '<', so any inline SVG works here — no emoji required.
const OPS_ICON = `<svg viewBox="0 0 24 24"><path d="M19.4 13a7.4 7.4 0 0 0 .06-1 7.4 7.4 0 0 0-.06-1l2.1-1.6a.5.5 0 0 0 .12-.66l-2-3.4a.5.5 0 0 0-.6-.22l-2.5 1a7.6 7.6 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.42h-4a.5.5 0 0 0-.5.42l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.22l-2 3.4a.5.5 0 0 0 .12.66L4 11a7.4 7.4 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.12.66l2 3.4a.5.5 0 0 0 .6.22l2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.6a.5.5 0 0 0 .5.42h4a.5.5 0 0 0 .5-.42l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.5 1a.5.5 0 0 0 .6-.22l2-3.4a.5.5 0 0 0-.12-.66L19.4 13ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/></svg>`;
const WEATHER_ICON = `<svg viewBox="0 0 24 24"><path d="M6.5 18a4.5 4.5 0 0 1-.4-8.98A6 6 0 0 1 17.9 8.1 4.5 4.5 0 0 1 17.5 18h-11Z"/></svg>`;

/** What this app hangs off `NavItem.data` — echoed back on every event. */
interface DashboardMeta {
  owner: string;
  /** Stands in for a real per-row permission check. */
  canEdit: boolean;
}

type DashboardItem = NavItem<DashboardMeta>;

@Component({
  selector: 'app-root',
  imports: [SnapshotNavListComponent, NgxDashboardComponent, WidgetListComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private dialog = inject(MatDialog);
  /** Ticks the app, waits a frame, re-checks the element — see injectSnapshotCapture(). */
  private captureSnapshot = injectSnapshotCapture();

  // `editable` is per item, so the edit button follows the row's own rights
  // instead of one component-wide flag.
  items: DashboardItem[] = [
    {
      id: 'ops',
      label: 'Operations',
      icon: OPS_ICON,
      description: 'Fleet health and throughput',
      editable: true,
      data: { owner: 'fleet-team', canEdit: true },
    },
    {
      id: 'weather',
      label: 'Weather',
      icon: WEATHER_ICON,
      description: 'Regional forecast widgets (read-only)',
      editable: false,
      data: { owner: 'platform', canEdit: false },
    },
  ];

  activeItem = signal<DashboardItem | null>(null);
  editMode = signal(true);
  dashboardConfig = signal<DashboardDataDto | null>(null);

  captureTarget = viewChild<ElementRef<HTMLElement>>('captureTarget');

  reservedSpace = computed(
    (): ReservedSpace => ({
      top: 60,
      bottom: 16,
      left: 16,
      right: 16 + (this.editMode() ? 320 + 16 : 0),
    }),
  );

  private navigating = false;

  // The event carries the whole item — no lookup by id.
  async onSelect(item: DashboardItem) {
    if (this.navigating) return;
    if (item.id === this.activeItem()?.id) return;
    this.navigating = true;
    try {
      await this.save();
      this.activeItem.set(item);
      this.dashboardConfig.set(createEmptyDashboard(item.id, 8, 12, '0.5em'));
    } finally {
      this.navigating = false;
    }
  }

  toggleEditMode() {
    this.editMode.update((m) => !m);
  }

  onEditItem(item: DashboardItem) {
    this.dialog
      .open(EditDashboardDialogComponent, { data: item })
      .afterClosed()
      .subscribe((result: { label: string; description: string } | undefined) => {
        if (!result) return;
        this.items = this.items.map((i) => (i.id === item.id ? { ...i, label: result.label, description: result.description } : i));
        if (this.activeItem()?.id === item.id) {
          this.activeItem.set({ ...this.activeItem()!, label: result.label, description: result.description });
        }
      });
  }

  async save() {
    const item = this.activeItem();
    const target = this.captureTarget();
    if (!item || !target) return;
    // Resolves null instead of throwing when the capture couldn't happen (the
    // element went away, tainted canvas, ...) — a thumbnail is never a gate on
    // navigation.
    await this.captureSnapshot(target.nativeElement, item.id);
  }
}
