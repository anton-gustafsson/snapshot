/**
 * The whole point of the library, end to end in a real browser: open a view,
 * leave it, and the frame you left shows an actual html2canvas capture of it —
 * stored in IndexedDB, so it survives a reload.
 */
describe('capture round trip', () => {
  it('captures a view on the way out and paints it into the frame', () => {
    cy.visit('/icon-grid');

    cy.frames().find('li').first().click();
    cy.get('.dashboard-grid .dash-widget').should('have.length.greaterThan', 0);

    // Leaving the dashboard triggers the capture (see pages/dashboard.ts).
    cy.get('.dashboard-back').click();

    cy.frames()
      .find('img.thumb')
      .should('have.length', 1)
      .and(($img) => {
        expect($img.attr('src')).to.match(/^blob:/);
        expect(($img[0] as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
      });
  });

  it('serves the stored capture from IndexedDB after a full reload', () => {
    cy.visit('/icon-grid');
    cy.frames().find('li').first().click();
    cy.get('.dashboard-grid').should('exist');
    cy.get('.dashboard-back').click();
    cy.frames().find('img.thumb').should('have.length', 1);

    cy.reload();

    cy.frames().find('img.thumb').should('have.length', 1);
  });

  it('shows a spinner while a slow storage resolves, then the image', () => {
    cy.visit('/loading');

    // 2.2s of deliberate latency in this page's storage.
    cy.frames().find('.spinner').should('have.length', 4);
    cy.frames().find('img.thumb').should('have.length', 4);
    cy.frames().find('.spinner').should('not.exist');
  });
});
