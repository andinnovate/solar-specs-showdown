SHELL := /bin/bash

WARN_PATTERN := warning|warn|Browserslist|\\(!\\)

.PHONY: test build lint typecheck unit e2e pytest

define run_quiet
	@label="$(1)"; cmd="$(2)"; \
	printf "%s... " "$$label"; \
	log=$$(mktemp); \
	if eval "$$cmd" > $$log 2>&1; then \
		if grep -Ei "$(WARN_PATTERN)" $$log >/dev/null; then \
			echo; \
			cat $$log; \
		else \
			echo "ok"; \
		fi; \
	else \
		echo; \
		cat $$log; \
		exit 1; \
	fi; \
	rm -f $$log
endef

lint:
	$(call run_quiet,lint,npm run lint)

typecheck:
	$(call run_quiet,typecheck,npx tsc --noEmit)

unit:
	$(call run_quiet,unit,npm run test:run)

e2e:
	$(call run_quiet,e2e,npm run test:e2e)

pytest:
	$(call run_quiet,pytest,if [ ! -f dev/bin/activate ]; then echo "Missing venv. Run: python -m venv dev && source dev/bin/activate && pip install -r requirements.txt"; exit 1; fi; . dev/bin/activate && pytest)

build:
	$(call run_quiet,build,npm run build)

test: lint typecheck unit e2e build pytest
