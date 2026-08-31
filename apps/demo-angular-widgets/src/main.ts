// Silence Lit's "Lit is in dev mode. Not recommended for production!" banner —
// pure noise in `ng serve`, since Angular's dev build always resolves lit's
// development condition. Left un-silenced: the 'multiple-versions' warning,
// which flags a real duplicate-install bug rather than expected dev-mode noise.
(globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings ??= new Set();
(globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings!.add('dev-mode');

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
