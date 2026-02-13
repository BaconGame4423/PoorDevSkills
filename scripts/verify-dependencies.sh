#!/bin/bash
# Dependency verification script for Best Practice and Tool Suggestion Phase
# Exits with status 0 on success, non-zero on failure

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
OVERALL_STATUS=0

# Check jq installation
echo "Checking jq installation..."
if command -v jq &> /dev/null; then
    JQ_VERSION=$(jq --version)
    echo -e "${GREEN}✓${NC} jq is installed: $JQ_VERSION"
else
    echo -e "${RED}✗${NC} jq is NOT installed"
    OVERALL_STATUS=1
fi

# Check GLM4.7 model access
echo ""
echo "Checking GLM4.7 model access..."
if gh models list 2>/dev/null | grep -i glm &> /dev/null; then
    echo -e "${GREEN}✓${NC} GLM4.7 model is available"
else
    echo -e "${YELLOW}⚠${NC} GLM4.7 model not found in 'gh models list' (may still be available via GLM4.7 interface)"
fi

# Test GitHub API connectivity
echo ""
echo "Testing GitHub API connectivity..."
GITHUB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.github.com/rate_limit)
if [ "$GITHUB_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} GitHub API is accessible (HTTP $GITHUB_STATUS)"
else
    echo -e "${RED}✗${NC} GitHub API returned HTTP $GITHUB_STATUS"
    OVERALL_STATUS=1
fi

# Test OSV API connectivity
echo ""
echo "Testing OSV API connectivity..."
OSV_STATUS=$(curl -s -X POST -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" -d '{"query":"test"}' https://api.osv.dev/v1/query)
if [ "$OSV_STATUS" = "200" ] || [ "$OSV_STATUS" = "400" ]; then
    echo -e "${GREEN}✓${NC} OSV API is accessible (HTTP $OSV_STATUS, 400 is expected for test query)"
else
    echo -e "${RED}✗${NC} OSV API returned HTTP $OSV_STATUS"
    OVERALL_STATUS=1
fi

# Test npm registry connectivity
echo ""
echo "Testing npm registry connectivity..."
NPM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://registry.npmjs.org/express)
if [ "$NPM_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} npm registry is accessible (HTTP $NPM_STATUS)"
else
    echo -e "${RED}✗${NC} npm registry returned HTTP $NPM_STATUS"
    OVERALL_STATUS=1
fi

# Check GITHUB_TOKEN environment variable
echo ""
echo "Checking GITHUB_TOKEN..."
if [ -n "$GITHUB_TOKEN" ]; then
    echo -e "${GREEN}✓${NC} GITHUB_TOKEN is set (length: ${#GITHUB_TOKEN})"
else
    echo -e "${YELLOW}⚠${NC} GITHUB_TOKEN is NOT set (reduced GitHub API rate limit)"
fi

# Check directories
echo ""
echo "Checking required directories..."
[ -d "commands" ] && echo -e "${GREEN}✓${NC} commands/ exists" || (echo -e "${RED}✗${NC} commands/ missing" && OVERALL_STATUS=1)
[ -d "lib" ] && echo -e "${GREEN}✓${NC} lib/ exists" || (echo -e "${RED}✗${NC} lib/ missing" && OVERALL_STATUS=1)
[ -d "agents/opencode" ] && echo -e "${GREEN}✓${NC} agents/opencode/ exists" || (echo -e "${RED}✗${NC} agents/opencode/ missing" && OVERALL_STATUS=1)
[ -d ".poor-dev" ] && echo -e "${GREEN}✓${NC} .poor-dev/ exists" || (echo -e "${RED}✗${NC} .poor-dev/ missing" && OVERALL_STATUS=1)

# Final summary
echo ""
echo "========================================"
if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}All critical dependencies verified!${NC}"
    exit 0
else
    echo -e "${RED}Some dependencies failed. See details above.${NC}"
    exit 1
fi
