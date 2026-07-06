/// <reference types="cypress" />

/**
 * Training Mode — new features:
 *   - Reps input (editable, default from exercise definition)
 *   - Auto-save weight + reps defaults after a set with changed values
 *   - "One more set" button (extra set increments the counter)
 *   - Next exercise preview card during rest
 *   - Progress percentage in the app bar
 *   - Exercise image shown in training step
 *
 * Session layout:
 *   Exercise 1 "Bench Press"  — 2 sets, 15 s rest, defaultWeightKg=60, defaultReps=10
 *   Exercise 2 "Plank"        — 1 set,  15 s rest, defaultReps=5
 *
 * 15-second rest keeps the timer tests fast.
 * Audio (10-second warning beep / done beep) is verified behaviourally:
 * AudioContext is a browser-level API and its actual sound output cannot be
 * reliably asserted in an E2E environment — the DOM-level behaviour (timer
 * reaching 0 → rest ends) is used as a proxy instead.
 */

const TRAINING_TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const TRAINING_FEATURES_SESSION = `E2E Training Features ${Date.now()}`;

describe('Training Mode — New Features', () => {
  let authHeader: string;
  let sessionId: string;
  let exercise1Id: string;

  // ── Suite setup ─────────────────────────────────────────────────────────────
  before(() => {
    cy.loginAuth0();

    cy.intercept('GET', '/api/sessions').as('getSessions');
    cy.visit('/');
    cy.navTo('Sessions');
    cy.wait('@getSessions').then((interception) => {
      authHeader = interception.request.headers['authorization'] as string;
      const json = { Authorization: authHeader, 'Content-Type': 'application/json' };

      cy.request({ method: 'POST', url: '/api/sessions', headers: json, body: { name: TRAINING_FEATURES_SESSION } })
        .then((sRes) => {
          sessionId = sRes.body.id as string;

          // Exercise 1: 2 sets, image, defaultReps=10
          cy.request({
            method: 'POST',
            url: `/api/sessions/${sessionId}/exercises`,
            headers: json,
            body: {
              name: 'Bench Press',
              nbSeries: 2,
              defaultWeightKg: 60,
              defaultReps: 10,
              restTimerSeconds: 15,
              imageData: TRAINING_TINY_PNG,
            },
          }).then((ex1Res) => {
            exercise1Id = ex1Res.body.id as string;
          });

          // Exercise 2: 1 set, defaultReps=5
          cy.request({
            method: 'POST',
            url: `/api/sessions/${sessionId}/exercises`,
            headers: json,
            body: {
              name: 'Plank',
              nbSeries: 1,
              defaultWeightKg: 0,
              defaultReps: 5,
              restTimerSeconds: 15,
            },
          });
        });
    });
  });

  // ── Suite teardown ──────────────────────────────────────────────────────────
  after(() => {
    if (!sessionId || !authHeader) return;
    cy.request({
      method: 'DELETE',
      url: `/api/sessions/${sessionId}`,
      headers: { Authorization: authHeader },
      failOnStatusCode: false,
    });
  });

  // ── Navigate to training before each test ───────────────────────────────────
  beforeEach(() => {
    cy.loginAuth0();
    cy.visit('/');
    cy.navTo('Sessions');

    cy.contains('.MuiCard-root', TRAINING_FEATURES_SESSION)
      .find('[data-cy="start-training-btn"]')
      .click();

    cy.url({ timeout: 10000 }).should('include', '/equipment');
    cy.get('[data-cy="equipment-start-training-btn"]').click();

    cy.url({ timeout: 10000 }).should('include', '/train');
    // Wait until the first exercise step is visible
    cy.get('[data-cy="set-done-btn"]', { timeout: 12000 }).should('be.visible');
  });

  // ── Reps input ───────────────────────────────────────────────────────────────
  it('shows a reps input field in the exercise step', () => {
    cy.get('[data-cy="reps-input"]').should('be.visible');
  });

  it('pre-fills reps with the exercise default value', () => {
    // Exercise 1 has defaultReps = 10
    cy.get('[data-cy="reps-input"]').should('have.value', '10');
  });

  it('allows changing the reps value', () => {
    cy.get('[data-cy="reps-input"]').click().type('{selectAll}15');
    cy.get('[data-cy="reps-input"]').should('have.value', '15');
  });

  it('clamps reps input to the 0–20 range', () => {
    cy.get('[data-cy="reps-input"]').click().type('{selectAll}25');
    // The onChange handler clamps to 20
    cy.get('[data-cy="reps-input"]').should('have.value', '20');
  });

  // ── Exercise image ───────────────────────────────────────────────────────────
  it('shows the exercise image in the training step when one is set', () => {
    cy.get('[data-cy="exercise-image"]').should('be.visible').and('have.attr', 'src', TRAINING_TINY_PNG);
  });

  // ── Progress percentage ──────────────────────────────────────────────────────
  it('shows a progress percentage of 0% before any sets are completed', () => {
    cy.get('[data-cy="progress-pct"]').should('contain', '0%');
  });

  it('increases the progress percentage after completing a set', () => {
    // 3 total sets (2 + 1), completing 1 → 33%
    cy.get('[data-cy="set-done-btn"]').click();
    // Either rest timer or done screen appears
    cy.get('[data-cy="rest-timer"], [data-cy="workout-done"]', { timeout: 8000 }).should('be.visible');
    cy.get('[data-cy="progress-pct"]').invoke('text').then((text) => {
      const pct = parseInt(text, 10);
      expect(pct).to.be.greaterThan(0);
    });
  });

  // ── Rest timer buttons ───────────────────────────────────────────────────────
  it('shows "One more set" button during the rest timer', () => {
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');
    cy.get('[data-cy="add-extra-set-btn"]').should('be.visible');
  });

  it('increments the set counter after clicking "One more set"', () => {
    // Start: Set 1 of 2
    cy.contains('Set 1 of 2').should('be.visible');

    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');

    // Add one extra set → effective total becomes 3
    cy.get('[data-cy="add-extra-set-btn"]').click();
    cy.get('[data-cy="skip-rest-btn"]').click();

    // Should now show Set 2 of 3
    cy.contains('Set 2 of 3', { timeout: 8000 }).should('be.visible');
  });

  it('allows adding multiple extra sets', () => {
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');

    // Add two extra sets
    cy.get('[data-cy="add-extra-set-btn"]').click();
    cy.get('[data-cy="add-extra-set-btn"]').click();
    cy.get('[data-cy="skip-rest-btn"]').click();

    // Set 2 of 4 (original 2 + 2 extras)
    cy.contains('Set 2 of 4', { timeout: 8000 }).should('be.visible');
  });

  // ── Next exercise card ───────────────────────────────────────────────────────
  it('shows the next exercise card during rest between sets', () => {
    // After set 1 of exercise 1, currentExerciseIndex is still 0 → nextExercise = Plank
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');

    cy.contains('Up next').should('be.visible');
    cy.contains('Plank').should('be.visible');
  });

  it('shows default reps and sets chips in the next exercise card', () => {
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');

    // Plank: 1 set, 5 reps
    cy.contains('1 sets').should('be.visible');
    cy.contains('5 reps').should('be.visible');
  });

  // ── Auto-save weight and reps defaults ──────────────────────────────────────
  it('auto-saves updated weight and reps to the exercise defaults after completing a set', () => {
    cy.intercept('PATCH', `/api/exercises/${exercise1Id}/defaults`).as('updateDefaults');

    // Change weight to 80 and reps to 12
    cy.get('[data-cy="weight-input"]').click().type('{selectAll}80');
    cy.get('[data-cy="reps-input"]').click().type('{selectAll}12');
    cy.get('[data-cy="set-done-btn"]').click();

    cy.wait('@updateDefaults').then((interception) => {
      expect(interception.request.body).to.deep.include({
        defaultWeightKg: 80,
        defaultReps: 12,
      });
      expect(interception.response?.statusCode).to.eq(200);
    });
  });

  it('does NOT call the defaults update when weight and reps are unchanged', () => {
    cy.intercept('PATCH', `/api/exercises/*/defaults`).as('updateDefaults');

    // Complete with the unchanged defaults (60 kg, 10 reps)
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"], [data-cy="workout-done"]', { timeout: 8000 }).should('be.visible');

    // The intercept should never have been called
    cy.get('@updateDefaults.all').should('have.length', 0);
  });

  it('updated defaults persist in the exercise definition after the workout', () => {
    const newWeight = 75;
    const newReps = 9;

    cy.intercept('PATCH', `/api/exercises/${exercise1Id}/defaults`).as('updateDefaults');

    cy.get('[data-cy="weight-input"]').click().type(`{selectAll}${newWeight}`);
    cy.get('[data-cy="reps-input"]').click().type(`{selectAll}${newReps}`);
    cy.get('[data-cy="set-done-btn"]').click();

    cy.wait('@updateDefaults');

    // Verify via a direct GET that the exercise now has the updated defaults
    cy.request({
      method: 'GET',
      url: `/api/sessions/${sessionId}`,
      headers: { Authorization: authHeader },
    }).then((res) => {
      const exercise = (res.body.exercises as Array<{ id: string; defaultWeightKg: number; defaultReps: number }>)
        .find((ex) => ex.id === exercise1Id);
      expect(exercise?.defaultWeightKg).to.eq(newWeight);
      expect(exercise?.defaultReps).to.eq(newReps);
    });
  });

  // ── Timer behaviour (proxy for sound triggers) ───────────────────────────────
  it('rest timer counts down and automatically ends when it reaches zero', () => {
    cy.get('[data-cy="set-done-btn"]').click();
    cy.get('[data-cy="rest-timer"]', { timeout: 8000 }).should('be.visible');

    // Wait for the 15-second timer to expire naturally
    // (timer ends → isResting becomes false → ExerciseStep re-appears)
    cy.get('[data-cy="set-done-btn"]', { timeout: 25000 }).should('be.visible');
    cy.get('[data-cy="rest-timer"]').should('not.exist');
  });
});
