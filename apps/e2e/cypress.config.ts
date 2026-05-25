import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost',
    viewportWidth: 390,
    viewportHeight: 844,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 12000,
    // Auth0 login redirects to an external domain — required for cy.origin()
    experimentalModifyObstructiveThirdPartyCode: true,
    env: {
      // Override via CYPRESS_AUTH0_USERNAME / CYPRESS_AUTH0_PASSWORD env vars
      // or a cypress.env.json file (git-ignored)
      auth0Domain: 'dev-nadeau-leo.eu.auth0.com',
      auth0Username: '',
      auth0Password: '',
    },
    setupNodeEvents(on, config) {
      // Merge any .env values from process.env into Cypress env
      config.env.auth0Domain = process.env.AUTH0_DOMAIN ?? config.env.auth0Domain;
      config.env.auth0Username = process.env.CYPRESS_AUTH0_USERNAME ?? config.env.auth0Username;
      config.env.auth0Password = process.env.CYPRESS_AUTH0_PASSWORD ?? config.env.auth0Password;
      return config;
    },
  },
});
