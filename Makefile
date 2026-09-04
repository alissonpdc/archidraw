.PHONY: build container run-container test run install lint gate help

build: node_modules
	npm run build

container:
	docker build -t archidraw .

run-container:
	docker pull alissonpdc/archidraw:latest
	docker run --rm -p 5000:5000 alissonpdc/archidraw:latest

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
	@echo "  make build          - TypeScript compile + Vite build"
	@echo "  make container      - Docker image build"
	@echo "  make run-container  - Pull & run pre-built image from Docker Hub"
	@echo "  make test           - Playwright E2E tests"
	@echo "  make run            - Vite dev server"
	@echo "  make install        - npm ci + Playwright browsers"
	@echo "  make lint           - oxlint"
	@echo "  make gate           - lint + build + test"
