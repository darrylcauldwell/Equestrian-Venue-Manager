#!/bin/bash
# E2E Test Runner with optional sharding
#
# This script runs Playwright E2E tests with CI-like settings.
# Supports sharding for parallel execution.
#
# Usage:
#   ./scripts/run-e2e-tests.sh              # Run all tests (no sharding)
#   SHARDS=4 ./scripts/run-e2e-tests.sh     # Run with 4 parallel shards

set -e

# Change to project root directory
cd "$(dirname "$0")/.."

# Configuration
SHARDS=${SHARDS:-1}
TIMEOUT=${TIMEOUT:-300}

echo "=== E2E Test Runner ==="
echo "Shards: $SHARDS"
echo ""

# Check if test environment is running
if ! curl -sf http://localhost:3000/health > /dev/null 2>&1; then
  echo "Test environment not running. Starting it first..."
  ./scripts/test-mode.sh up
fi

# Change to frontend directory
cd frontend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm ci
fi

# Install Playwright browsers if needed
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
  echo "Installing Playwright browsers..."
  npx playwright install --with-deps chromium
fi

# Run tests with CI-like settings
echo ""
echo "Running E2E tests..."
export CI=true
export BASE_URL=http://localhost:3000
export API_URL=http://localhost:3000/api

if [ "$SHARDS" -gt 1 ]; then
  echo "Running $SHARDS shards in parallel..."

  # Create array to hold PIDs
  pids=()

  for i in $(seq 1 $SHARDS); do
    echo "Starting shard $i/$SHARDS..."
    npx playwright test --shard=$i/$SHARDS &
    pids+=($!)
  done

  # Wait for all shards and track failures
  failed=0
  for pid in "${pids[@]}"; do
    if ! wait $pid; then
      failed=$((failed + 1))
    fi
  done

  echo ""
  if [ $failed -gt 0 ]; then
    echo "=== $failed shard(s) failed ==="
    exit 1
  fi

  # Merge reports from all shards
  echo "Merging test reports..."
  npx playwright merge-reports --reporter=html ./playwright-report || true
else
  # Single run without sharding
  npx playwright test
fi

echo ""
echo "=== Tests Complete ==="
echo "Report: frontend/playwright-report/index.html"
