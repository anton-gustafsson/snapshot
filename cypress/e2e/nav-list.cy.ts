/**
 * The component's rendering contract: what a frame shows before anything has
 * been captured, and the card layout's own preview/description shape (the
 * only layout the component renders).
 */
describe('<snapshot-nav-list> rendering', () => {
  it('renders one frame per item, unexposed until something is captured', () => {
    // Backed by a deliberately slow storage (see /loading), so the frames
    // are still unexposed by the time these assertions run.
    cy.visit('/loading');

    cy.frames().find('li').should('have.length', 4);
    cy.frames().find('img.thumb').should('not.exist');
  });

  it('shows the description below a contained (never-cropped) preview', () => {
    cy.visit('/dashboard-card');

    // The "In a grid" section's list — the third <snapshot-nav-list> on the page.
    cy.frames().eq(2).find('li').should('have.length', 3);
    cy.frames().eq(2).find('.description').first().should('contain.text', 'passenger flow');
    cy.frames().eq(2).find('img.thumb').first().should('have.css', 'object-fit', 'contain');
  });

  it('shows an edit button only for the rows that allow it', () => {
    cy.visit('/text-combos');

    // Three of the six combos on this page opt into `editable`.
    cy.frames().find('.edit-button').should('have.length', 3);
  });

  it('scrolls itself when asked instead of growing the page', () => {
    cy.visit('/dashboard-card');

    // The "In a grid" section's list (3 cards) — enough content to overflow.
    cy.get('snapshot-nav-list').eq(2).then(($el) => {
      const nav = $el[0];
      nav.setAttribute('scrollable', '');
      nav.style.setProperty('--snapshot-nav-list-max-height', '120px');
    });

    cy.get('snapshot-nav-list').eq(2).should(($el) => {
      const nav = $el[0];
      expect(nav.scrollHeight).to.be.greaterThan(nav.clientHeight);
      expect(getComputedStyle(nav).overflowY).to.equal('auto');
    });
  });
});
