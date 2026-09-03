.PHONY: build container test run install lint gate help

build: node_modules
	npm run build

container:
	docker build -t archidraw .

test: node_modules
	npm run test:e2e

run: node_modules
	npm run dev

install:
	npm install
	npx playwright install chromium

lint:
	npm run lint

gate: lint build test

node_modules: package-lock.json
	npm install
	@touch node_modules

help:
	@echo "Targets:"
	@echo "  make build      - TypeScript compile + Vite build"
	@echo "  make container  - Docker image build"
	@echo "  make test       - Playwright E2E tests"
	@echo "  make run        - Vite dev server"
	@echo "  make install    - npm ci + Playwright browsers"
	@echo "  make lint       - oxlint"
	@echo "  make gate       - lint + build + test"
