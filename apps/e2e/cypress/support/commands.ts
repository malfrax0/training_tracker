// ─── Custom command types ────────────────────────────────────────────────────
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Log in via Auth0 Universal Login.
       * Caches the session so it is reused across specs.
       */
      loginAuth0(username?: string, password?: string): Chainable<void>;

      /**
       * Navigate to the bottom-nav tab by its label text.
       */
      navTo(label: 'Home' | 'Sessions' | 'Calendar' | 'Profile'): Chainable<void>;
    }
  }
}

// ─── loginAuth0 ───────────────────────────────────────────────────────────────
Cypress.Commands.add(
  'loginAuth0',
  (
    username = Cypress.env('auth0Username') as string,
    password = Cypress.env('auth0Password') as string,
  ) => {
    cy.session(
      // Cache key: change when credentials change
      ['auth0', username],
      () => {
        cy.visit('/');

        // App immediately calls loginWithRedirect() → we land on Auth0
        cy.origin(
          `https://${Cypress.env('auth0Domain') as string}`,
          { args: { username, password } },
          ({ username, password }) => {
            cy.get('input[name="username"]', { timeout: 15000 }).type(username);
            cy.get('input[name="password"]').type(password, { log: false });
            // Scope to the form that owns the password field to avoid matching
            // social-login buttons that also use button[type="submit"]
            cy.get('input[name="password"]')
              .closest('form')
              .find('button[type="submit"]')
              .click();
          },
        );

        // Back on our app after the redirect
        cy.url({ timeout: 20000 }).should('not.include', Cypress.env('auth0Domain') as string);
        cy.get('[data-cy="dashboard"]', { timeout: 20000 }).should('exist');
      },
      {
        cacheAcrossSpecs: true,
        // Validate by checking localStorage for the Auth0 token — avoids
        // a page visit that would redirect cross-origin when the token is gone.
        validate() {
          cy.getAllLocalStorage().then((allStorage) => {
            const stored = allStorage['http://localhost'] ?? {};
            const hasToken = Object.keys(stored).some((k) =>
              k.startsWith('@@auth0spajs@@'),
            );
            if (!hasToken) throw new Error('Auth0 token not in localStorage — re-login needed');
          });
        },
      },
    );
  },
);

// ─── navTo ────────────────────────────────────────────────────────────────────
Cypress.Commands.add('navTo', (label) => {
  cy.contains('.MuiBottomNavigationAction-root', label).click();
});
