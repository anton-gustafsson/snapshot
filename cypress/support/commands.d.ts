declare namespace Cypress {
  interface Chainable {
    /** Host element(s) matching `host`, then their shadow root — see `frames()` in support/e2e.ts. */
    frames(host?: string): Chainable<JQuery<HTMLElement>>;
  }
}
