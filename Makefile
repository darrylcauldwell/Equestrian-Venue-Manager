# Equestrian Venue Manager - Development Commands
#
# Usage:
#   make dev          - Start development mode with hot reload
#   make test         - Run full CI-like test suite
#   make e2e          - Run E2E tests in production-like environment
#   make unit         - Run unit tests only
#   make lint         - Run linting and type checks
#   make clean        - Clean up all containers

.PHONY: dev test e2e e2e-sharded unit coverage lint build clean help

# Default target
help:
	@echo "Equestrian Venue Manager - Development Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          Start development mode with hot reload"
	@echo "  make clean        Stop all containers and clean up"
	@echo ""
	@echo "Testing:"
	@echo "  make test         Full CI-like test suite (build + lint + unit + e2e)"
	@echo "  make unit         Run backend + frontend unit tests"
	@echo "  make e2e          Run E2E tests in production-like environment"
	@echo "  make e2e-sharded  Run E2E with 4 parallel shards (like CI)"
	@echo "  make lint         Run linting and TypeScript checks"
	@echo ""
	@echo "Build:"
	@echo "  make build        Build production containers"
	@echo ""

# Development mode with hot reload
dev:
	docker compose up --build

# Full CI-like test suite
test: build lint unit e2e
	@echo ""
	@echo "=== All tests passed! ==="

# Build production containers
build:
	@echo "Building production containers..."
	docker compose -f docker-compose.test.yml build

# Run linting and type checks
lint:
	@echo "Running frontend lint..."
	cd frontend && npm run lint
	@echo ""
	@echo "Running TypeScript check..."
	cd frontend && npx tsc --noEmit
	@echo ""
	@echo "Lint checks passed!"

# Run unit tests (backend + frontend)
unit:
	@echo "Running unit tests..."
	@echo ""
	@echo "Backend tests (requires Docker):"
	docker compose exec -T backend python -m pytest tests/ -v --tb=short -q || \
		(echo "Note: Backend tests require 'docker compose up' to be running" && exit 1)
	@echo ""
	@echo "Frontend tests:"
	cd frontend && npm run test -- --run --no-isolate
	@echo ""
	@echo "Unit tests complete!"

# Run frontend tests with coverage (resource-intensive, use in CI)
coverage:
	@echo "Running frontend tests with coverage..."
	cd frontend && npm run test:coverage -- --run
	@echo "Coverage report: frontend/coverage/index.html"

# Run E2E tests in test mode
e2e:
	./scripts/test-mode.sh up
	./scripts/run-e2e-tests.sh

# E2E with CI-like sharding
e2e-sharded:
	./scripts/test-mode.sh up
	SHARDS=4 ./scripts/run-e2e-tests.sh

# Start test environment only (without running tests)
test-env:
	./scripts/test-mode.sh up

# Stop test environment
test-env-down:
	./scripts/test-mode.sh down

# View test environment logs
test-logs:
	./scripts/test-mode.sh logs

# Clean up all containers and volumes
clean:
	@echo "Stopping development containers..."
	docker compose down -v --remove-orphans 2>/dev/null || true
	@echo "Stopping test containers..."
	docker compose -f docker-compose.test.yml down -v --remove-orphans 2>/dev/null || true
	@echo "Cleanup complete!"

# Install pre-push hook
install-hooks:
	@echo "Installing pre-push hook..."
	cp scripts/pre-push-hook.sh .git/hooks/pre-push
	chmod +x .git/hooks/pre-push
	@echo "Pre-push hook installed!"
	@echo "It will run lint and unit tests before each push."
