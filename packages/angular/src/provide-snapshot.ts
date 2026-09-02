import { DestroyRef, InjectionToken, inject, makeEnvironmentProviders } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { SnapshotService, getDefaultSnapshotService } from '@anton-gustafsson/snapshot-core';
import type { SnapshotServiceConfig } from '@anton-gustafsson/snapshot-core';

/**
 * The `SnapshotService` `<ngx-snapshot-nav-list>` (and `injectSnapshotCapture()`)
 * use. Falls back to the package-level default instance when nothing calls
 * `provideSnapshot()`, so the simple case needs no wiring at all.
 */
export const SNAPSHOT_SERVICE = new InjectionToken<SnapshotService>('SNAPSHOT_SERVICE', {
  providedIn: 'root',
  factory: () => getDefaultSnapshotService(),
});

/**
 * Registers a configured `SnapshotService` for this injector — root providers,
 * or the `providers` of a lazy route so a feature's snapshots (and its
 * `keyPrefix`) live and die with the feature.
 *
 * `close()` runs on injector destruction, releasing the cross-tab
 * BroadcastChannel; that also clears the `keyPrefix` claim, so a re-entered
 * lazy route doesn't warn about colliding with its own previous instance.
 */
export function provideSnapshot(config: SnapshotServiceConfig = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SNAPSHOT_SERVICE,
      useFactory: () => {
        const service = new SnapshotService(config);
        inject(DestroyRef).onDestroy(() => service.close());
        return service;
      },
    },
  ]);
}
