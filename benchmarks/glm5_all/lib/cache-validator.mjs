#!/usr/bin/env node
/**
 * Cache validator utility for Best Practice and Tool Suggestion Phase
 * Validates library freshness monthly using GitHub and OSV APIs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBackup, recoverFromBackup } from './backup-manager.mjs';
import { parseYAML, toYAML } from './suggestion-parser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

/** Default fetch timeout in milliseconds */
const FETCH_TIMEOUT_MS = 10000;

/**
 * Validate that a file path is within the project root
 * Prevents path traversal attacks (e.g., ../../etc/passwd)
 * @param {string} filePath - File path to validate
 * @throws {Error} If path is outside project root
 */
function validatePathWithinProject(filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(PROJECT_ROOT + path.sep) && resolved !== PROJECT_ROOT) {
    throw new Error(`Path traversal detected: ${filePath} is outside project root`);
  }
}

/**
 * Fetch with timeout using AbortController
 * @param {string} url - URL to fetch
 * @param {Object} [options] - Fetch options
 * @param {number} [timeoutMs] - Timeout in milliseconds (default: 10000)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

    const response = await fetchWithTimeout(apiUrl, {
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

    const response = await fetchWithTimeout(apiUrl, {
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
    validatePathWithinProject(cachePath);
    if (!fs.existsSync(cachePath)) {
      return { valid: false, error: 'Cache file not found' };
    }

    const content = fs.readFileSync(cachePath, 'utf8');
    const cache = parseYAML(content);

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
    validatePathWithinProject(cachePath);
    if (!fs.existsSync(cachePath)) {
      return {
        fresh: false,
        age: null,
        needsValidation: true,
        error: 'Cache file not found'
      };
    }

    const content = fs.readFileSync(cachePath, 'utf8');
    const cache = parseYAML(content);

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
    validatePathWithinProject(cachePath);
    if (!fs.existsSync(cachePath)) {
      throw new Error('Cache file not found');
    }

    const content = fs.readFileSync(cachePath, 'utf8');
    const cache = parseYAML(content);

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
    validatePathWithinProject(cachePath);
    if (!fs.existsSync(cachePath)) {
      throw new Error('Cache file not found');
    }

    const content = fs.readFileSync(cachePath, 'utf8');
    const cache = parseYAML(content);

    // Parse current version
    const currentVersion = String(cache.version || '1.0.0');
    const versionParts = currentVersion.split('.').map(Number);
    while (versionParts.length < 3) versionParts.push(0);

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
    validatePathWithinProject(cachePath);
    // Create backup before update
    let backupPath = null;
    if (fs.existsSync(cachePath)) {
      backupPath = await createBackup(cachePath);
    }

    // Apply updates (this is a generic update function)
    // Updates should be a function that modifies the cache
    if (typeof updates === 'function') {
    let cache;
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf8');
      cache = parseYAML(content);
    } else {
      cache = {};
    }

      // Apply updates
      const updatedCache = updates(cache);

      if (!updatedCache || typeof updatedCache !== 'object') {
        throw new Error('Cache corrupted after update: updates returned invalid value');
      }

      // Write back
      const yamlContent = toYAML(updatedCache);
      fs.writeFileSync(cachePath, yamlContent, 'utf8');

      // Verify integrity
      try {
        const verifyContent = fs.readFileSync(cachePath, 'utf8');
        parseYAML(verifyContent); // This will throw if corrupted
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
  validateCache,
  checkCacheFreshness,
  tagStaleLibraries,
  updateCacheEntry,
  incrementCacheVersion,
  backupAndUpdateCache,
  checkGitHubActivity,
  checkOSVVulnerabilities
};
