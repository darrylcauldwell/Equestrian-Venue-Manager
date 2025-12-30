#!/bin/bash
# Test Mode - Production-like environment for local testing
#
# This script starts a production-like environment that matches CI
# to help catch issues before pushing to GitHub.
#
# Usage:
#   ./scripts/test-mode.sh up     # Start test environment
#   ./scripts/test-mode.sh down   # Stop and clean up
#   ./scripts/test-mode.sh logs   # View container logs
#   ./scripts/test-mode.sh test   # Run E2E tests

set -e

# Change to project root directory
cd "$(dirname "$0")/.."

ACTION=${1:-up}

case $ACTION in
  up)
    echo "=== Starting Test Environment (Production-like) ==="
    echo ""

    # Stop any existing dev containers to free up ports
    docker compose down 2>/dev/null || true

    # Build and start test containers
    echo "Building production containers..."
    docker compose -f docker-compose.test.yml build

    echo "Starting containers..."
    docker compose -f docker-compose.test.yml up -d

    # Wait for services to be ready
    echo "Waiting for services to be ready..."
    READY=false
    for i in {1..60}; do
      if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
        READY=true
        break
      fi
      echo -n "."
      sleep 2
    done
    echo ""

    if [ "$READY" != "true" ]; then
      echo "ERROR: Services failed to become ready"
      docker compose -f docker-compose.test.yml logs --tail=50
      exit 1
    fi

    # Run migrations
    echo "Running database migrations..."
    docker compose -f docker-compose.test.yml exec -T backend alembic upgrade head

    # Seed with E2E test fixtures
    echo "Seeding E2E test fixtures..."
    if [ -f "backend/scripts/seed_e2e.py" ]; then
      docker compose -f docker-compose.test.yml exec -T backend python scripts/seed_e2e.py
    else
      docker compose -f docker-compose.test.yml exec -T backend python scripts/seed_database.py
    fi

    echo ""
    echo "=== Test Environment Ready ==="
    echo ""
    echo "Frontend:  http://localhost:3000"
    echo "API:       http://localhost:3000/api"
    echo "API Docs:  http://localhost:3000/api/docs"
    echo ""
    echo "Run tests:"
    echo "  ./scripts/run-e2e-tests.sh              # Basic E2E tests"
    echo "  SHARDS=4 ./scripts/run-e2e-tests.sh     # With CI-like sharding"
    echo "  make test                                # Full CI-like suite"
    echo ""
    echo "Stop:"
    echo "  ./scripts/test-mode.sh down"
    ;;

  down)
    echo "Stopping test environment..."
    docker compose -f docker-compose.test.yml down -v --remove-orphans
    echo "Test environment stopped and cleaned up."
    ;;

  logs)
    docker compose -f docker-compose.test.yml logs -f
    ;;

  test)
    # Run E2E tests
    ./scripts/run-e2e-tests.sh
    ;;

  status)
    docker compose -f docker-compose.test.yml ps
    ;;

  *)
    echo "Usage: $0 {up|down|logs|test|status}"
    echo ""
    echo "Commands:"
    echo "  up      Start test environment"
    echo "  down    Stop and clean up"
    echo "  logs    View container logs"
    echo "  test    Run E2E tests"
    echo "  status  Show container status"
    exit 1
    ;;
esac
