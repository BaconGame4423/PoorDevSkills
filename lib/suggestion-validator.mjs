// suggestion-validator.mjs
// Best Practice and Tool Suggestion Phase - Validation and Scoring

import { createHash } from 'crypto';

// ============================================================================
// SCORING ALGORITHMS
// ============================================================================

/**
 * Calculate maintainability score (0-100)
 * @param {Object} params
 * @param {number} params.commitRecencyMonths - Months since last commit
 * @param {number} params.issueResolutionRate - Percentage (0-100)
 * @param {number} params.activeContributors - Number of active contributors
 * @param {boolean} params.hasCompleteDocs - Has complete documentation
 * @param {boolean} params.hasExamples - Has examples in docs
 * @returns {number} Score 0-100
 */
export function calculateMaintainabilityScore({
  commitRecencyMonths,
  issueResolutionRate,
  activeContributors,
  hasCompleteDocs,
  hasExamples
}) {
  let score = 0;

  // Commit recency (0-30)
  if (commitRecencyMonths < 6) {
    score += 30;
  } else if (commitRecencyMonths < 12) {
    score += 20;
  } else if (commitRecencyMonths < 18) {
    score += 10;
  }

  // Issue resolution rate (0-30)
  if (issueResolutionRate > 90) {
    score += 30;
  } else if (issueResolutionRate > 70) {
    score += 20;
  } else if (issueResolutionRate > 50) {
    score += 10;
  }

  // Contributor activity (0-20)
  if (activeContributors >= 5) {
    score += 20;
  } else if (activeContributors >= 3) {
    score += 15;
  } else if (activeContributors >= 1) {
    score += 10;
  }

  // Documentation quality (0-20)
  if (hasCompleteDocs && hasExamples) {
    score += 20;
  } else if (hasCompleteDocs) {
    score += 15;
  } else if (hasCompleteDocs || hasExamples) {
    score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Calculate security score (0-100)
 * @param {Object} params
 * @param {number} params.criticalCVEs - Number of critical CVEs
 * @param {number} params.nonCriticalCVEs - Number of non-critical CVEs
 * @param {boolean} params.hasRecentAudit - Has security audit within 12 months
 * @param {boolean} params.hasOldAudit - Has security audit older than 12 months
 * @param {boolean} params.allDepsUpToDate - All dependencies up to date
 * @param {boolean} params.someOutdated - Some dependencies outdated (non-critical)
 * @param {boolean} params.hasHighCoverage - Has high test coverage (>80%)
 * @param {boolean} params.hasLinter - Uses linter for code quality
 * @returns {number} Score 0-100
 */
export function calculateSecurityScore({
  criticalCVEs,
  nonCriticalCVEs,
  hasRecentAudit,
  hasOldAudit,
  allDepsUpToDate,
  someOutdated,
  hasHighCoverage,
  hasLinter
}) {
  let score = 0;

  // Known vulnerabilities (0-40)
  if (criticalCVEs > 0) {
    score += 0;
  } else if (nonCriticalCVEs === 0) {
    score += 40;
  } else {
    score += 20;
  }

  // Security audit status (0-30)
  if (hasRecentAudit) {
    score += 30;
  } else if (hasOldAudit) {
    score += 15;
  }

  // Dependency health (0-20)
  if (allDepsUpToDate) {
    score += 20;
  } else if (someOutdated) {
    score += 10;
  }

  // Code quality indicators (0-10)
  if (hasHighCoverage && hasLinter) {
    score += 10;
  } else if (hasHighCoverage || hasLinter) {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

// ============================================================================
// FILTERING AND VALIDATION
// ============================================================================

/**
 * Filter suggestions by threshold (both scores >= 50)
 * @param {Array<Object>} suggestions - Array of suggestion objects
 * @returns {Array<Object>} Filtered suggestions
 */
export function filterByThreshold(suggestions) {
  return suggestions.filter(s => {
    const maintainability = s.maintainabilityScore ?? 0;
    const security = s.securityScore ?? 0;
    return maintainability >= 50 && security >= 50;
  });
}

/**
 * Apply warning markers based on score analysis
 * @param {Object} suggestion - Suggestion object with scores
 * @returns {Object} Suggestion with applied markers
 */
export function applyWarningMarkers(suggestion) {
  const { maintainabilityScore = 0, securityScore = 0 } = suggestion;
  const markers = [];

  // Mixed scores: one >= 75, other < 60
  if (
    (maintainabilityScore >= 75 && securityScore < 60) ||
    (securityScore >= 75 && maintainabilityScore < 60)
  ) {
    markers.push('[RISK]');
  }

  // Scores in 50-59 range
  if (
    (maintainabilityScore >= 50 && maintainabilityScore < 60) ||
    (securityScore >= 50 && securityScore < 60)
  ) {
    if (!markers.includes('[RISK]')) {
      markers.push('[CAUTION]');
    }
  }

  return {
    ...suggestion,
    markers: markers.length > 0 ? markers : undefined
  };
}

/**
 * Validate if suggestion meets inclusion criteria
 * @param {Object} suggestion - Suggestion object with scores
 * @returns {Object} {included, excluded, warnings[]}
 */
export function validateSuggestion(suggestion) {
  const { maintainabilityScore = 0, securityScore = 0, criticalCVEs = 0 } = suggestion;
  const warnings = [];

  // Exclusion: critical CVEs
  if (criticalCVEs > 0) {
    return {
      included: false,
      excluded: true,
      warnings: [`Critical CVEs detected: ${criticalCVEs}`]
    };
  }

  // Exclusion: either score < 50
  if (maintainabilityScore < 50) {
    warnings.push(`Low maintainability score: ${maintainabilityScore}`);
  }
  if (securityScore < 50) {
    warnings.push(`Low security score: ${securityScore}`);
  }

  if (warnings.length > 0) {
    return {
      included: false,
      excluded: true,
      warnings
    };
  }

  // Check for warning conditions
  if (maintainabilityScore >= 75 && securityScore < 60) {
    warnings.push('High maintainability but lower security score');
  }
  if (securityScore >= 75 && maintainabilityScore < 60) {
    warnings.push('High security but lower maintainability score');
  }
  if (maintainabilityScore >= 50 && maintainabilityScore < 60) {
    warnings.push('Borderline maintainability score');
  }
  if (securityScore >= 50 && securityScore < 60) {
    warnings.push('Borderline security score');
  }

  return {
    included: true,
    excluded: false,
    warnings
  };
}

// ============================================================================
// API INTEGRATION
// ============================================================================

/**
 * Fetch maintainability data from GitHub REST API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} Maintainability metrics
 */
export async function fetchMaintainabilityData(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {};

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // Calculate commit recency
  const lastUpdate = new Date(data.pushed_at);
  const now = new Date();
  const commitRecencyMonths = Math.floor(
    (now - lastUpdate) / (1000 * 60 * 60 * 24 * 30)
  );

  // Fetch contributors (top 30 to get active count)
  const contributorsUrl = `${url}/contributors?per_page=30`;
  const contributorsResponse = await fetch(contributorsUrl, { headers });
  const contributors = contributorsResponse.ok ? await contributorsResponse.json() : [];
  const activeContributors = contributors.length;

  // Fetch issues to calculate resolution rate
  const openIssuesUrl = `${url}/issues?state=open&per_page=100`;
  const closedIssuesUrl = `${url}/issues?state=closed&per_page=100`;

  const [openResponse, closedResponse] = await Promise.all([
    fetch(openIssuesUrl, { headers }),
    fetch(closedIssuesUrl, { headers })
  ]);

  const openIssues = openResponse.ok ? await openResponse.json() : [];
  const closedIssues = closedResponse.ok ? await closedResponse.json() : [];

  const totalIssues = openIssues.length + closedIssues.length;
  const issueResolutionRate = totalIssues > 0
    ? (closedIssues.length / totalIssues) * 100
    : 0;

  // Check documentation quality
  const hasCompleteDocs = Boolean(data.has_wiki || data.description);
  const hasExamples = Boolean(data.description && data.description.length > 50);

  return {
    commitRecencyMonths,
    issueResolutionRate,
    activeContributors,
    hasCompleteDocs,
    hasExamples
  };
}

/**
 * Fetch security data from OSV API
 * @param {string} packageName - Package name
 * @param {string} ecosystem - Ecosystem (e.g., 'npm', 'PyPI', 'Go')
 * @returns {Promise<Object>} Vulnerability data
 */
export async function fetchSecurityData(packageName, ecosystem) {
  const url = 'https://api.osv.dev/v1/query';

  const body = {
    package: {
      name: packageName,
      ecosystem: ecosystem
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`OSV API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const vulns = data.vulns || [];

  // Count critical and non-critical CVEs
  let criticalCVEs = 0;
  let nonCriticalCVEs = 0;

  for (const vuln of vulns) {
    // OSV API may store severity in different locations depending on the vulnerability database
    const severity = vuln.database_specific?.severity ||
                     vuln.severity?.[0]?.score ||
                     'MODERATE';

    if (severity.includes('CRITICAL') || severity.includes('HIGH')) {
      criticalCVEs++;
    } else {
      nonCriticalCVEs++;
    }
  }

  // Note: OSV API doesn't provide audit status, dependency health, or code quality
  // These would need to be fetched from other sources or provided externally
  return {
    criticalCVEs,
    nonCriticalCVEs,
    hasRecentAudit: false,  // Would need external source
    hasOldAudit: false,     // Would need external source
    allDepsUpToDate: false, // Would need external source
    someOutdated: false,    // Would need external source
    hasHighCoverage: false, // Would need external source
    hasLinter: false        // Would need external source
  };
}

/**
 * Full validation using both APIs
 * @param {Object} suggestion - Suggestion object with tool/practice info
 * @returns {Promise<Object>} Enriched suggestion with scores
 */
export async function validateWithAPIs(suggestion) {
  const { repository, packageName, ecosystem } = suggestion;

  let maintainabilityData = null;
  let securityData = null;

  // Fetch maintainability data if repository is provided
  if (repository) {
    const match = repository.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      const [, owner, repo] = match;
      try {
        maintainabilityData = await fetchMaintainabilityData(owner, repo.replace(/\.git$/, ''));
      } catch (error) {
        console.error(`Failed to fetch maintainability data: ${error.message}`);
      }
    }
  }

  // Fetch security data if package name is provided
  if (packageName && ecosystem) {
    try {
      securityData = await fetchSecurityData(packageName, ecosystem);
    } catch (error) {
      console.error(`Failed to fetch security data: ${error.message}`);
    }
  }

  // Calculate scores
  const maintainabilityScore = maintainabilityData
    ? calculateMaintainabilityScore(maintainabilityData)
    : 0;

  const securityScore = securityData
    ? calculateSecurityScore(securityData)
    : 0;

  // Enrich suggestion
  const enriched = {
    ...suggestion,
    maintainabilityScore,
    securityScore,
    criticalCVEs: securityData?.criticalCVEs || 0,
    maintainabilityData,
    securityData
  };

  // Apply warning markers
  const withMarkers = applyWarningMarkers(enriched);

  // Validate
  const validation = validateSuggestion(withMarkers);

  return {
    ...withMarkers,
    validation
  };
}

// ============================================================================
// UTILITY WRAPPERS
// ============================================================================

/**
 * Rate limiting wrapper with exponential backoff
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.initialDelayMs - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelayMs - Maximum delay in ms (default: 30000)
 * @returns {Function} Wrapped function
 */
export function withRateLimit(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000
  } = options;

  return async function rateLimited(...args) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error;

        // Check if it's a rate limit error
        const isRateLimit = error.message?.includes('rate limit') ||
                           error.message?.includes('429') ||
                           error.status === 429;

        if (!isRateLimit || attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff: delay = initialDelay * 2^attempt, capped at maxDelay
        const delay = Math.min(
          initialDelayMs * Math.pow(2, attempt),
          maxDelayMs
        );

        console.error(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  };
}

/**
 * Caching wrapper with configurable TTL
 * @param {Function} fn - Function to wrap
 * @param {string} cacheKey - Cache key prefix
 * @param {number} ttlMs - TTL in milliseconds (default: 24 hours)
 * @returns {Function} Wrapped function
 */
export function withCache(fn, cacheKey, ttlMs = 24 * 60 * 60 * 1000) {
  const cache = new Map();

  return async function cached(...args) {
    // Generate unique key from arguments - hash prevents collisions from different arg combinations
    const argsHash = createHash('md5')
      .update(JSON.stringify(args))
      .digest('hex');
    const key = `${cacheKey}:${argsHash}`;

    // Check cache
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.value;
    }

    // Execute function
    const value = await fn(...args);

    // Store in cache
    cache.set(key, {
      value,
      timestamp: Date.now()
    });

    // Cleanup old entries (opportunistic garbage collection on each call)
    for (const [k, v] of cache.entries()) {
      if (Date.now() - v.timestamp >= ttlMs) {
        cache.delete(k);
      }
    }

    return value;
  };
}
