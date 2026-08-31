import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideEnvironmentInitializer, inject } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { DashboardService } from '@dragonworks/ngx-dashboard';
import { ArrowWidgetComponent, LabelWidgetComponent, ClockWidgetComponent, RadialGaugeWidgetComponent } from '@dragonworks/ngx-dashboard-widgets';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideEnvironmentInitializer(() => {
      const dashboardService = inject(DashboardService);
      dashboardService.registerWidgetType(ArrowWidgetComponent);
      dashboardService.registerWidgetType(LabelWidgetComponent);
      dashboardService.registerWidgetType(ClockWidgetComponent);
      dashboardService.registerWidgetType(RadialGaugeWidgetComponent);
    }),
  ],
};
