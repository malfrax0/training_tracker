/// <reference types="cypress" />

describe('Authentication', () => {
  it('redirects unauthenticated users to Auth0', () => {
    cy.clearAllSessionStorage();
    cy.clearAllCookies();
    cy.clearAllLocalStorage();

    cy.visit('/');
    // App calls loginWithRedirect() — browser ends up on Auth0 domain.
    // Use cy.origin() to assert something exists on that page.
    cy.origin(`https://${Cypress.env('auth0Domain') as string}`, () => {
      cy.get('input[name="username"]', { timeout: 15000 }).should('be.visible');
    });
  });

  it('shows the dashboard after a successful login', () => {
    cy.loginAuth0();
    cy.visit('/');
    cy.get('[data-cy="dashboard"]').should('be.visible');
  });

  it('greets the authenticated user by name', () => {
    cy.loginAuth0();
    cy.visit('/');
    // Dashboard shows "Hey, <name> 👋"
    cy.get('[data-cy="dashboard"]').contains(/Hey,/i).should('be.visible');
  });

  it('logs out and redirects to Auth0 logout endpoint', () => {
    cy.loginAuth0();
    cy.visit('/');
    cy.navTo('Profile');

    cy.get('[data-cy="logout-btn"]').click();

    // After logout the app should leave the local origin
    cy.url({ timeout: 15000 }).should('not.include', 'localhost');
  });
});
