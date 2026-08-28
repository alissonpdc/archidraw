#!/usr/bin/env bash
# Calcula a próxima versão semântica a partir dos conventional commits
# desde a última tag v*. Saída: X.Y.Z (sem prefixo "v").
#
# Regras:
#   breaking change (subject com "!:" ou corpo com "BREAKING CHANGE") -> major
#   feat -> minor
#   qualquer outra coisa -> patch
set -euo pipefail

prev_tag=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)

if [ -z "$prev_tag" ]; then
  echo "0.1.0"
  exit 0
fi

base=${prev_tag#v}
major=${base%%.*}
rest=${base#*.}
minor=${rest%%.*}
patch=${rest#*.}

subjects=$(git log --format=%s "${prev_tag}..HEAD")
bodies=$(git log --format=%B "${prev_tag}..HEAD")

breaking=false
if printf '%s\n' "$subjects" | grep -q '!:' || printf '%s\n' "$bodies" | grep -q 'BREAKING CHANGE'; then
  breaking=true
fi

if [ "$breaking" = true ]; then
  major=$((major + 1)); minor=0; patch=0
elif printf '%s\n' "$subjects" | grep -qE '^feat(\(|:|/)'; then
  minor=$((minor + 1)); patch=0
else
  patch=$((patch + 1))
fi

echo "${major}.${minor}.${patch}"
