import { defineConfig } from 'cypress';

/**
 * UI tests run against the gallery app (`npm run dev:gallery`), because it's
 * the only place the whole loop is real: a live `<snapshot-nav-list>`, real
 * html2canvas captures, real IndexedDB, and a page per storage recipe.
 *
 * `includeShadowDom` is on globally — every meaningful element in the component
 * lives inside its shadow root.
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3200',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    includeShadowDom: true,
    video: false,
    screenshotOnRunFailure: false,
    viewportWidth: 1280,
    viewportHeight: 900,
    // A capture is html2canvas + an IndexedDB write; the storage demos add a
    // deliberate ~1.2s of fake latency on top.
    defaultCommandTimeout: 12000,
  },
});
