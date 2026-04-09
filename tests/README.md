# TweetPilot Test Suite

## Test Structure

- `tests/unit/` - Unit tests for isolated components and utilities
- `tests/integration/` - Integration tests for component interactions
- `tests/e2e/` - End-to-end tests for full application flows

## Running Tests

```bash
# Run all unit and integration tests
npm run test:unit

# Run tests in watch mode
npm test

# Run end-to-end tests (requires built application)
npm run test:e2e

# Run all tests
npm run test:all
```

## Test Setup

- Test framework: Vitest
- E2E framework: Playwright
- Testing library: @testing-library/react
- Environment: jsdom (for unit/integration tests)

## Writing Tests

Tests should follow the existing patterns:
- Unit tests verify isolated functionality
- Integration tests verify component rendering and interactions
- E2E tests verify full application startup and navigation
