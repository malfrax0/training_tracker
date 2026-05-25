import './commands';

// Silence uncaught Auth0 SPA exceptions that are not test failures
Cypress.on('uncaught:exception', (err) => {
  if (
    err.message.includes('auth0') ||
    err.message.includes('Auth0') ||
    err.message.includes('login_required') ||
    err.message.includes('Invalid state')
  ) {
    return false;
  }
});
