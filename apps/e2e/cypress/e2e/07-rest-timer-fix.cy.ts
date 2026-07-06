/// <reference types="cypress" />

/**
 * Regression tests for the rest-timer bug fix:
 *   1. The rest period shown between exercises must use the rest duration of
 *      the exercise that was JUST completed, not the one coming up next.
 *   2. The very last exercise of a session must also get its own rest period
 *      before the "Workout Done" screen appears (previously it was skipped
 *      entirely).
 *
 * Session layout:
 *   Exercise 1 "Long Rest Move"  — 1 set, restTimerSeconds = 30
 *   Exercise 2 "Short Rest Move" — 1 set, restTimerSeconds = 6
 */

const REST_TIMER_SESSION = `E2E Rest Timer ${Date.now()}`;

describe('Rest Timer — bug fix regression', () => {
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

      cy.request({ method: 'POST', url: '/api/sessions', headers: json, body: { name: REST_TIMER_SESSION } }).then(
        (sRes) => {
          sessionId = sRes.body.id as string;

          cy.request({
            method: 'POST',
            url: `/api/sessions/${sessionId}/exercises`,
            headers: json,
            body: { name: 'Long Rest Move', nbSeries: 1, defaultWeightKg: 0, restTimerSeconds: 30 },
          });
          cy.request({
            method: 'POST',
            url: `/api/sessions/${sessionId}/exercises`,
            headers: json,
            body: { name: 'Short Rest Move', nbSeries: 1, defaultWeightKg: 0, restTimerSeconds: 6 },
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

    cy.contains('.MuiCard-root', REST_TIMER_SESSION)
      .find('[data-cy="start-training-btn"]')
      .click();

    cy.url({ timeout: 10000 }).should('include', '/sessions/');
    cy.url().should('include', '/equipment');
    cy.get('[data-cy="equipment-start-training-btn"]').click();

    cy.url({ timeout: 10000 }).should('include', '/train');
    cy.get('[data-cy="set-done-btn"]', { timeout: 12000 }).should('be.visible');
  });

  it('uses the just-completed exercise\'s rest duration, not the next exercise\'s', () => {
    // Complete the only set of "Long Rest Move" (restTimerSeconds = 30).
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');

    // With the bug, the progress ring's denominator would be the NEXT
    // exercise's rest time (6s), which is already exceeded by ~4s elapsed
    // and the progress would stay clamped at 0 well past that point.
    // With the fix, progress should be visibly > 0 a few seconds in,
    // since the correct denominator is 30s.
    cy.wait(4000);
    cy.get('[data-cy="rest-progress"]')
      .invoke('attr', 'aria-valuenow')
      .then((value) => {
        const progress = parseFloat(value ?? '0');
        expect(progress).to.be.greaterThan(0);
        expect(progress).to.be.lessThan(50);
      });

    cy.get('[data-cy="skip-rest-btn"]').click();
  });

  it('shows a rest period after the very last exercise instead of finishing immediately', () => {
    // Finish exercise 1, skip its rest to move on quickly.
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');
    cy.get('[data-cy="skip-rest-btn"]').click();

    // Complete the last set of the last exercise ("Short Rest Move").
    cy.get('[data-cy="set-done-btn"]', { timeout: 8000 }).should('be.visible').click();

    // Regression check: previously this jumped straight to "workout-done".
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');
    cy.get('[data-cy="workout-done"]').should('not.exist');

    // Skipping the final rest should now complete the workout.
    cy.get('[data-cy="skip-rest-btn"]').click();
    cy.get('[data-cy="workout-done"]', { timeout: 8000 }).should('be.visible');
  });

  it('automatically completes the workout when the final rest period reaches zero', () => {
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');
    cy.get('[data-cy="skip-rest-btn"]').click();

    cy.get('[data-cy="set-done-btn"]', { timeout: 8000 }).should('be.visible').click();
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');

    // Let the 6-second final rest run out naturally.
    cy.get('[data-cy="workout-done"]', { timeout: 15000 }).should('be.visible');
  });
});
