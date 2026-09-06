import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection,
  inject,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideSnapshot } from '@anton-gustafsson/snapshot-angular';
import { DashboardService } from '@dragonworks/ngx-dashboard';
import { ArrowWidgetComponent, LabelWidgetComponent, ClockWidgetComponent, RadialGaugeWidgetComponent } from '@dragonworks/ngx-dashboard-widgets';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    // One place to configure the service: the component and
    // injectSnapshotCapture() both pick it up from DI, so nothing binds
    // [snapshotService] anywhere.
    provideSnapshot({
      keyPrefix: 'demo-angular-widgets:',
      scale: 0.5,
      encode: { type: 'image/webp', quality: 0.8, maxEdge: 640 },
    }),
    provideEnvironmentInitializer(() => {
      const dashboardService = inject(DashboardService);
      dashboardService.registerWidgetType(ArrowWidgetComponent);
      dashboardService.registerWidgetType(LabelWidgetComponent);
      dashboardService.registerWidgetType(ClockWidgetComponent);
      dashboardService.registerWidgetType(RadialGaugeWidgetComponent);
    }),
  ],
};
