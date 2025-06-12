# Claude Code Web UI - Development Tasks

.PHONY: format lint typecheck test build dev clean

# Formatting
format: format-frontend format-backend
format-frontend:
	cd frontend && npm run format
format-backend:
	cd backend && deno task format

# Linting
lint: lint-frontend lint-backend
lint-frontend:
	cd frontend && npm run lint
lint-backend:
	cd backend && deno task lint

# Type checking
typecheck: typecheck-frontend typecheck-backend
typecheck-frontend:
	cd frontend && npm run typecheck
typecheck-backend:
	cd backend && deno task check

# Testing
test:
	cd frontend && npm test

# Building
build: build-frontend build-backend
build-frontend:
	cd frontend && npm run build
build-backend:
	cd backend && deno task build

# Development
dev-frontend:
	cd frontend && npm run dev
dev-backend:
	cd backend && deno task dev

# Quality checks (run before commit)
check: format lint typecheck test

# Install dependencies
install:
	cd frontend && npm ci

# Clean
clean:
	cd frontend && rm -rf node_modules dist
	cd backend && rm -rf ../dist