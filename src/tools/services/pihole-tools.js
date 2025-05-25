// Pi-hole specific management tools

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import https from 'https';
import http from 'http';

// Schemas
const PiholeStatsSchema = z.object({
  host: z.string().describe('Pi-hole server address'),
  apiToken: z.string().optional().describe('API token for authenticated requests')
});

const PiholeWhitelistSchema = z.object({
  host: z.string().describe('Pi-hole server address'),
  apiToken: z.string().describe('API token (required)'),
  domain: z.string().describe('Domain to whitelist'),
  comment: z.string().optional().describe('Comment for the whitelist entry')
});

const PiholeBlacklistSchema = z.object({
  host: z.string().describe('Pi-hole server address'),
  apiToken: z.string().describe('API token (required)'),
  domain: z.string().describe('Domain to blacklist'),
  wildcard: z.boolean().optional().default(false).describe('Use wildcard blocking'),
  comment: z.string().optional().describe('Comment for the blacklist entry')
});

const PiholeQueryLogSchema = z.object({
  host: z.string().describe('Pi-hole server address'),
  apiToken: z.string().describe('API token (required)'),
  domain: z.string().optional().describe('Filter by domain'),
  client: z.string().optional().describe('Filter by client IP'),
  limit: z.number().optional().default(100).describe('Number of entries to return')
});

const PiholeDisableSchema = z.object({
  host: z.string().describe('Pi-hole server address'),
  apiToken: z.string().describe('API token (required)'),
  duration: z.number().optional().describe('Duration in seconds (omit for indefinite)')
});

// Helper function for Pi-hole API requests
async function piholeApiRequest(host, path, apiToken = null) {
  const url = `http://${host}/admin/api.php${path}`;
  const authParam = apiToken ? `&auth=${apiToken}` : '';
  
  return new Promise((resolve, reject) => {
    http.get(`${url}${authParam}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

// Tool handlers
const piholeTools = [
  {
    name: 'pihole-stats',
    description: 'Get Pi-hole statistics and status',
    inputSchema: PiholeStatsSchema,
    handler: async (args) => {
      try {
        const { host, apiToken } = args;
        
        // Get summary stats
        const summary = await piholeApiRequest(host, '?summary', apiToken);
        
        // Get top items if authenticated
        let topItems = null;
        if (apiToken) {
          topItems = await piholeApiRequest(host, '?topItems=10', apiToken);
        }
        
        const output = {
          status: summary.status,
          domains_blocked: summary.domains_being_blocked,
          dns_queries_today: summary.dns_queries_today,
          ads_blocked_today: summary.ads_blocked_today,
          ads_percentage_today: summary.ads_percentage_today,
          unique_clients: summary.unique_clients,
          queries_forwarded: summary.queries_forwarded,
          queries_cached: summary.queries_cached
        };
        
        if (topItems) {
          output.top_queries = Object.entries(topItems.top_queries || {}).slice(0, 5);
          output.top_ads = Object.entries(topItems.top_ads || {}).slice(0, 5);
        }
        
        return {
          success: true,
          output: JSON.stringify(output, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to get Pi-hole stats: ${error.message}`
        };
      }
    }
  },

  {
    name: 'pihole-whitelist',
    description: 'Add domain to Pi-hole whitelist',
    inputSchema: PiholeWhitelistSchema,
    handler: async (args) => {
      try {
        const { host, apiToken, domain, comment } = args;
        
        const params = `?list=white&add=${encodeURIComponent(domain)}`;
        const commentParam = comment ? `&comment=${encodeURIComponent(comment)}` : '';
        
        const result = await piholeApiRequest(host, `${params}${commentParam}`, apiToken);
        
        if (result.success) {
          return {
            success: true,
            output: `Added ${domain} to whitelist`,
            error: ''
          };
        } else {
          return {
            success: false,
            output: '',
            error: result.message || 'Failed to add to whitelist'
          };
        }
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to whitelist domain: ${error.message}`
        };
      }
    }
  },

  {
    name: 'pihole-blacklist',
    description: 'Add domain to Pi-hole blacklist',
    inputSchema: PiholeBlacklistSchema,
    handler: async (args) => {
      try {
        const { host, apiToken, domain, wildcard, comment } = args;
        
        const listType = wildcard ? 'regex_black' : 'black';
        const domainParam = wildcard ? `(^|\\.)${domain.replace('.', '\\.')}$` : domain;
        const params = `?list=${listType}&add=${encodeURIComponent(domainParam)}`;
        const commentParam = comment ? `&comment=${encodeURIComponent(comment)}` : '';
        
        const result = await piholeApiRequest(host, `${params}${commentParam}`, apiToken);
        
        if (result.success) {
          return {
            success: true,
            output: `Added ${domain} to blacklist${wildcard ? ' (wildcard)' : ''}`,
            error: ''
          };
        } else {
          return {
            success: false,
            output: '',
            error: result.message || 'Failed to add to blacklist'
          };
        }
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to blacklist domain: ${error.message}`
        };
      }
    }
  },

  {
    name: 'pihole-query-log',
    description: 'Query Pi-hole DNS logs',
    inputSchema: PiholeQueryLogSchema,
    handler: async (args) => {
      try {
        const { host, apiToken, domain, client, limit } = args;
        
        // Get all queries
        const queries = await piholeApiRequest(host, '?getAllQueries', apiToken);
        
        if (!queries.data || !Array.isArray(queries.data)) {
          return {
            success: false,
            output: '',
            error: 'Invalid response from Pi-hole'
          };
        }
        
        // Filter results
        let filtered = queries.data;
        
        if (domain) {
          filtered = filtered.filter(q => q[2] && q[2].includes(domain));
        }
        
        if (client) {
          filtered = filtered.filter(q => q[3] && q[3].includes(client));
        }
        
        // Limit results
        filtered = filtered.slice(0, limit);
        
        // Format output
        const formatted = filtered.map(q => ({
          timestamp: new Date(q[0] * 1000).toISOString(),
          type: q[1],
          domain: q[2],
          client: q[3],
          status: q[4] === 1 ? 'blocked' : 'allowed',
          reply_type: q[6]
        }));
        
        return {
          success: true,
          output: JSON.stringify({
            total: formatted.length,
            queries: formatted
          }, null, 2),
          error: ''
        };
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to query logs: ${error.message}`
        };
      }
    }
  },

  {
    name: 'pihole-disable',
    description: 'Temporarily disable Pi-hole blocking',
    inputSchema: PiholeDisableSchema,
    handler: async (args) => {
      try {
        const { host, apiToken, duration } = args;
        
        const params = duration ? `?disable=${duration}` : '?disable';
        const result = await piholeApiRequest(host, params, apiToken);
        
        if (result.status === 'disabled') {
          const message = duration 
            ? `Pi-hole disabled for ${duration} seconds`
            : 'Pi-hole disabled indefinitely';
          
          return {
            success: true,
            output: message,
            error: ''
          };
        } else {
          return {
            success: false,
            output: '',
            error: 'Failed to disable Pi-hole'
          };
        }
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to disable Pi-hole: ${error.message}`
        };
      }
    }
  },

  {
    name: 'pihole-enable',
    description: 'Enable Pi-hole blocking',
    inputSchema: z.object({
      host: z.string().describe('Pi-hole server address'),
      apiToken: z.string().describe('API token (required)')
    }),
    handler: async (args) => {
      try {
        const { host, apiToken } = args;
        
        const result = await piholeApiRequest(host, '?enable', apiToken);
        
        if (result.status === 'enabled') {
          return {
            success: true,
            output: 'Pi-hole enabled',
            error: ''
          };
        } else {
          return {
            success: false,
            output: '',
            error: 'Failed to enable Pi-hole'
          };
        }
      } catch (error) {
        return {
          success: false,
          output: '',
          error: `Failed to enable Pi-hole: ${error.message}`
        };
      }
    }
  }
];

// Export tools with proper schema conversion
export const toolDefinitions = piholeTools.map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema)
}));

export const toolHandlers = Object.fromEntries(
  piholeTools.map(tool => [tool.name, tool.handler])
);