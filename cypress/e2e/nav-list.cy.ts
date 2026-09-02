/**
 * The component's rendering contract: which variant you get by default, what a
 * frame shows before anything has been captured, and that the legacy variant
 * name still works.
 */
describe('<snapshot-nav-list> rendering', () => {
  it('renders one frame per item, unexposed until something is captured', () => {
    cy.visit('/variants');

    cy.frames().find('li').should('have.length', 6);
    cy.frames().find('.thumb-placeholder').should('have.length', 6);
    cy.frames().find('img.thumb').should('not.exist');
    cy.frames().find('.label').first().should('have.text', 'Sales');
  });

  it('defaults to the card variant, with the description below the preview', () => {
    cy.visit('/dashboard-card');

    // This page sets no `variant` on the grid at the bottom — `card` is the default.
    cy.get('snapshot-nav-list[variant="card"]').should('exist');
    cy.frames('snapshot-nav-list[variant="card"]:last').find('li').should('have.length', 3);
    cy.frames('snapshot-nav-list[variant="card"]:last')
      .find('.description')
      .first()
      .should('contain.text', 'passenger flow');
    // card = contained preview, never cropped
    cy.frames('snapshot-nav-list[variant="card"]:last')
      .find('img.thumb')
      .first()
      .should('have.css', 'object-fit', 'contain');
  });

  it('accepts icon-only as an alias and reflects the canonical tile variant', () => {
    cy.visit('/variants');

    cy.get('snapshot-nav-list').then(($el) => {
      $el[0].setAttribute('variant', 'icon-only');
    });

    // Reflected back as the canonical value once Lit's update lands.
    cy.get('snapshot-nav-list').should('have.attr', 'variant', 'tile');
    cy.get('snapshot-nav-list').should(($el) => {
      expect(($el[0] as HTMLElement & { variant: string }).variant).to.equal('tile');
    });
  });

  it('shows an edit button only for the rows that allow it', () => {
    cy.visit('/text-combos');

    // Two of the six combos on this page opt into `editable`.
    cy.frames().find('.edit-button').should('have.length', 2);
  });

  it('scrolls itself when asked instead of growing the page', () => {
    cy.visit('/variants');

    cy.get('snapshot-nav-list').then(($el) => {
      const nav = $el[0];
      nav.setAttribute('scrollable', '');
      nav.style.setProperty('--snapshot-nav-list-max-height', '120px');
    });

    cy.get('snapshot-nav-list').should(($el) => {
      const nav = $el[0];
      expect(nav.scrollHeight).to.be.greaterThan(nav.clientHeight);
      expect(getComputedStyle(nav).overflowY).to.equal('auto');
    });
  });
});
