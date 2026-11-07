# Local versions of the CI checks. The Go and security tools run in Docker,
# so the server needs nothing installed beyond Docker (and pnpm for web/).

GOLANGCI_LINT_VERSION := v2.15.0
GOVULNCHECK_VERSION   := v1.9.0
TRIVY_VERSION         := 0.76.2
GO_IMAGE              := golang:1.26

.PHONY: check tidy lint lint-web lint-go test vuln govulncheck trivy

check: lint test vuln

# Writes server/go.sum (needed by the Go checks). Commit the result.
tidy:
	docker run --rm -v "$(CURDIR)/server:/src" -w /src $(GO_IMAGE) go mod tidy

lint: lint-web lint-go

lint-web:
	cd web && pnpm lint

lint-go:
	docker run --rm -v "$(CURDIR)/server:/src" -w /src \
		golangci/golangci-lint:$(GOLANGCI_LINT_VERSION) golangci-lint run ./...

test:
	cd web && pnpm test
	docker run --rm -v "$(CURDIR)/server:/src" -w /src $(GO_IMAGE) go test ./...
	cd tts && pytest

vuln: govulncheck trivy

govulncheck:
	docker run --rm -v "$(CURDIR)/server:/src" -w /src $(GO_IMAGE) \
		go run golang.org/x/vuln/cmd/govulncheck@$(GOVULNCHECK_VERSION) ./...

trivy:
	docker run --rm -v "$(CURDIR):/src" -v trivy-cache:/root/.cache/trivy \
		aquasec/trivy:$(TRIVY_VERSION) fs --scanners vuln,secret,misconfig \
		--severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 \
		--skip-dirs /src/web/node_modules /src
