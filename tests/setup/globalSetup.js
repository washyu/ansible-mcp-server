// Global setup - runs once before all tests
export default async () => {
  console.log('\n🚀 Setting up test environment...\n');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.MCP_TEST_MODE = 'true';
  
  // You can add database setup, test containers, etc. here
};