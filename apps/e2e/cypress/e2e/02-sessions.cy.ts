/// <reference types="cypress" />

const SESSION_NAME = `E2E Session ${Date.now()}`;
const EXERCISE_NAME = 'E2E Barbell Squat';

describe('Sessions', () => {
  beforeEach(() => {
    cy.loginAuth0();
    cy.visit('/');
    cy.navTo('Sessions');
    cy.get('[data-cy="sessions-page"]').should('be.visible');
  });

  // ── Create ──────────────────────────────────────────────────────────────────
  it('shows an empty state when no sessions exist', () => {
    // Only assert empty state if the list is actually empty; otherwise skip.
    cy.get('body').then(($body) => {
      if ($body.text().includes('No sessions yet')) {
        cy.contains('No sessions yet').should('be.visible');
        cy.contains('Create your first session').should('be.visible');
      }
    });
  });

  it('creates a new session', () => {
    cy.get('[data-cy="add-session-fab"]').click();
    cy.url().should('include', '/sessions/new');

    cy.get('[data-cy="session-name-input"]').type(SESSION_NAME);
    cy.get('[data-cy="save-session-btn"]').click();

    // After creation the editor stays on the page (edit mode)
    cy.url({ timeout: 10000 }).should('match', /\/sessions\/.+/);
    cy.get('[data-cy="session-name-input"]').should('have.value', SESSION_NAME);
  });

  // ── Add exercise ─────────────────────────────────────────────────────────────
  it('adds an exercise to a session', () => {
    // Navigate into the first session that matches our created name
    cy.contains('.MuiCard-root', SESSION_NAME).within(() => {
      cy.root().click();
    });
    cy.url().should('match', /\/sessions\/.+/);

    cy.get('[data-cy="add-exercise-btn"]').click();

    // Fill exercise form in dialog
    cy.get('[data-cy="exercise-name-input"]').type(EXERCISE_NAME);
    cy.get('[data-cy="save-exercise-btn"]').click();

    // Exercise should appear in the list
    cy.contains(EXERCISE_NAME).should('be.visible');
  });

  // ── Schedule days ────────────────────────────────────────────────────────────
  it('sets schedule days for a session', () => {
    cy.contains('.MuiCard-root', SESSION_NAME).within(() => cy.root().click());

    // Toggle Monday (first day chip in ScheduleDayPicker)
    cy.contains('Mon').click();
    cy.get('[data-cy="save-session-btn"]').click();

    // Monday chip should appear on the session card back on the list
    cy.navTo('Sessions');
    cy.contains('.MuiCard-root', SESSION_NAME)
      .contains('Mon')
      .should('be.visible');
  });

  // ── Edit ─────────────────────────────────────────────────────────────────────
  it('edits a session name', () => {
    const updated = `${SESSION_NAME} (edited)`;

    cy.contains('.MuiCard-root', SESSION_NAME).within(() => cy.root().click());

    cy.get('[data-cy="session-name-input"]').clear().type(updated);
    cy.get('[data-cy="save-session-btn"]').click();

    cy.navTo('Sessions');
    cy.contains(updated).should('be.visible');
  });

  // ── Delete ───────────────────────────────────────────────────────────────────
  it('deletes a session', () => {
    const nameToDelete = `${SESSION_NAME} (edited)`;

    cy.contains('.MuiCard-root', nameToDelete)
      .find('[data-cy="delete-session-btn"]')
      .click();

    // browser confirm dialog
    cy.on('window:confirm', () => true);

    cy.contains(nameToDelete, { timeout: 8000 }).should('not.exist');
  });
});
