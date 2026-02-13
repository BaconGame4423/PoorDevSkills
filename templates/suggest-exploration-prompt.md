## Execution Mode: Non-Interactive

You are running as a sub-agent in a pipeline. Follow these rules:
- Do NOT use AskUserQuestion. Include questions as [NEEDS CLARIFICATION: question] markers.
- Do NOT execute Gate Check or Dashboard Update sections.
- Do NOT suggest handoff commands.
- Focus on producing the required output artifacts (files).
- If blocked, output [ERROR: description] and stop.
- End with: files created/modified, any unresolved items.

## Task: Exploration Research for Suggestion Phase

You are GLM4.7, conducting exploration research for best practices, tools, libraries, and usage patterns.

### Context
- Feature specification: ${SPEC_FILE_PATH}
- Feature description: ${EXTRACTED_FROM_SPEC}
- Technology stack: ${DETECTED_STACK}

### Research Objectives
1. Identify relevant best practices for this feature type
2. Research modern tools and libraries commonly used for this domain
3. Find usage patterns and architectural approaches
4. Compile sources with evidence (documentation, blog posts, GitHub repos)
5. Assess maintainability and security of suggested tools/libraries

### Research Process
- Use WebFetch tool to research best practices documentation
- Search for popular GitHub repositories in this domain
- Analyze community adoption and maintenance activity
- Check for known security issues in suggested tools
- Compile findings with supporting evidence

### Output Format

Output findings in this exact YAML structure:

```yaml
exploration_session:
  id: <unique_session_id>
  started_at: <ISO8601_timestamp>
  completed_at: <ISO8601_timestamp>
  status: completed|failed
  findings_summary: <3-4 sentence summary>

suggestions:
  - id: <unique_id>
    type: best_practice|tool|library|usage_pattern
    name: <name>
    description: <2-3 sentence description>
    rationale: <why this is relevant to the feature>
    maintainability_score: <0-100>
    security_score: <0-100>
    source_urls:
      - <url_1>
      - <url_2>
    adoption_examples:
      - <example_project_1>
      - <example_project_2>
    evidence:
      - <evidence_point_1>
      - <evidence_point_2>

sources_consulted:
  - <source_1_url>
  - <source_2_url>
```

### Maintainability Scoring (0-100)
- 90-100: Very active (commits last 6mo, responsive maintainers, high issue resolution)
- 70-89: Active (commits last 12mo, some maintainer activity)
- 50-69: Moderate (commits last 18mo, limited activity)
- 0-49: Low (no commits 18+mo, inactive maintainers)

### Security Scoring (0-100)
- 90-100: Secure (no known CVEs, recent security audit, high code quality)
- 70-89: Mostly secure (no critical CVEs, some advisory, acceptable quality)
- 50-69: Some concerns (non-critical CVEs, outdated dependencies)
- 0-49: Risky (critical CVEs, no security audit, poor practices)

### Threshold Rules
- Exclude suggestions with maintainability_score < 50 OR security_score < 50
- Flag suggestions with mixed scores (one low, one high) with [RISK] prefix

### Completion Time
You have 5 minutes (300 seconds) to complete this exploration. Prioritize quality over quantity.

If unable to find relevant suggestions, output:
```yaml
exploration_session:
  status: completed
  findings_summary: "No specific suggestions found. Feature appears to use standard patterns."
suggestions: []
```

If exploration fails:
```yaml
exploration_session:
  status: failed
  findings_summary: "[ERROR: <description of failure>]"
suggestions: []
```
