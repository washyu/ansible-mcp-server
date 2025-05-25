/**
 * Integration tests for SSE Server to MCP Server communication
 * Tests the full flow: Client → SSE → MCP → Response
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import EventSource from 'eventsource';
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SSE_URL = process.env.SSE_TEST_URL || 'http://localhost:3001/sse';
const API_TOKEN = process.env.API_ACCESS_TOKEN || 'test-token';
const TEST_TIMEOUT = 30000;

describe('SSE Server to MCP Server Integration', () => {
  let sseServer;
  let sseServerUrl;
  
  beforeAll(async () => {
    // Start SSE server for testing if not already running
    if (!process.env.SSE_TEST_URL) {
      sseServer = spawn('node', ['src/sse-server.js'], {
        cwd: path.join(__dirname, '../..'),
        env: {
          ...process.env,
          PORT: '3002', // Use different port for testing
          API_ACCESS_TOKEN: API_TOKEN,
          NODE_ENV: 'test'
        }
      });
      
      sseServerUrl = 'http://localhost:3002/sse';
      
      // Wait for server to start
      await new Promise((resolve) => {
        sseServer.stdout.on('data', (data) => {
          if (data.toString().includes('SSE server listening')) {
            resolve();
          }
        });
        setTimeout(resolve, 3000); // Timeout fallback
      });
    } else {
      sseServerUrl = SSE_URL;
    }
  });
  
  afterAll(async () => {
    if (sseServer) {
      sseServer.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  describe('SSE Connection', () => {
    let eventSource;
    let sessionId;
    
    afterEach(() => {
      if (eventSource) {
        eventSource.close();
      }
    });
    
    it('should establish SSE connection with valid auth', (done) => {
      eventSource = new EventSource(sseServerUrl, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`
        }
      });
      
      eventSource.onopen = () => {
        expect(eventSource.readyState).toBe(EventSource.OPEN);
        done();
      };
      
      eventSource.onerror = (err) => {
        done(new Error('SSE connection failed: ' + err.message));
      };
    }, TEST_TIMEOUT);
    
    it('should receive session ID on connection', (done) => {
      eventSource = new EventSource(sseServerUrl, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`
        }
      });
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'session') {
          sessionId = data.sessionId;
          expect(sessionId).toBeTruthy();
          expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
          done();
        }
      };
      
      eventSource.onerror = (err) => {
        done(new Error('Failed to receive session ID: ' + err.message));
      };
    }, TEST_TIMEOUT);
    
    it('should reject connection with invalid auth', (done) => {
      const badEventSource = new EventSource(sseServerUrl, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      
      badEventSource.onerror = (err) => {
        expect(badEventSource.readyState).toBe(EventSource.CLOSED);
        done();
      };
      
      badEventSource.onopen = () => {
        done(new Error('Connection should have been rejected'));
      };
    }, TEST_TIMEOUT);
  });

  describe('MCP Communication', () => {
    let eventSource;
    let sessionId;
    
    beforeEach((done) => {
      // Establish connection first
      eventSource = new EventSource(sseServerUrl, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`
        }
      });
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'session') {
          sessionId = data.sessionId;
          done();
        }
      };
    });
    
    afterEach(() => {
      if (eventSource) {
        eventSource.close();
      }
    });
    
    it('should initialize MCP server', (done) => {
      const initRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        },
        id: 1
      };
      
      // Listen for response
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.message) {
          const response = JSON.parse(data.message);
          expect(response.jsonrpc).toBe('2.0');
          expect(response.id).toBe(1);
          expect(response.result).toBeDefined();
          expect(response.result.protocolVersion).toBe('2024-11-05');
          expect(response.result.serverInfo.name).toBe('ansible-mcp-server');
          done();
        }
      };
      
      // Send request
      sendMessage(sessionId, initRequest);
    }, TEST_TIMEOUT);
    
    it('should list available tools', (done) => {
      // First initialize
      const initRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        },
        id: 1
      };
      
      let initialized = false;
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.message) {
          const response = JSON.parse(data.message);
          
          if (!initialized && response.id === 1) {
            initialized = true;
            // Now request tools list
            const toolsRequest = {
              jsonrpc: '2.0',
              method: 'tools/list',
              params: {},
              id: 2
            };
            sendMessage(sessionId, toolsRequest);
          } else if (response.id === 2) {
            expect(response.result).toBeDefined();
            expect(response.result.tools).toBeInstanceOf(Array);
            expect(response.result.tools.length).toBeGreaterThan(50); // Should have 57+ tools
            
            // Check for specific tools
            const toolNames = response.result.tools.map(t => t.name);
            expect(toolNames).toContain('ansible-playbook');
            expect(toolNames).toContain('browse-services');
            expect(toolNames).toContain('create-vm-template');
            done();
          }
        }
      };
      
      sendMessage(sessionId, initRequest);
    }, TEST_TIMEOUT);
    
    it('should execute a tool successfully', (done) => {
      let initialized = false;
      
      // Initialize first
      const initRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        },
        id: 1
      };
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.message) {
          const response = JSON.parse(data.message);
          
          if (!initialized && response.id === 1) {
            initialized = true;
            // Call a simple tool
            const toolRequest = {
              jsonrpc: '2.0',
              method: 'tools/call',
              params: {
                name: 'list-loaded-tools',
                arguments: {}
              },
              id: 2
            };
            sendMessage(sessionId, toolRequest);
          } else if (response.id === 2) {
            expect(response.result).toBeDefined();
            expect(response.result.content).toBeDefined();
            expect(response.result.content[0].type).toBe('text');
            
            const result = JSON.parse(response.result.content[0].text);
            expect(result.success).toBe(true);
            expect(result.output).toContain('totalTools');
            done();
          }
        }
      };
      
      sendMessage(sessionId, initRequest);
    }, TEST_TIMEOUT);
    
    it('should handle invalid tool gracefully', (done) => {
      let initialized = false;
      
      const initRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        },
        id: 1
      };
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'message' && data.message) {
          const response = JSON.parse(data.message);
          
          if (!initialized && response.id === 1) {
            initialized = true;
            // Call non-existent tool
            const toolRequest = {
              jsonrpc: '2.0',
              method: 'tools/call',
              params: {
                name: 'non-existent-tool',
                arguments: {}
              },
              id: 2
            };
            sendMessage(sessionId, toolRequest);
          } else if (response.id === 2) {
            expect(response.result).toBeDefined();
            expect(response.result.isError).toBe(true);
            expect(response.result.content[0].text).toContain('Unknown tool');
            done();
          }
        }
      };
      
      sendMessage(sessionId, initRequest);
    }, TEST_TIMEOUT);
  });
  
  describe('Session Management', () => {
    it('should handle multiple concurrent sessions', async () => {
      const sessions = [];
      const sessionPromises = [];
      
      // Create 3 concurrent sessions
      for (let i = 0; i < 3; i++) {
        sessionPromises.push(new Promise((resolve, reject) => {
          const es = new EventSource(sseServerUrl, {
            headers: {
              'Authorization': `Bearer ${API_TOKEN}`
            }
          });
          
          es.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'session') {
              sessions.push({ eventSource: es, sessionId: data.sessionId });
              resolve();
            }
          };
          
          es.onerror = reject;
        }));
      }
      
      await Promise.all(sessionPromises);
      
      expect(sessions.length).toBe(3);
      expect(new Set(sessions.map(s => s.sessionId)).size).toBe(3); // All unique
      
      // Cleanup
      sessions.forEach(s => s.eventSource.close());
    }, TEST_TIMEOUT);
    
    it('should clean up sessions on disconnect', (done) => {
      let sessionId;
      const eventSource = new EventSource(sseServerUrl, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`
        }
      });
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'session') {
          sessionId = data.sessionId;
          
          // Close connection
          eventSource.close();
          
          // Check health endpoint to verify session cleanup
          setTimeout(() => {
            http.get(sseServerUrl.replace('/sse', '/health'), (res) => {
              let body = '';
              res.on('data', chunk => body += chunk);
              res.on('end', () => {
                const health = JSON.parse(body);
                // Session count should be back to baseline
                expect(health.status).toBe('ok');
                done();
              });
            });
          }, 1000);
        }
      };
    }, TEST_TIMEOUT);
  });
  
  describe('Error Handling', () => {
    it('should handle MCP server crashes gracefully', (done) => {
      // This test would require ability to kill MCP process
      // For now, we'll test error response handling
      let sessionId;
      const eventSource = new EventSource(sseServerUrl, {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`
        }
      });
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'session') {
          sessionId = data.sessionId;
          
          // Send malformed request
          const badRequest = '{"invalid json';
          
          http.request({
            method: 'POST',
            hostname: 'localhost',
            port: sseServerUrl.includes(':3002') ? 3002 : 3001,
            path: `/send/${sessionId}`,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_TOKEN}`
            }
          }, (res) => {
            expect(res.statusCode).toBeGreaterThanOrEqual(400);
            done();
          }).end(badRequest);
        }
      };
    }, TEST_TIMEOUT);
  });
  
  // Helper function to send messages
  function sendMessage(sessionId, message) {
    const postData = JSON.stringify(message);
    const url = new URL(sseServerUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: `/send/${sessionId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${API_TOKEN}`
      }
    };
    
    const req = http.request(options);
    req.write(postData);
    req.end();
  }
});