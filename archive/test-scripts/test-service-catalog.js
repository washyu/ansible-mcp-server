#!/usr/bin/env node

// Test script for service catalog functionality
import { serviceCatalog, serviceCategories } from './src/service-catalog.js';

console.log('Testing Service Catalog\n');

// Test 1: List all categories
console.log('Categories:');
Object.entries(serviceCategories).forEach(([key, category]) => {
  console.log(`  ${category.icon} ${category.name} (${key})`);
});

// Test 2: Count services by category
console.log('\nServices by category:');
const counts = {};
Object.values(serviceCatalog).forEach(service => {
  counts[service.category] = (counts[service.category] || 0) + 1;
});
Object.entries(counts).forEach(([category, count]) => {
  const cat = serviceCategories[category];
  console.log(`  ${cat.icon} ${cat.name}: ${count} services`);
});

// Test 3: Search for a specific service
console.log('\nSearching for "jenkins":');
const jenkins = serviceCatalog['jenkins'];
if (jenkins) {
  console.log(`  Found: ${jenkins.name}`);
  console.log(`  Description: ${jenkins.description}`);
  console.log(`  Requirements: ${jenkins.requirements.minCores} cores, ${jenkins.requirements.minMemory}MB RAM`);
  console.log(`  Alternatives: ${jenkins.alternatives.join(', ')}`);
}

// Test 4: Find all services in dev-tools category
console.log('\nDev Tools services:');
Object.entries(serviceCatalog)
  .filter(([_, service]) => service.category === 'dev-tools')
  .forEach(([key, service]) => {
    console.log(`  - ${service.name} (${key}): ${service.description}`);
  });

console.log('\nTotal services in catalog:', Object.keys(serviceCatalog).length);