PYTHON ?= python3

.PHONY: setup dev check-api check-web contracts

setup:
	cd apps/api && $(PYTHON) -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
	cd apps/web && corepack enable && pnpm install

dev:
	bash scripts/dev.sh

check-api:
	cd apps/api && .venv/bin/python -m pytest tests -v
	cd apps/api && .venv/bin/ruff check app scripts tests

check-web:
	cd apps/web && pnpm lint
	cd apps/web && npx tsc --noEmit
	cd apps/web && pnpm test
	cd apps/web && pnpm build

contracts:
	node packages/contracts/generate.mjs
	git diff --exit-code packages/contracts/openapi.json packages/contracts/api-types.d.ts
