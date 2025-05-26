import { describe, it, expect } from '@jest/globals';
import { toolRegistry } from '../../src/tools/index.js';

describe('Tool Registry', () => {
  it('should have all tools properly registered', () => {
    const allTools = toolRegistry.getAllDefinitions();
    
    // Check that we have tools registered
    expect(allTools.length).toBeGreaterThan(0);
    
    // Check each tool has required properties
    allTools.forEach(tool => {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      
      // Verify name is a non-empty string
      expect(typeof tool.name).toBe('string');
      expect(tool.name.length).toBeGreaterThan(0);
      
      // Verify description is a non-empty string
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(0);
      
      // Verify inputSchema is an object
      expect(typeof tool.inputSchema).toBe('object');
      expect(tool.inputSchema).not.toBeNull();
      
      // Verify each tool has a handler
      const handler = toolRegistry.getHandler(tool.name);
      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
    });
  });

  it('should have unique tool names', () => {
    const allTools = toolRegistry.getAllDefinitions();
    const toolNames = allTools.map(t => t.name);
    const uniqueNames = [...new Set(toolNames)];
    
    expect(toolNames.length).toBe(uniqueNames.length);
  });

  it('should include list-hosts tool', () => {
    const allTools = toolRegistry.getAllDefinitions();
    const listHostsTool = allTools.find(t => t.name === 'list-hosts');
    
    expect(listHostsTool).toBeDefined();
    expect(listHostsTool.description).toBe('List all hosts in inventory');
    
    // Check the handler exists
    const handler = toolRegistry.getHandler('list-hosts');
    expect(handler).toBeDefined();
    expect(typeof handler).toBe('function');
  });

  it('should have proper tool categories', () => {
    const allTools = toolRegistry.getAllDefinitions();
    
    // Group tools by prefix/category
    const categories = {
      ansible: allTools.filter(t => t.name.startsWith('ansible-')),
      terraform: allTools.filter(t => t.name.startsWith('terraform-')),
      security: allTools.filter(t => t.name.startsWith('security-')),
      other: allTools.filter(t => !t.name.startsWith('ansible-') && 
                                !t.name.startsWith('terraform-') && 
                                !t.name.startsWith('security-'))
    };
    
    // Ensure we have tools in each major category
    expect(categories.ansible.length).toBeGreaterThan(0);
    expect(categories.terraform.length).toBeGreaterThan(0);
    expect(categories.security.length).toBeGreaterThan(0);
    
    console.log('Tool distribution:', {
      ansible: categories.ansible.length,
      terraform: categories.terraform.length,
      security: categories.security.length,
      other: categories.other.length,
      total: allTools.length
    });
  });

  it('should list all available tools', () => {
    const allTools = toolRegistry.getAllDefinitions();
    const toolList = allTools.map(t => `${t.name}: ${t.description}`);
    
    console.log('\nAll registered tools:');
    toolList.sort().forEach(tool => console.log(`  - ${tool}`));
    console.log(`\nTotal tools: ${allTools.length}`);
  });
});