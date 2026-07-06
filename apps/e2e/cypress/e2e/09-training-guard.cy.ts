/// <reference types="cypress" />

/**
 * Confirm-before-leaving guard: while a workout is in progress, navigating
 * away (back arrow, Stop button, or bottom nav tabs) must show a confirmation
 * dialog instead of leaving immediately.
 *
 * Session layout: 1 exercise, 2 sets, 15 s rest — long enough to stay
 * "in progress" for the duration of each test.
 */

const GUARD_SESSION = `E2E Guard ${Date.now()}`;

describe('Training guard — confirm before leaving', () => {
  let authHeader: string;
  let sessionId: string;

  before(() => {
    cy.loginAuth0();

    cy.intercept('GET', '/api/sessions').as('getSessions');
    cy.visit('/');
    cy.navTo('Sessions');
    cy.wait('@getSessions').then((interception) => {
      authHeader = interception.request.headers['authorization'] as string;
      const json = { Authorization: authHeader, 'Content-Type': 'application/json' };

      cy.request({ method: 'POST', url: '/api/sessions', headers: json, body: { name: GUARD_SESSION } }).then(
        (sRes) => {
          sessionId = sRes.body.id as string;

          cy.request({
            method: 'POST',
            url: `/api/sessions/${sessionId}/exercises`,
            headers: json,
            body: { name: 'Squat', nbSeries: 2, defaultWeightKg: 0, restTimerSeconds: 15 },
          });
        },
      );
    });
  });

  after(() => {
    if (!sessionId || !authHeader) return;
    cy.request({
      method: 'DELETE',
      url: `/api/sessions/${sessionId}`,
      headers: { Authorization: authHeader },
      failOnStatusCode: false,
    });
  });

  beforeEach(() => {
    cy.loginAuth0();
    cy.visit('/');
    cy.navTo('Sessions');

    cy.contains('.MuiCard-root', GUARD_SESSION)
      .find('[data-cy="start-training-btn"]')
      .click();

    cy.url({ timeout: 10000 }).should('include', '/equipment');
    cy.get('[data-cy="equipment-start-training-btn"]').click();

    cy.url({ timeout: 10000 }).should('include', '/train');
    cy.get('[data-cy="set-done-btn"]', { timeout: 12000 }).should('be.visible');
  });

  it('does not prompt when leaving a page with no active workout', () => {
    // Finish the workout first so the guard is no longer active.
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"]').should('be.visible');
    cy.get('[data-cy="skip-rest-btn"]').click();
    cy.get('[data-cy="set-done-btn"]').click();
    // Last set of the last exercise now also gets its own final rest period.
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');
    cy.get('[data-cy="skip-rest-btn"]').click();
    cy.get('[data-cy="workout-done"]', { timeout: 10000 }).should('be.visible');

    cy.navTo('Sessions');
    cy.get('[data-cy="confirm-dialog"]').should('not.exist');
    cy.url().should('include', '/sessions');
  });

  it('shows a confirmation dialog when tapping the back arrow during an active workout', () => {
    cy.get('[data-cy="training-back-btn"]').click();
    cy.get('[data-cy="confirm-dialog"]').should('be.visible');

    // Cancelling keeps the user on the training page.
    cy.get('[data-cy="confirm-dialog-cancel"]').click();
    cy.get('[data-cy="confirm-dialog"]').should('not.exist');
    cy.url().should('include', '/train');
    cy.get('[data-cy="set-done-btn"]').should('be.visible');
  });

  it('leaves the training page after confirming from the back arrow', () => {
    cy.get('[data-cy="training-back-btn"]').click();
    cy.get('[data-cy="confirm-dialog"]').should('be.visible');
    cy.get('[data-cy="confirm-dialog-confirm"]').click();

    cy.get('[data-cy="confirm-dialog"]').should('not.exist');
    cy.url({ timeout: 8000 }).should('not.include', '/train');
  });

  it('shows a confirmation dialog when tapping Stop during an active workout', () => {
    cy.get('[data-cy="stop-workout-btn"]').click();
    cy.get('[data-cy="confirm-dialog"]').should('be.visible');

    cy.get('[data-cy="confirm-dialog-cancel"]').click();
    cy.get('[data-cy="confirm-dialog"]').should('not.exist');
    cy.get('[data-cy="set-done-btn"]').should('be.visible');
  });

  it('finishes the workout after confirming Stop', () => {
    cy.get('[data-cy="stop-workout-btn"]').click();
    cy.get('[data-cy="confirm-dialog-confirm"]').click();

    cy.get('[data-cy="workout-done"]', { timeout: 10000 }).should('be.visible');
  });

  it('shows a confirmation dialog when tapping a bottom nav tab during an active workout', () => {
    cy.navTo('Calendar');
    cy.get('[data-cy="confirm-dialog"]').should('be.visible');

    // Cancel keeps the user in training mode.
    cy.get('[data-cy="confirm-dialog-cancel"]').click();
    cy.url().should('include', '/train');

    // Confirming navigates to the requested tab.
    cy.navTo('Calendar');
    cy.get('[data-cy="confirm-dialog-confirm"]').click();
    cy.url({ timeout: 8000 }).should('include', '/calendar');
  });
});
