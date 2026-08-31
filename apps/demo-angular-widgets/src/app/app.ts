import { Component, ElementRef, computed, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { SnapshotNavListComponent } from '@snapshot/angular';
import { snapshotService } from '@snapshot/core';
import type { NavItem } from '@snapshot/core';
import {
  DashboardComponent as NgxDashboardComponent,
  WidgetListComponent,
  createEmptyDashboard,
  type ReservedSpace,
  type DashboardDataDto,
} from '@dragonworks/ngx-dashboard';

@Component({
  selector: 'app-root',
  imports: [SnapshotNavListComponent, NgxDashboardComponent, WidgetListComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  items: NavItem[] = [
    { id: 'ops', label: 'Operations', icon: '⚙' },
    { id: 'weather', label: 'Weather', icon: '☀' },
  ];

  activeItem = signal<NavItem | null>(null);
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

  async onSelect(detail: { id: string }) {
    if (this.navigating) return;
    const item = this.items.find((i) => i.id === detail.id) ?? null;
    if (item?.id === this.activeItem()?.id) return;
    this.navigating = true;
    try {
      await this.save();
      this.activeItem.set(item);
      this.dashboardConfig.set(item ? createEmptyDashboard(item.id, 8, 12, '0.5em') : null);
    } finally {
      this.navigating = false;
    }
  }

  toggleEditMode() {
    this.editMode.update((m) => !m);
  }

  async save() {
    const item = this.activeItem();
    const target = this.captureTarget();
    if (item && target) {
      try {
        await snapshotService.capture(target.nativeElement, item.id);
      } catch (err) {
        // A thumbnail is a nice-to-have, not a gate — don't let a capture
        // failure (e.g. tainted canvas from cross-origin widget content)
        // block the user from navigating away from this dashboard.
        console.error(`Failed to save snapshot for "${item.id}"`, err);
      }
    }
  }
}
