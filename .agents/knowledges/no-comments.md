# KB — No comments in source code unless the user asks

**Symptom:**
- Reviewers must decide per-comment whether prose is load-bearing or noise;
  stale comments drift from the code and mislead.

**Rule (always follow):**
1. Do not add comments to `src/**` or `e2e/**` unless the user explicitly
   requested them in that task.
2. Self-documenting names + small functions carry the intent. Extract a
   named function/constant instead of writing a "why" comment.
3. Exception: the codebase may already contain comments (e.g., the JSDoc on
   `Editor.getSnapshot`). Do not delete existing comments as a cleanup drive,
   and do not add new ones either.
4. This rule does not apply to generated config/docs files
   (`archidraw-syntax.md`, AGENTS.md, knowledge base).

## Checklist before finishing a change

- [ ] No new comments introduced (except when requested)?
- [ ] Intent expressed through naming instead?
