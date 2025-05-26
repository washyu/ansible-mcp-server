/** @type {import('jest').Config} */
export default {
  // Use Node.js native ESM support
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {},
  
  // Test file patterns - currently no Jest tests, all feature tests run independently
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/feature/', // Feature tests run independently via run-feature-tests.sh
    '/archive/'
  ],
  
  // Coverage configuration - minimal since we focus on feature tests
  collectCoverage: false,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  
  // Performance
  maxWorkers: 1,
  
  // Timeout for any remaining tests
  testTimeout: 10000,
  
  // Minimal output since main tests are feature tests
  verbose: false
};