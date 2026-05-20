.PHONY: help install dev build test test-coverage lint lint-fix format format-check typecheck docker-up docker-down docker-logs db-reset db-seed db-push smoke clean

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

install:  ## Install all dependencies
	pnpm install --frozen-lockfile

dev:  ## Start dev server
	pnpm dev

build:  ## Production build
	pnpm prisma generate && pnpm build

test:  ## Run all tests
	pnpm test

test-coverage:  ## Run tests with coverage
	pnpm test:coverage

lint:  ## Run linter
	pnpm lint

lint-fix:  ## Auto-fix lint issues
	pnpm lint:fix

format:  ## Format all files
	pnpm format

format-check:  ## Check formatting
	pnpm format:check

typecheck:  ## TypeScript check
	pnpm typecheck

docker-up:  ## Start full stack with port-remap
	docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

docker-down:  ## Stop full stack
	docker compose -f docker-compose.yml -f docker-compose.local.yml down

docker-logs:  ## Tail logs
	docker compose logs -f

db-reset:  ## Reset DB schema
	pnpm prisma migrate reset --force

db-seed:  ## Seed DB
	pnpm db:seed

db-push:  ## Push schema without migration
	pnpm prisma db push

smoke:  ## Run smoke tests
	pnpm test -- --run __tests__/smoke

clean:  ## Remove build artifacts
	rm -rf .next node_modules/.cache coverage
