/**
 * Every spec starts from a clean browser store: the gallery persists thumbnails
 * in IndexedDB, so a leftover capture from a previous spec would hide the
 * placeholder/spinner states the tests assert on.
 */
beforeEach(() => {
  cy.clearAllLocalStorage();
  indexedDB.deleteDatabase('keyval-store');
});

/**
 * The component's markup lives in a shadow root, and a descendant selector
 * can't cross that boundary — so every query goes host first, then `.shadow()`.
 * `frames()` is that pair, plus an optional host selector for the pages that
 * mount more than one list.
 */
Cypress.Commands.add('frames', (host = 'snapshot-nav-list') => cy.get(host).shadow());
