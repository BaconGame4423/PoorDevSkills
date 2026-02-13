# Validation Rules: Maintainability and Security Scoring

**Feature**: Best Practice and Tool Suggestion Phase
**Version**: 1.0.0
**Date**: 2026-02-12

## Overview

This contract defines the validation rules and scoring algorithms for maintaining and security evaluation of suggested tools, libraries, and best practices.

## Maintainability Scoring

### Score Range

- **0-100** (inclusive)
- Higher scores indicate better maintainability

### Metrics and Weights

| Metric | Weight | Data Source | Score Criteria |
|--------|--------|-------------|----------------|
| **Commit Recency** | 30% | GitHub API, Git log | Time since last commit |
| **Issue Resolution Rate** | 30% | GitHub Issues API | Resolved / total issues |
| **Contributor Activity** | 20% | GitHub API | Active contributors in last 6 months |
| **Documentation Quality** | 20% | Manual review + README size | Completeness of docs |

### Detailed Scoring

#### 1. Commit Recency (0-30 points)

```python
def score_commit_recency(last_commit_date):
    """Score based on time since last commit"""
    days_since = (now - last_commit_date).days
    
    if days_since <= 180:  # 6 months or less
        return 30
    elif days_since <= 365:  # 12 months or less
        return 20
    elif days_since <= 540:  # 18 months or less
        return 10
    else:
        return 0
```

**Score Bands**:
- **30 points**: Active (last commit ≤ 6 months)
- **20 points**: Recent activity (last commit ≤ 12 months)
- **10 points**: Moderate (last commit ≤ 18 months)
- **0 points**: Inactive (no commit in 18+ months)

#### 2. Issue Resolution Rate (0-30 points)

```python
def score_issue_resolution(resolved_count, total_count):
    """Score based on issue resolution percentage"""
    if total_count == 0:
        return 15  # Neutral score for no issues
    
    resolution_rate = (resolved_count / total_count) * 100
    
    if resolution_rate > 90:
        return 30
    elif resolution_rate > 70:
        return 20
    elif resolution_rate > 50:
        return 10
    else:
        return 0
```

**Score Bands**:
- **30 points**: Excellent (> 90% resolved)
- **20 points**: Good (> 70% resolved)
- **10 points**: Fair (> 50% resolved)
- **0 points**: Poor (≤ 50% resolved)

#### 3. Contributor Activity (0-20 points)

```python
def score_contributor_activity(active_contributors):
    """Score based on number of active contributors"""
    # Active = at least 1 commit in last 6 months
    
    if active_contributors >= 5:
        return 20
    elif active_contributors >= 3:
        return 15
    elif active_contributors >= 1:
        return 10
    else:
        return 0
```

**Score Bands**:
- **20 points**: Healthy community (≥ 5 active contributors)
- **15 points**: Active (≥ 3 active contributors)
- **10 points**: Minimal (≥ 1 active contributor)
- **0 points**: Abandoned (no active contributors)

#### 4. Documentation Quality (0-20 points)

```python
def score_documentation_quality(project):
    """Score based on documentation completeness"""
    score = 0
    
    # Check for README
    if has_readme(project):
        score += 5
    
    # Check for docs directory
    if has_docs_directory(project):
        code += 5
    
    # Check for examples
    if has_examples(project):
        score += 5
    
    # Check for API docs
    if has_api_docs(project):
        score += 5
    
    return score
```

**Score Bands**:
- **20 points**: Complete (README + docs + examples + API docs)
- **15 points**: Good (README + docs + API docs)
- **10 points**: Basic (README + docs)
- **5 points**: Minimal (README only)
- **0 points**: No documentation

### Total Maintainability Score

```python
def calculate_maintainability_score(commit_score, issue_score, contributor_score, doc_score):
    """Calculate weighted maintainability score"""
    total = (
        (commit_score * 0.30) +
        (issue_score * 0.30) +
        (contributor_score * 0.20) +
        (doc_score * 0.20)
    )
    return round(total)  # Round to nearest integer
```

### Maintainability Score Bands

| Score Range | Label | Description |
|------------|-------|-------------|
| 90-100 | Very Active | Excellent maintenance, actively developed |
| 70-89 | Active | Good maintenance, regular updates |
| 50-69 | Moderate | Acceptable maintenance, some activity |
| 0-49 | Low | Poor maintenance, minimal activity |

## Security Scoring

### Score Range

- **0-100** (inclusive)
- Higher scores indicate better security posture

### Metrics and Weights

| Metric | Weight | Data Source | Score Criteria |
|--------|--------|-------------|----------------|
| **Known Vulnerabilities** | 40% | OSV, Snyk, npm/PyPI advisories | CVE count and severity |
| **Security Audit Status** | 30% | Project docs, audit reports | Recent security audit |
| **Dependency Health** | 20% | npm/PyPI, Deps.dev | Dependency freshness |
| **Code Quality Indicators** | 10% | Static analysis, test coverage | Quality metrics |

### Detailed Scoring

#### 1. Known Vulnerabilities (0-40 points)

```python
def score_known_vulnerabilities(cve_list):
    """Score based on CVE count and severity"""
    critical = sum(1 for cve in cve_list if cve.severity == 'critical')
    high = sum(1 for cve in cve_list if cve.severity == 'high')
    
    if critical > 0 or high > 0:
        return 0  # Zero tolerance for critical/high CVEs
    elif len(cve_list) == 0:
        return 40  # No known CVEs
    else:
        return 20  # Non-critical CVEs only
```

**Score Bands**:
- **40 points**: Secure (no known CVEs)
- **20 points**: Some concerns (non-critical CVEs only)
- **0 points**: Risky (critical or high-severity CVEs)

#### 2. Security Audit Status (0-30 points)

```python
def score_security_audit(audit_date):
    """Score based on recency of security audit"""
    if audit_date is None:
        return 0  # No audit
    
    days_since = (now - audit_date).days
    
    if days_since <= 365:  # Within 12 months
        return 30
    elif days_since <= 730:  # Within 24 months
        return 15
    else:
        return 0  # Old audit (> 2 years)
```

**Score Bands**:
- **30 points**: Secure (recent audit within 12 months)
- **15 points**: Acceptable (audit within 24 months)
- **0 points**: Unknown (no audit or > 2 years old)

#### 3. Dependency Health (0-20 points)

```python
def score_dependency_health(dependencies):
    """Score based on dependency freshness"""
    if len(dependencies) == 0:
        return 20  # No deps = no risk
    
    outdated = sum(1 for dep in dependencies if dep.is_outdated())
    critical_outdated = sum(1 for dep in dependencies if dep.is_critical_outdated())
    
    if critical_outdated > 0:
        return 0  # Critical outdated deps
    elif outdated == 0:
        return 20  # All up-to-date
    elif outdated / len(dependencies) < 0.3:
        return 10  # Some outdated (< 30%)
    else:
        return 0  # Many outdated (>= 30%)
```

**Score Bands**:
- **20 points**: Healthy (all dependencies up-to-date)
- **10 points**: Acceptable (some outdated, < 30%)
- **0 points**: Risky (critical outdated or >= 30% outdated)

#### 4. Code Quality Indicators (0-10 points)

```python
def score_code_quality_indicators(coverage, linter_score):
    """Score based on test coverage and linter results"""
    if coverage is None:
        coverage = 0
    if linter_score is None:
        linter_score = 0
    
    # Coverage score (0-5 points)
    if coverage >= 80:
        coverage_score = 5
    elif coverage >= 50:
        coverage_score = 3
    else:
        coverage_score = 0
    
    # Linter score (0-5 points)
    if linter_score >= 9:
        linter_score_val = 5
    elif linter_score >= 7:
        linter_score_val = 3
    else:
        linter_score_val = 0
    
    return coverage_score + linter_score_val
```

**Score Bands**:
- **10 points**: High quality (coverage ≥ 80%, linter ≥ 9)
- **6 points**: Medium quality (coverage ≥ 50% or linter ≥ 7)
- **3 points**: Low quality (some indicators present)
- **0 points**: Unknown (no metrics available)

### Total Security Score

```python
def calculate_security_score(vuln_score, audit_score, dep_score, quality_score):
    """Calculate weighted security score"""
    total = (
        (vuln_score * 0.40) +
        (audit_score * 0.30) +
        (dep_score * 0.20) +
        (quality_score * 0.10)
    )
    return round(total)  # Round to nearest integer
```

### Security Score Bands

| Score Range | Label | Description |
|------------|-------|-------------|
| 90-100 | Secure | Excellent security posture |
| 70-89 | Mostly Secure | Generally safe, minor concerns possible |
| 50-69 | Some Concerns | Evaluate carefully before use |
| 0-49 | Risky | Not recommended |

## Threshold Rules

### Inclusion Threshold (FR-006)

**Rule**: Suggestion is included if both scores meet minimum threshold

```python
def is_suggestion_included(maintainability_score, security_score):
    """Check if suggestion passes inclusion threshold"""
    return (
        maintainability_score >= 50 and
        security_score >= 50
    )
```

**Threshold Values**:
- **Maintainability Score**: ≥ 50
- **Security Score**: ≥ 50

### Exclusion Rules

**Automatic Exclusion**:

1. **Critical CVEs Present**: Exclude regardless of scores
2. **Either Score < 50**: Exclude (fails inclusion threshold)

**Conditional Exclusion with Warning**:

1. **Mixed Signals**: One score ≥ 75, other < 60
   - Tag with `[RISK]` prefix
   - Still include if both ≥ 50
   
2. **Borderline Scores**: Both scores in 50-59 range
   - Tag with `[CAUTION]` prefix
   - Still include (meets threshold)

### Warning Markers

```python
def apply_warning_markers(suggestion):
    """Apply warning markers based on score patterns"""
    maint = suggestion.maintainability_score
    sec = suggestion.security_score
    
    # Risk: mixed signals
    if (maint >= 75 and sec < 60) or (sec >= 75 and maint < 60):
        suggestion.risk_marker = "[RISK]"
    
    # Caution: borderline scores
    elif 50 <= maint < 60 and 50 <= sec < 60:
        suggestion.risk_marker = "[CAUTION]"
    
    else:
        suggestion.risk_marker = ""
    
    return suggestion
```

## Validation Rules Summary

### Field-Level Validation

| Field | Rule | Error |
|-------|-------|-------|
| `maintainability_score` | Must be 0-100 (inclusive) | Invalid maintainability score |
| `security_score` | Must be 0-100 (inclusive) | Invalid security score |
| `source_urls` | Must contain at least 1 valid URL | No source URLs provided |
| `type` | Must be in enum | Invalid suggestion type |
| `created_at` | Must be valid ISO8601 timestamp | Invalid timestamp format |

### Entity-Level Validation

| Entity | Rule | Error |
|--------|-------|-------|
| Suggestion | Both scores >= 50 for inclusion | Fails inclusion threshold |
| ExplorationSession | `completed_at` >= `started_at` | Invalid timestamp ordering |
| SuggestionDecision | `suggestion_id` must reference valid Suggestion | Invalid suggestion reference |

### Business Rule Validation

| Rule | Condition | Action |
|------|-----------|--------|
| FR-006 | Critical CVEs present | Exclude suggestion |
| FR-006 | Either score < 50 | Exclude suggestion |
| FR-006 | Both scores >= 50 | Include suggestion |
| FR-004 | Security score < 50 | Exclude for security concerns |
| FR-003 | Maintainability score < 50 | Exclude for maintenance concerns |

## Implementation Notes

### Data Sources

**Maintainability Metrics**:
- GitHub REST API: `/repos/{owner}/{repo}/commits`
- GitHub REST API: `/repos/{owner}/{repo}/issues`
- GitHub REST API: `/repos/{owner}/{repo}/contributors`

**Security Metrics**:
- OSV API: `https://api.osv.dev/v1/query`
- npm Advisory API: `https://registry.npmjs.org/-/npm/v1/advisories`
- PyPI: JSON API (package metadata)
- Snyk API (optional, requires API key)

### Caching Strategy

- Cache metrics for 24 hours to reduce API calls
- Revalidate on suggestion phase re-run
- Clear cache when `exploration-cache.yaml` is manually deleted

### Fallback Scoring

When API unavailable:

1. **Use GLM4.7 internal knowledge**
   - GLM4.7 has knowledge of popular libraries
   - Score based on estimated popularity
   - Mark as `[ESTIMATED]` prefix

2. **Manual scoring**
   - Allow user to provide manual scores
   - Override with user input
   - Log manual overrides

## Version History

| Version | Date | Changes |
|---------|-------|---------|
| 1.0.0 | 2026-02-12 | Initial version |
