#!/bin/bash
# Pre-push Git Hook
#
# Runs quick checks before pushing to catch CI failures early.
# Install: cp scripts/pre-push-hook.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
#
# This is OPTIONAL - only install if you want automated checks before push.

set -e

echo "=== Running Pre-push Checks ==="
echo ""

# Change to project root
cd "$(git rev-parse --show-toplevel)"

# Quick lint check (frontend)
echo "Running frontend lint..."
cd frontend
npm run lint || {
  echo ""
  echo "Lint failed! Fix linting errors before pushing."
  exit 1
}
cd ..

# TypeScript check
echo "Running TypeScript check..."
cd frontend
npx tsc --noEmit || {
  echo ""
  echo "TypeScript check failed! Fix type errors before pushing."
  exit 1
}
cd ..

# Run unit tests
echo "Running unit tests..."
make unit || {
  echo ""
  echo "Unit tests failed! Fix failing tests before pushing."
  exit 1
}

echo ""
echo "=== Pre-push Checks Passed ==="
echo ""
echo "Tip: For full CI-like testing, run: make test"
