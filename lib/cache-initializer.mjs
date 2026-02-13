#!/usr/bin/env node
/**
 * Cache initializer for Best Practice and Tool Suggestion Phase
 * Initializes exploration cache with pre-seeded data for common library categories
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(PROJECT_ROOT, '.poor-dev', 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'exploration-cache.yaml');

/**
 * Pre-seeded library data for common categories
 */
const PRESEEDED_DATA = {
  version: '1.0.0',
  last_updated: new Date().toISOString(),
  categories: {
    authentication: [
      {
        name: 'passport',
        description: 'Express middleware for Node.js authentication',
        npm_url: 'https://www.npmjs.com/package/passport',
        github_url: 'https://github.com/jaredhanson/passport',
        maintainability_score: 85,
        security_score: 90,
        evidence: ['Widely used authentication library', 'Active community support', 'Extensive strategy ecosystem']
      },
      {
        name: 'bcrypt',
        description: ' bcrypt for Node.js',
        npm_url: 'https://www.npmjs.com/package/bcrypt',
        github_url: 'https://github.com/kelektiv/node.bcrypt.js',
        maintainability_score: 80,
        security_score: 95,
        evidence: ['Standard for password hashing', 'Well-tested implementation', 'No known critical vulnerabilities']
      },
      {
        name: 'jsonwebtoken',
        description: 'JSON Web Token implementation for Node.js',
        npm_url: 'https://www.npmjs.com/package/jsonwebtoken',
        github_url: 'https://github.com/auth0/node-jsonwebtoken',
        maintainability_score: 88,
        security_score: 85,
        evidence: ['Industry standard for JWT', 'Active maintenance', 'Comprehensive documentation']
      }
    ],
    database: [
      {
        name: 'prisma',
        description: 'Next-generation ORM for Node.js and TypeScript',
        npm_url: 'https://www.npmjs.com/package/@prisma/client',
        github_url: 'https://github.com/prisma/prisma',
        maintainability_score: 95,
        security_score: 90,
        evidence: ['Type-safe database access', 'Active development', 'Strong community']
      },
      {
        name: 'typeorm',
        description: 'ORM for TypeScript and JavaScript (ES6, ES7, ES8)',
        npm_url: 'https://www.npmjs.com/package/typeorm',
        github_url: 'https://github.com/typeorm/typeorm',
        maintainability_score: 85,
        security_score: 85,
        evidence: ['Decorators-based API', 'Support for multiple databases', 'Active contributors']
      },
      {
        name: 'sequelize',
        description: 'Promise-based Node.js ORM for PostgreSQL, MySQL, MariaDB, SQLite and MSSQL',
        npm_url: 'https://www.npmjs.com/package/sequelize',
        github_url: 'https://github.com/sequelize/sequelize',
        maintainability_score: 88,
        security_score: 82,
        evidence: ['Mature and stable', 'Cross-database support', 'Comprehensive documentation']
      },
      {
        name: 'mongoose',
        description: 'Elegant MongoDB object modeling for Node.js',
        npm_url: 'https://www.npmjs.com/package/mongoose',
        github_url: 'https://github.com/Automattic/mongoose',
        maintainability_score: 90,
        security_score: 88,
        evidence: ['Popular MongoDB ODM', 'Active maintenance', 'Rich feature set']
      }
    ],
    api: [
      {
        name: 'express',
        description: 'Fast, unopinionated, minimalist web framework for Node.js',
        npm_url: 'https://www.npmjs.com/package/express',
        github_url: 'https://github.com/expressjs/express',
        maintainability_score: 92,
        security_score: 88,
        evidence: ['Most popular Node.js framework', 'Huge ecosystem', 'Battle-tested']
      },
      {
        name: 'fastify',
        description: 'Fast and low overhead web framework, for Node.js',
        npm_url: 'https://www.npmjs.com/package/fastify',
        github_url: 'https://github.com/fastify/fastify',
        maintainability_score: 90,
        security_score: 92,
        evidence: ['High performance', 'Built-in validation', 'Plugin architecture']
      },
      {
        name: 'koa',
        description: 'Next generation web framework designed by the team behind Express',
        npm_url: 'https://www.npmjs.com/package/koa',
        github_url: 'https://github.com/koajs/koa',
        maintainability_score: 85,
        security_score: 85,
        evidence: ['Modern async/await support', 'Minimalist design', 'Strong middleware ecosystem']
      },
      {
        name: 'hono',
        description: 'Ultrafast web framework for Cloudflare Workers, Deno, and Bun',
        npm_url: 'https://www.npmjs.com/package/hono',
        github_url: 'https://github.com/honojs/hono',
        maintainability_score: 88,
        security_score: 85,
        evidence: ['Modern TypeScript-first framework', 'Excellent performance', 'Active development']
      }
    ],
    logging: [
      {
        name: 'winston',
        description: 'A multi-transport async logging library for Node.js',
        npm_url: 'https://www.npmjs.com/package/winston',
        github_url: 'https://github.com/winstonjs/winston',
        maintainability_score: 90,
        security_score: 88,
        evidence: ['Industry standard', 'Multiple transports', 'Flexible configuration']
      },
      {
        name: 'pino',
        description: 'Very low overhead Node.js logger',
        npm_url: 'https://www.npmjs.com/package/pino',
        github_url: 'https://github.com/pinojs/pino',
        maintainability_score: 92,
        security_score: 90,
        evidence: ['Extremely fast', 'JSON logging', 'Strong TypeScript support']
      },
      {
        name: 'morgan',
        description: 'HTTP request logger middleware for node.js',
        npm_url: 'https://www.npmjs.com/package/morgan',
        github_url: 'https://github.com/expressjs/morgan',
        maintainability_score: 88,
        security_score: 85,
        evidence: ['Simple and effective', 'Predefined formats', 'Express.js ecosystem']
      }
    ],
    testing: [
      {
        name: 'jest',
        description: 'Delightful JavaScript Testing Framework with a focus on simplicity',
        npm_url: 'https://www.npmjs.com/package/jest',
        github_url: 'https://github.com/jestjs/jest',
        maintainability_score: 95,
        security_score: 92,
        evidence: ['Most popular testing framework', 'All-in-one solution', 'Facebook maintained']
      },
      {
        name: 'vitest',
        description: 'Next generation testing framework powered by Vite',
        npm_url: 'https://www.npmjs.com/package/vitest',
        github_url: 'https://github.com/vitest-dev/vitest',
        maintainability_score: 92,
        security_score: 90,
        evidence: ['Fast and modern', 'Jest-compatible', 'Native ESM support']
      },
      {
        name: 'mocha',
        description: 'Simple, flexible, fun JavaScript test framework for Node.js & The Browser',
        npm_url: 'https://www.npmjs.com/package/mocha',
        github_url: 'https://github.com/mochajs/mocha',
        maintainability_score: 90,
        security_score: 88,
        evidence: ['Mature and stable', 'Flexible configuration', 'Large ecosystem']
      },
      {
        name: 'chai',
        description: 'BDD / TDD assertion library for node.js and the browser',
        npm_url: 'https://www.npmjs.com/package/chai',
        github_url: 'https://github.com/chaijs/chai',
        maintainability_score: 88,
        security_score: 85,
        evidence: ['Popular assertion library', 'Works with any runner', 'Clean syntax']
      }
    ]
  }
};

/**
 * Format object as YAML
 */
function toYAML(obj, indent = 0) {
  const spaces = ' '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`;
    } else if (typeof value === 'string') {
      if (value.includes('\n') || value.includes(':') || value.startsWith('"')) {
        yaml += `${spaces}${key}: "${value.replace(/"/g, '\\"')}"\n`;
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      yaml += `${spaces}${key}: ${value}\n`;
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          yaml += `${spaces}  - name: ${item.name}\n`;
          for (const [k, v] of Object.entries(item)) {
            if (k === 'name') continue;
            if (typeof v === 'object' && v !== null && Array.isArray(v)) {
              yaml += `${spaces}    ${k}:\n`;
              for (const arrItem of v) {
                yaml += `${spaces}      - "${arrItem}"\n`;
              }
            } else if (typeof v === 'string') {
              yaml += `${spaces}    ${k}: "${v}"\n`;
            } else {
              yaml += `${spaces}    ${k}: ${v}\n`;
            }
          }
        } else if (typeof item === 'string') {
          yaml += `${spaces}  - "${item}"\n`;
        } else {
          yaml += `${spaces}  - ${item}\n`;
        }
      }
    } else if (typeof value === 'object') {
      yaml += `${spaces}${key}:\n`;
      yaml += toYAML(value, indent + 2);
    }
  }

  return yaml;
}

/**
 * Initialize cache file
 */
function initializeCache() {
  console.log('Initializing exploration cache...');

  if (!fs.existsSync(CACHE_DIR)) {
    console.log(`Creating cache directory: ${CACHE_DIR}`);
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  if (fs.existsSync(CACHE_FILE)) {
    console.log(`Cache file already exists: ${CACHE_FILE}`);
    console.log('Skipping initialization (use --force to overwrite)');
    return;
  }

  console.log(`Creating cache file: ${CACHE_FILE}`);
  const yamlContent = toYAML(PRESEEDED_DATA);
  fs.writeFileSync(CACHE_FILE, yamlContent, 'utf8');
  console.log('Cache initialized with pre-seeded data:');
  console.log(`  - ${Object.keys(PRESEEDED_DATA.categories).length} categories`);
  console.log(`  - ${Object.values(PRESEEDED_DATA.categories).reduce((sum, cat) => sum + cat.length, 0)} libraries`);
}

/**
 * Force reinitialize cache
 */
function forceInitializeCache() {
  console.log('Force reinitializing exploration cache...');

  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  console.log(`Overwriting cache file: ${CACHE_FILE}`);
  const yamlContent = toYAML(PRESEEDED_DATA);
  fs.writeFileSync(CACHE_FILE, yamlContent, 'utf8');
  console.log('Cache reinitialized with pre-seeded data');
}

/**
 * Show cache status
 */
function showCacheStatus() {
  if (!fs.existsSync(CACHE_FILE)) {
    console.log('Cache file does not exist');
    return;
  }

  const stats = fs.statSync(CACHE_FILE);
  console.log(`Cache file: ${CACHE_FILE}`);
  console.log(`Size: ${stats.size} bytes`);
  console.log(`Last modified: ${stats.mtime.toISOString()}`);
  console.log(`Last updated: ${PRESEEDED_DATA.last_updated}`);
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--force')) {
    forceInitializeCache();
  } else if (args.includes('--status')) {
    showCacheStatus();
  } else {
    initializeCache();
  }
}

main();
