/// <reference types="cypress" />

/**
 * Exercise Form — new features: default reps and exercise image.
 *
 * A session is created via API before the suite runs so we can navigate
 * directly into the editor without going through the creation flow.
 */

const FORM_TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const SESSION_LABEL = `E2E Form Features ${Date.now()}`;

describe('Exercise Form — Reps & Image', () => {
  let authHeader: string;
  let sessionId: string;

  // ── Suite setup ─────────────────────────────────────────────────────────────
  before(() => {
    cy.loginAuth0();

    cy.intercept('GET', '/api/sessions').as('getSessions');
    cy.visit('/');
    cy.navTo('Sessions');
    cy.wait('@getSessions').then((interception) => {
      authHeader = interception.request.headers['authorization'] as string;

      cy.request({
        method: 'POST',
        url: '/api/sessions',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: { name: SESSION_LABEL },
      }).then((res) => {
        sessionId = res.body.id as string;
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

  // ── Navigate into the session editor before each test ──────────────────────
  beforeEach(() => {
    cy.loginAuth0();
    cy.visit('/');
    cy.navTo('Sessions');
    cy.contains('.MuiCard-root', SESSION_LABEL).click();
    cy.url({ timeout: 10000 }).should('match', /\/sessions\/.+/);
  });

  // ── Default reps ────────────────────────────────────────────────────────────
  it('shows "Default reps: 8" as the default in a new exercise form', () => {
    cy.get('[data-cy="add-exercise-btn"]').click();
    cy.contains('Default reps: 8').should('be.visible');
  });

  it('preserves a custom defaultReps value created via API', () => {
    // Create exercise via API with defaultReps = 12
    cy.request({
      method: 'POST',
      url: `/api/sessions/${sessionId}/exercises`,
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: { name: 'Chin-up', nbSeries: 2, defaultWeightKg: 0, defaultReps: 12, restTimerSeconds: 60 },
    });

    cy.reload();
    cy.url({ timeout: 10000 }).should('match', /\/sessions\/.+/);

    // Open exercise editor
    cy.contains('.MuiCard-root', 'Chin-up')
      .find('[data-cy="edit-exercise-btn"]')
      .click();

    cy.contains('Default reps: 12').should('be.visible');
  });

  // ── Image URL ────────────────────────────────────────────────────────────────
  it('shows the image drop zone when no image is set', () => {
    cy.get('[data-cy="add-exercise-btn"]').click();
    // Drop zone text should be visible
    cy.contains('Drop an image or click to browse').should('be.visible');
  });

  it('applies a URL as the exercise image and shows a preview', () => {
    cy.get('[data-cy="add-exercise-btn"]').click();

    // Paste a data URL and apply it
    cy.get('[data-cy="image-url-input"]').type(FORM_TINY_PNG);
    cy.get('[data-cy="use-url-btn"]').click();

    // Preview image should appear
    cy.get('[data-cy="image-preview"]').should('be.visible').and('have.attr', 'src', FORM_TINY_PNG);
  });

  it('removes the image preview when the remove button is clicked', () => {
    cy.get('[data-cy="add-exercise-btn"]').click();

    cy.get('[data-cy="image-url-input"]').type(FORM_TINY_PNG);
    cy.get('[data-cy="use-url-btn"]').click();
    cy.get('[data-cy="image-preview"]').should('be.visible');

    cy.get('[data-cy="remove-image-btn"]').click();
    cy.get('[data-cy="image-preview"]').should('not.exist');
    cy.contains('Drop an image or click to browse').should('be.visible');
  });

  it('saves an exercise with an image and the image persists when re-editing', () => {
    const exerciseName = `Image Exercise ${Date.now()}`;

    cy.get('[data-cy="add-exercise-btn"]').click();
    cy.get('[data-cy="exercise-name-input"]').type(exerciseName);
    cy.get('[data-cy="image-url-input"]').type(FORM_TINY_PNG);
    cy.get('[data-cy="use-url-btn"]').click();
    cy.get('[data-cy="save-exercise-btn"]').click();

    cy.contains(exerciseName).should('be.visible');

    // Reload session and open the exercise editor again
    cy.reload();
    cy.url({ timeout: 10000 }).should('match', /\/sessions\/.+/);

    cy.contains('.MuiCard-root', exerciseName)
      .find('[data-cy="edit-exercise-btn"]')
      .click();

    cy.get('[data-cy="image-preview"]', { timeout: 8000 }).should('be.visible');
  });

  // ── Reps slider — create + verify via API ────────────────────────────────────
  it('saves defaultReps to the API when an exercise is created', () => {
    const exerciseName = `Reps Test ${Date.now()}`;

    cy.get('[data-cy="add-exercise-btn"]').click();
    cy.get('[data-cy="exercise-name-input"]').type(exerciseName);

    // Default is 8; we confirm it
    cy.contains('Default reps: 8').should('be.visible');

    cy.intercept('POST', `/api/sessions/${sessionId}/exercises`).as('createExercise');
    cy.get('[data-cy="save-exercise-btn"]').click();

    cy.wait('@createExercise').its('response.body.defaultReps').should('eq', 8);
  });
});
