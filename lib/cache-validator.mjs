#!/usr/bin/env node
/**
 * Cache validator utility for Best Practice and Tool Suggestion Phase
 * Validates library freshness monthly using GitHub and OSV APIs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBackup, recoverFromBackup } from './backup-manager.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Parse simple YAML structure (key: value, lists, nested objects)
 * This is a minimal parser for the specific YAML structures used in cache files
 * NOTE: This is NOT a full YAML parser - only handles basic key-value, arrays, and nesting
 */
function parseSimpleYAML(yamlString) {
  const lines = yamlString.split('\n');
  const root = {};
  const stack = [{ obj: root, indent: -1 }];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // Pop stack to correct indentation level (YAML uses indentation for nesting)
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const current = stack[stack.length - 1];

    // Handle list items
    if (trimmed.startsWith('- ')) {
      const value = trimmed.substring(2).trim();

      if (value.includes(':')) {
        // Object in list
        const [key, val] = value.split(':').map(s => s.trim());
        const listItem = {};
        listItem[key] = parseValue(val);

        if (!Array.isArray(current.obj)) {
          // Convert to array if needed
          const parent = stack[stack.length - 2];
          if (parent && parent.lastKey) {
            parent.obj[parent.lastKey] = [listItem];
            current.obj = parent.obj[parent.lastKey];
            current.listItem = listItem;
          }
        } else {
          current.obj.push(listItem);
          current.listItem = listItem;
        }

        stack.push({ obj: listItem, indent, lastKey: key });
      } else {
        // Simple list item
        if (!Array.isArray(current.obj)) {
          const parent = stack[stack.length - 2];
          if (parent && parent.lastKey) {
            parent.obj[parent.lastKey] = [parseValue(value)];
            current.obj = parent.obj[parent.lastKey];
          }
        } else {
          current.obj.push(parseValue(value));
        }
      }
    } else if (trimmed.includes(':')) {
      // Key-value pair
      const colonIndex = trimmed.indexOf(':');
      const key = trimmed.substring(0, colonIndex).trim();
      const value = trimmed.substring(colonIndex + 1).trim();

      // Check if this belongs to a list item
      if (current.listItem) {
        current.listItem[key] = parseValue(value);
        current.lastKey = key;
      } else {
        current.obj[key] = parseValue(value);
        current.lastKey = key;

        // If value is empty, prepare for nested object or array
        if (!value) {
          current.obj[key] = {};
          stack.push({ obj: current.obj[key], indent, lastKey: key });
        }
      }
    }
  }

  return root;
}

/**
 * Parse YAML value (handle strings, numbers, booleans, quoted strings)
 */
function parseValue(value) {
  if (!value) return null;

  // Remove quotes
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;

  // Number
  if (!isNaN(value) && value.trim() !== '') {
    return Number(value);
  }

  return value;
}

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
 * Check GitHub repository activity using GitHub API
 * Returns last commit date and activity status
 */
async function checkGitHubActivity(repoUrl) {
  try {
    // Extract owner and repo from URL
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      return { error: 'Invalid GitHub URL' };
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, '');

    // GitHub API endpoint for commits
    const apiUrl = `https://api.github.com/repos/${owner}/${cleanRepo}/commits?per_page=1`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'poor-dev-cache-validator'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { error: 'Repository not found', status: 404 };
      }
      return { error: `GitHub API error: ${response.status}`, status: response.status };
    }

    const commits = await response.json();

    if (!commits || commits.length === 0) {
      return { error: 'No commits found' };
    }

    const lastCommitDate = new Date(commits[0].commit.author.date);
    const now = new Date();
    const daysSinceLastCommit = Math.floor((now - lastCommitDate) / (1000 * 60 * 60 * 24));
    const monthsSinceLastCommit = Math.floor(daysSinceLastCommit / 30);

    return {
      last_commit_date: lastCommitDate.toISOString(),
      days_since_last_commit: daysSinceLastCommit,
      months_since_last_commit: monthsSinceLastCommit,
      is_active: monthsSinceLastCommit < 12,  // Active if commits within 12 months
      is_stale: monthsSinceLastCommit >= 12   // Stale if no commits for 12+ months
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Check for vulnerabilities using OSV API
 * Returns list of vulnerabilities if any
 */
async function checkOSVVulnerabilities(packageName, ecosystem = 'npm') {
  try {
    const apiUrl = 'https://api.osv.dev/v1/query';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        package: {
          name: packageName,
          ecosystem: ecosystem
        }
      })
    });

    if (!response.ok) {
      return { error: `OSV API error: ${response.status}`, status: response.status };
    }

    const data = await response.json();
    const vulnerabilities = data.vulns || [];

    return {
      has_vulnerabilities: vulnerabilities.length > 0,
      vulnerability_count: vulnerabilities.length,
      vulnerabilities: vulnerabilities.map(v => ({
        id: v.id,
        summary: v.summary,
        // OSV API may store severity in different locations depending on the database
        severity: v.database_specific?.severity || 'unknown',
        published: v.published
      }))
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Tag stale libraries with [STALE] marker
 * Marks libraries where last_commit > 12 months ago
 */
function tagStaleLibraries(libraries) {
  if (!Array.isArray(libraries)) {
    return libraries;
  }

  return libraries.map(lib => {
    if (lib.validation_status && lib.validation_status.is_stale) {
      const name = lib.name || '';
      if (!name.includes('[STALE]')) {
        return {
          ...lib,
          name: `[STALE] ${name}`
        };
      }
    }
    return lib;
  });
}

/**
 * Validate all libraries in cache file
 * Check GitHub activity and OSV vulnerabilities for each library
 */
async function validateCache(cachePath) {
  try {
    if (!fs.existsSync(cachePath)) {
      return { valid: false, error: 'Cache file not found' };
    }

    const content = fs.readFileSync(cachePath, 'utf8');
    const cache = parseSimpleYAML(content);

    const staleLibraries = [];
    const vulnerableLibraries = [];
    const validationErrors = [];

    // Validate each category and library
    if (cache.categories) {
      for (const [category, libraries] of Object.entries(cache.categories)) {
        if (!Array.isArray(libraries)) continue;

        for (const lib of libraries) {
          const libraryName = lib.name || 'unknown';

          // Check GitHub activity
          if (lib.github_url) {
            const githubCheck = await checkGitHubActivity(lib.github_url);

            if (githubCheck.error) {
              validationErrors.push({
                library: libraryName,
                category,
                error: githubCheck.error
              });
            } else {
              if (githubCheck.is_stale) {
                staleLibraries.push({
                  library: libraryName,
                  category,
                  months_since_last_commit: githubCheck.months_since_last_commit,
                  last_commit_date: githubCheck.last_commit_date
                });
              }
            }
          }

          // Check OSV vulnerabilities
          if (lib.name) {
            const osvCheck = await checkOSVVulnerabilities(lib.name);

            if (osvCheck.error) {
              validationErrors.push({
                library: libraryName,
                category,
                error: osvCheck.error
              });
            } else {
              if (osvCheck.has_vulnerabilities) {
                vulnerableLibraries.push({
                  library: libraryName,
                  category,
                  vulnerability_count: osvCheck.vulnerability_count,
                  vulnerabilities: osvCheck.vulnerabilities
                });
              }
            }
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    const valid = staleLibraries.length === 0 && vulnerableLibraries.length === 0;

    return {
      valid,
      staleLibraries,
      vulnerableLibraries,
      validationErrors,
      lastValidated: new Date().toISOString(),
      stats: {
        total_stale: staleLibraries.length,
        total_vulnerable: vulnerableLibraries.length,
        total_errors: validationErrors.length
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      lastValidated: new Date().toISOString()
    };
  }
}

/**
 * Check if cache needs validation (>= 1 month old)
 */
function checkCacheFreshness(cachePath) {
  try {
    if (!fs.existsSync(cachePath)) {
      return {
        fresh: false,
        age: null,
        needsValidation: true,
        error: 'Cache file not found'
      };
    }

    const content = fs.readFileSync(cachePath, 'utf8');
    const cache = parseSimpleYAML(content);

    const lastUpdated = cache.last_updated || cache.version?.last_updated;

    if (!lastUpdated) {
      return {
        fresh: false,
        age: null,
        needsValidation: true,
        error: 'No last_updated field found'
      };
    }

    const lastUpdatedDate = new Date(lastUpdated);
    const now = new Date();
    const ageDays = Math.floor((now - lastUpdatedDate) / (1000 * 60 * 60 * 24));
    const ageMonths = Math.floor(ageDays / 30);

    const needsValidation = ageDays >= 30; // 1 month = 30 days
    const fresh = !needsValidation;

    return {
      fresh,
      age: ageDays,
      ageMonths,
      needsValidation,
      lastUpdated: lastUpdatedDate.toISOString()
    };
  } catch (error) {
    return {
      fresh: false,
      age: null,
      needsValidation: true,
      error: error.message
    };
  }
}

/**
 * Update a specific library entry in the cache
 */
function updateCacheEntry(cachePath, category, libraryName, updates) {
  try {
    if (!fs.existsSync(cachePath)) {
      throw new Error('Cache file not found');
    }

    const content = fs.readFileSync(cachePath, 'utf8');
    const cache = parseSimpleYAML(content);

    if (!cache.categories || !cache.categories[category]) {
      throw new Error(`Category not found: ${category}`);
    }

    const libraries = cache.categories[category];
    const libraryIndex = libraries.findIndex(lib => lib.name === libraryName);

    if (libraryIndex === -1) {
      throw new Error(`Library not found: ${libraryName} in category ${category}`);
    }

    // Merge updates into existing library entry
    cache.categories[category][libraryIndex] = {
      ...cache.categories[category][libraryIndex],
      ...updates,
      last_updated: new Date().toISOString()
    };

    // Write back to file
    const yamlContent = toYAML(cache);
    fs.writeFileSync(cachePath, yamlContent, 'utf8');

    return {
      success: true,
      category,
      library: libraryName,
      updated: cache.categories[category][libraryIndex]
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Increment cache version field
 */
function incrementCacheVersion(cachePath) {
  try {
    if (!fs.existsSync(cachePath)) {
      throw new Error('Cache file not found');
    }

    const content = fs.readFileSync(cachePath, 'utf8');
    const cache = parseSimpleYAML(content);

    // Parse current version
    const currentVersion = cache.version || '1.0.0';
    const versionParts = currentVersion.split('.').map(Number);

    // Increment patch version
    versionParts[2] = (versionParts[2] || 0) + 1;
    const newVersion = versionParts.join('.');

    // Update cache
    cache.version = newVersion;
    cache.last_updated = new Date().toISOString();

    // Write back
    const yamlContent = toYAML(cache);
    fs.writeFileSync(cachePath, yamlContent, 'utf8');

    return {
      success: true,
      old_version: currentVersion,
      new_version: newVersion,
      last_updated: cache.last_updated
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Backup cache before updating, with corruption recovery
 */
async function backupAndUpdateCache(cachePath, updates) {
  try {
    // Create backup before update
    let backupPath = null;
    if (fs.existsSync(cachePath)) {
      backupPath = await createBackup(cachePath);
    }

    // Apply updates (this is a generic update function)
    // Updates should be a function that modifies the cache
    if (typeof updates === 'function') {
      const content = fs.readFileSync(cachePath, 'utf8');
      const cache = parseSimpleYAML(content);

      // Apply updates
      const updatedCache = updates(cache);

      // Write back
      const yamlContent = toYAML(updatedCache);
      fs.writeFileSync(cachePath, yamlContent, 'utf8');

      // Verify integrity
      try {
        const verifyContent = fs.readFileSync(cachePath, 'utf8');
        parseSimpleYAML(verifyContent); // This will throw if corrupted
      } catch (verifyError) {
        // Corruption detected, rollback
        if (backupPath) {
          const result = await recoverFromBackup(cachePath, backupPath);
          return {
            success: false,
            error: 'Cache corrupted after update, rolled back to backup',
            backup_restored: result.restoredFrom
          };
        } else {
          throw new Error('Cache corrupted and no backup available');
        }
      }

      return {
        success: true,
        backup_created: backupPath,
        updated_at: new Date().toISOString()
      };
    } else {
      throw new Error('Updates parameter must be a function');
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export {
  parseSimpleYAML,
  validateCache,
  checkCacheFreshness,
  tagStaleLibraries,
  updateCacheEntry,
  incrementCacheVersion,
  backupAndUpdateCache,
  checkGitHubActivity,
  checkOSVVulnerabilities
};
