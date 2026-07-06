/// <reference types="cypress" />

/**
 * Dumbbell Type field (ExerciseForm) + Equipment Summary page.
 *
 * Verifies:
 *  - the equipment/dumbbell type selector in ExerciseForm, including the
 *    "weight is doubled" hint for the 2-dumbbell option
 *  - the dumbbellType value round-trips through the API
 *  - the equipment summary page aggregates dumbbells/bars correctly, using
 *    the example from the spec: 1×4kg + 2×4kg => 2×4kg needed (not 3)
 */

const DUMBBELL_SESSION_LABEL = `E2E Dumbbell ${Date.now()}`;
const EQUIPMENT_SESSION_LABEL = `E2E Equipment ${Date.now()}`;

describe('Dumbbell Type — Exercise Form', () => {
  let authHeader: string;
  let sessionId: string;

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
        body: { name: DUMBBELL_SESSION_LABEL },
      }).then((res) => {
        sessionId = res.body.id as string;
      });
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
    cy.contains('.MuiCard-root', DUMBBELL_SESSION_LABEL).click();
    cy.url({ timeout: 10000 }).should('match', /\/sessions\/.+/);
  });

  it('defaults to "None" for a new exercise', () => {
    cy.get('[data-cy="add-exercise-btn"]').click();
    cy.get('[data-cy="dumbbell-type-none"]').should('have.attr', 'aria-pressed', 'true');
  });

  it('shows the doubled-weight hint only when "2 Dumbbell" is selected', () => {
    cy.get('[data-cy="add-exercise-btn"]').click();
    cy.get('[data-cy="two-dumbbell-hint"]').should('not.exist');

    cy.get('[data-cy="dumbbell-type-two_dumbbell"]').click();
    cy.get('[data-cy="two-dumbbell-hint"]')
      .should('be.visible')
      .and('contain.text', 'counts it twice');

    cy.get('[data-cy="dumbbell-type-one_dumbbell"]').click();
    cy.get('[data-cy="two-dumbbell-hint"]').should('not.exist');
  });

  it('saves the selected dumbbell type to the API', () => {
    const exerciseName = `Curl ${Date.now()}`;

    cy.get('[data-cy="add-exercise-btn"]').click();
    cy.get('[data-cy="exercise-name-input"]').type(exerciseName);
    cy.get('[data-cy="dumbbell-type-two_dumbbell"]').click();

    cy.intercept('POST', `/api/sessions/${sessionId}/exercises`).as('createExercise');
    cy.get('[data-cy="save-exercise-btn"]').click();

    cy.wait('@createExercise').its('response.body.dumbbellType').should('eq', 'two_dumbbell');

    // Summary line on the session editor should reflect the equipment.
    cy.contains('.MuiCard-root', exerciseName).contains('2 Dumbbell').should('be.visible');
  });

  it('preserves the dumbbell type when re-opening the exercise editor', () => {
    const exerciseName = `Bar Row ${Date.now()}`;

    cy.request({
      method: 'POST',
      url: `/api/sessions/${sessionId}/exercises`,
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: {
        name: exerciseName,
        nbSeries: 3,
        defaultWeightKg: 20,
        defaultReps: 8,
        restTimerSeconds: 60,
        dumbbellType: 'bar',
      },
    });

    cy.reload();
    cy.url({ timeout: 10000 }).should('match', /\/sessions\/.+/);

    cy.contains('.MuiCard-root', exerciseName)
      .find('[data-cy="edit-exercise-btn"]')
      .click();

    cy.get('[data-cy="dumbbell-type-bar"]').should('have.attr', 'aria-pressed', 'true');
  });
});

describe('Equipment Summary page', () => {
  let authHeader: string;
  let sessionId: string;

  // Matches the example from the spec:
  //   W1 None, W2 1 Dumbbell 4kg, W3 2 Dumbbell 4kg, W4 1 Dumbbell 6kg, W5 Bar 15kg
  // Expected result: 2× 4kg dumbbells, 1× 6kg dumbbell, 1× 15kg bar (not 3× 4kg).
  before(() => {
    cy.loginAuth0();

    cy.intercept('GET', '/api/sessions').as('getSessions');
    cy.visit('/');
    cy.navTo('Sessions');
    cy.wait('@getSessions').then((interception) => {
      authHeader = interception.request.headers['authorization'] as string;
      const json = { Authorization: authHeader, 'Content-Type': 'application/json' };

      cy.request({
        method: 'POST',
        url: '/api/sessions',
        headers: json,
        body: { name: EQUIPMENT_SESSION_LABEL },
      }).then((res) => {
        sessionId = res.body.id as string;

        const exercises = [
          { name: 'W1', nbSeries: 1, defaultWeightKg: 0, restTimerSeconds: 30, dumbbellType: 'none' },
          { name: 'W2', nbSeries: 1, defaultWeightKg: 4, restTimerSeconds: 30, dumbbellType: 'one_dumbbell' },
          { name: 'W3', nbSeries: 1, defaultWeightKg: 4, restTimerSeconds: 30, dumbbellType: 'two_dumbbell' },
          { name: 'W4', nbSeries: 1, defaultWeightKg: 6, restTimerSeconds: 30, dumbbellType: 'one_dumbbell' },
          { name: 'W5', nbSeries: 1, defaultWeightKg: 15, restTimerSeconds: 30, dumbbellType: 'bar' },
        ];
        exercises.forEach((body) => {
          cy.request({ method: 'POST', url: `/api/sessions/${sessionId}/exercises`, headers: json, body });
        });
      });
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
  });

  it('opens the equipment page instead of training mode directly when starting a session', () => {
    cy.contains('.MuiCard-root', EQUIPMENT_SESSION_LABEL)
      .find('[data-cy="start-training-btn"]')
      .click();

    cy.url({ timeout: 10000 }).should('match', /\/sessions\/.+\/equipment$/);
    cy.get('[data-cy="equipment-page"]').should('be.visible');
  });

  it('aggregates dumbbells needed by weight, counting 2-dumbbell exercises as 2', () => {
    cy.contains('.MuiCard-root', EQUIPMENT_SESSION_LABEL)
      .find('[data-cy="start-training-btn"]')
      .click();

    cy.get('[data-cy="equipment-item"]').should('have.length', 3);
    cy.get('[data-cy="equipment-item"]').eq(0).should('contain.text', '4 kg').and('contain.text', '× 2');
    cy.get('[data-cy="equipment-item"]').eq(1).should('contain.text', '6 kg').and('contain.text', '× 1');
    cy.get('[data-cy="equipment-item"]').eq(2).should('contain.text', '15 kg').and('contain.text', '× 1');
  });

  it('starts training from the equipment page', () => {
    cy.contains('.MuiCard-root', EQUIPMENT_SESSION_LABEL)
      .find('[data-cy="start-training-btn"]')
      .click();

    cy.get('[data-cy="equipment-start-training-btn"]').click();
    cy.url({ timeout: 10000 }).should('include', '/train');
  });

  it('shows a "no equipment needed" message for a session without any dumbbells', () => {
    cy.request({
      method: 'POST',
      url: '/api/sessions',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: { name: `E2E No Equipment ${Date.now()}` },
    }).then((res) => {
      const noEquipmentId = res.body.id as string;
      cy.request({
        method: 'POST',
        url: `/api/sessions/${noEquipmentId}/exercises`,
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body: { name: 'Bodyweight Move', nbSeries: 3, defaultWeightKg: 0, restTimerSeconds: 30 },
      }).then(() => {
        cy.visit(`/sessions/${noEquipmentId}/equipment`);
        cy.contains('No dumbbells or bars needed').should('be.visible');

        cy.request({
          method: 'DELETE',
          url: `/api/sessions/${noEquipmentId}`,
          headers: { Authorization: authHeader },
          failOnStatusCode: false,
        });
      });
    });
  });
});
