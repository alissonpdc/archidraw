#!/usr/bin/env bash
# Gera release notes user-friendly a partir dos conventional commits
# desde a última tag v*. Uso: generate-notes.sh X.Y.Z
set -euo pipefail

version=${1:?uso: generate-notes.sh X.Y.Z}
prev_tag=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || true)
range="HEAD"
if [ -n "$prev_tag" ]; then
  range="${prev_tag}..HEAD"
fi

feat_list=""
fix_list=""
imp_list=""
docs_list=""
chore_list=""

while IFS= read -r subject; do
  [ -z "$subject" ] && continue
  clean=$(printf '%s' "$subject" | sed -E 's/^[a-zA-Z]+(\([^)]*\))?!?:[[:space:]]*//')
  [ -z "$clean" ] && continue
  case $subject in
    feat*) feat_list+="- ${clean}"$'\n' ;;
    fix*) fix_list+="- ${clean}"$'\n' ;;
    perf*|refactor*) imp_list+="- ${clean}"$'\n' ;;
    docs*) docs_list+="- ${clean}"$'\n' ;;
    *) chore_list+="- ${clean}"$'\n' ;;
  esac
done < <(git log --format=%s $range)

section() {
  local title=$1 list=$2
  if [ -n "$list" ]; then
    printf '## %s\n\n%s\n' "$title" "$list"
  fi
}

out=""
out+=$(section "✨ Novas funcionalidades" "$feat_list")
out+=$(section "🐛 Correções" "$fix_list")
out+=$(section "🚀 Melhorias" "$imp_list")
out+=$(section "📚 Documentação" "$docs_list")
out+=$(section "🔧 Manutenção" "$chore_list")

if [ -z "$out" ]; then
  out=$(section "🔧 Manutenção" "- Melhorias internas e ajustes gerais"$'\n')
fi

if [ -n "$prev_tag" ]; then
  compare="[Changelog completo](${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-alissonpdc/archidraw}/compare/${prev_tag}...v${version})"
else
  compare=""
fi

cat <<EOF
# ArchiDraw v${version}

Nesta versão:

${out}
${compare}
---

**Container Docker:**

\`\`\`bash
docker run -d -p 5000:5000 archidraw:v${version}
\`\`\`
EOF
