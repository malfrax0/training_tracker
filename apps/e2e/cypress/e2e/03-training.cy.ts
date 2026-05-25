/// <reference types="cypress" />

/**
 * Training mode tests.
 *
 * A dedicated session (1 exercise, 1 set, 15 s rest) is created via direct API
 * calls before the suite runs. The auth token is captured by intercepting the
 * first authenticated request the app makes after login.
 */

const TRAINING_SESSION = `E2E Training ${Date.now()}`;

describe('Training Mode', () => {
  let authHeader: string;
  let sessionId: string;

  // â”€â”€ Suite setup: create session + exercise via API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  before(() => {
    cy.loginAuth0();

    cy.intercept('GET', '/api/sessions').as('getSessions');
    cy.visit('/');
    cy.navTo('Sessions');
    cy.wait('@getSessions').then((interception) => {
      authHeader = interception.request.headers['authorization'] as string;

      // Create training session
      cy.request({
        method: 'POST',
        url: '/api/sessions',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: { name: TRAINING_SESSION },
      }).then((sessionRes) => {
        sessionId = sessionRes.body.id as string;

        // Add 1 exercise (1 set, 15 s rest so tests run fast)
        cy.request({
          method: 'POST',
          url: `/api/sessions/${sessionId}/exercises`,
          headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
          body: {
            name: 'Push-up',
            nbSeries: 1,
            defaultWeightKg: 0,
            restTimerSeconds: 15,
          },
        });
      });
    });
  });

  // â”€â”€ Suite teardown: delete session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  after(() => {
    if (!sessionId || !authHeader) return;
    cy.request({
      method: 'DELETE',
      url: `/api/sessions/${sessionId}`,
      headers: { Authorization: authHeader },
      failOnStatusCode: false,
    });
  });

  // â”€â”€ Navigate to training before each test â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  beforeEach(() => {
    cy.loginAuth0();
    cy.visit('/');
    cy.navTo('Sessions');

    cy.contains('.MuiCard-root', TRAINING_SESSION)
      .find('[data-cy="start-training-btn"]')
      .click();

    cy.url({ timeout: 10000 }).should('include', '/train');
  });

  // â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  it('loads the training page for the correct session', () => {
    cy.contains(TRAINING_SESSION).should('be.visible');
    cy.contains('Push-up').should('be.visible');
    cy.contains('Set 1').should('be.visible');
  });

  it('allows changing the weight before completing a set', () => {
    // Use {selectAll} instead of .clear() — controlled number input resets to 0
    // on clear (parseFloat('') || 0), causing .clear().type('80') to produce '800'.
    cy.get('[data-cy="weight-input"]').click().type('{selectAll}80');
    cy.get('[data-cy="weight-input"]').should('have.value', '80');
  });

  it('shows the rest timer or done screen after completing a set', () => {
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"], [data-cy="workout-done"]', { timeout: 8000 }).should(
      'be.visible',
    );
  });

  it('can skip the rest timer', () => {
    cy.get('[data-cy="set-done-btn"]').click();

    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="rest-timer"]').length) {
        cy.get('[data-cy="skip-rest-btn"]').click();
        cy.get('[data-cy="rest-timer"]').should('not.exist');
        cy.get('[data-cy="set-done-btn"]').should('be.visible');
      }
    });
  });

  it('shows Workout Done after completing all sets', () => {
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="workout-done"]', { timeout: 10000 }).should('be.visible');
    cy.contains(/Workout Done/i).should('be.visible');
  });

  it('can stop a workout early via the Stop button', () => {
    cy.contains('button', 'Stop').click();
    cy.get('[data-cy="workout-done"]', { timeout: 10000 }).should('be.visible');
  });
});

