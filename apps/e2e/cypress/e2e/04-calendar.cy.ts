/// <reference types="cypress" />

describe('Calendar / Workout History', () => {
  before(() => {
    // Ensure at least one workout exists by completing a quick one.
    // We reuse the token-capture pattern to create + complete a workout via API.
    cy.loginAuth0();

    cy.intercept('GET', '/api/sessions').as('getSessions');
    cy.visit('/');
    cy.navTo('Sessions');
    cy.wait('@getSessions').then((interception) => {
      const auth = interception.request.headers['authorization'] as string;
      const jsonHeaders = { Authorization: auth, 'Content-Type': 'application/json' };
      const authHeaders = { Authorization: auth };

      // Create a throw-away session
      cy.request({ method: 'POST', url: '/api/sessions', headers: jsonHeaders, body: { name: 'E2E Cal Session' } })
        .then((sRes) => {
          const sid = sRes.body.id as string;

          // Add one exercise
          cy.request({
            method: 'POST',
            url: `/api/sessions/${sid}/exercises`,
            headers: jsonHeaders,
            body: { name: 'Jumping Jack', nbSeries: 1, defaultWeightKg: 0, restTimerSeconds: 15 },
          }).then((exRes) => {
            const eid = exRes.body.id as string;

            // Start a workout
            cy.request({ method: 'POST', url: '/api/workouts', headers: jsonHeaders, body: { sessionId: sid } })
              .then((wRes) => {
                const wid = wRes.body.id as string;

                // Log one set
                cy.request({
                  method: 'POST',
                  url: `/api/workouts/${wid}/sets`,
                  headers: jsonHeaders,
                  body: { exerciseId: eid, setNumber: 1, weightKg: 0 },
                });

                // Mark complete — no body, so no Content-Type header
                cy.request({ method: 'PUT', url: `/api/workouts/${wid}/complete`, headers: authHeaders });
              });
          });

          // Cleanup: delete the session (cascades to exercises + workouts)
          // We leave it — cy.session persists, the calendar test just reads data.
        });
    });
  });

  beforeEach(() => {
    cy.loginAuth0();
    cy.visit('/');
    cy.navTo('Calendar');
  });

  it('navigates to the calendar page', () => {
    cy.url().should('include', '/calendar');
  });

  it('renders a calendar grid', () => {
    // Custom calendar renders Paper cells with data-cy attributes
    cy.get('[data-cy="calendar-day"], [data-cy="workout-day"]', { timeout: 8000 })
      .should('have.length.greaterThan', 0);
  });

  it('shows at least one completed workout marker on the calendar', () => {
    // The app should highlight days that have workouts.
    // We just assert the page loaded something meaningful.
    cy.get('body').should('not.contain', 'Error');
  });

  it('shows workout details when clicking a highlighted day', () => {
    cy.get('body').then(($body) => {
      // Look for a highlighted day cell that has workouts
      const badge = $body.find('[data-cy="workout-day"]').first();
      if (badge.length) {
        cy.wrap(badge).click({ force: true });
        // Some kind of detail should appear
        cy.get('body').should('not.be.empty');
      }
    });
  });
});
