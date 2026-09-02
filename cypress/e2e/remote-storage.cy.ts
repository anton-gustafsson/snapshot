/**
 * `CachedSnapshotStorage` against the gallery's fake HTTP API (~0.9s latency,
 * a 404 for `support`, a 403 for `ops`). These are the behaviours a consumer
 * would otherwise have to re-derive — see the request log the page prints.
 */
describe('server-backed storage', () => {
  beforeEach(() => {
    cy.visit('/remote-storage');
  });

  it('paints what the server has and leaves the rest unexposed', () => {
    // 'sales' and 'inventory' are seeded server-side; 'support' 404s and 'ops' 403s.
    cy.frames().find('img.thumb').should('have.length', 2);
    cy.frames().find('.thumb-placeholder').should('have.length', 2);

    cy.get('.config-snippet code')
      .should('contain.text', 'gallery-remote-support → 404')
      .and('contain.text', 'gallery-remote-ops → 403');
  });

  it('keeps a local capture when the server has nothing for it (404)', () => {
    // `support` is the 404 row: capture it here, and the server read that
    // follows must not wipe what this browser just stored.
    cy.frames().find('li').contains('Support').click();
    cy.get('.dashboard-grid').should('exist');
    cy.get('.dashboard-back').click();

    cy.frames()
      .find('li:contains("Support")')
      .find('img.thumb')
      .should('exist')
      .and(($img) => expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0));

    // The upload happened after the local write, not before it.
    cy.get('.config-snippet code').should('contain.text', 'gallery-remote-support → 204');

    // A reload replays the load path: local hit first, then the revalidation —
    // and the thumbnail is still there.
    cy.reload();
    cy.frames().find('li:contains("Support")').find('img.thumb').should('exist');
  });

  it('uploads a re-encoded copy, not the raw PNG', () => {
    cy.frames().find('li').contains('Sales').click();
    cy.get('.dashboard-grid').should('exist');
    cy.get('.dashboard-back').click();

    cy.get('.config-snippet code').should('contain.text', 'image/webp');
  });

  it('goes back to the server once the local cache is dropped', () => {
    cy.frames().find('img.thumb').should('have.length', 2);

    cy.contains('button', 'Drop local cache').click();

    cy.get('.config-snippet code').should('contain.text', 'local cache cleared');
    cy.frames().find('img.thumb').should('have.length', 2);
  });
});
