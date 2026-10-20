# KB — absolute import paths only exist on the machine of whoever wrote them

**Symptom:** CI fails **only** on the E2E job, right at collection, with

```
Error: EACCES: permission denied, stat '/root/GitHub/archidraw/tests/fixtures'
```

No test gets to run and the whole job dies (`Build` and `Create PR` stay
`skipped`). Lint, Typecheck and Security Audit pass **green** — it's this
exact combination (all structural gates ok, E2E dead at the starting line)
that signatures the problem.

**Root cause:** a spec imports fixtures via an absolute filesystem path from
the machine where it was written, instead of relative:

```ts
import { test, open } from "/root/GitHub/archidraw/tests/fixtures"; // breaks
import { test, open } from "../fixtures";                          // right
```

On the runner the repo lives at `/home/runner/work/archidraw/archidraw`. The
Playwright resolver does `stat` on the literal path and blows up with
`EACCES` — the process isn't even allowed to read `/root`. It's a **module
resolution** failure, not test behavior: that's why CI's `--retries` changes
nothing and re-running the same run reproduces 100% of the time.

**Why the other gates don't catch it:**

- `oxlint` ignores `tests/**` and `playwright.config.ts`
- `tsc -b` (`npm run build`) only compiles `src/` + `vite.config.ts`

I.e., **nothing in `make gate` reads the specs until Playwright execution**.
Specs are verified at runtime only. An absolute path is literally invisible
to lint and typecheck.

**Rule (always follow):**

1. Imports in `tests/**` are **always relative**: `from "../fixtures"`,
   `from "./utils"`. Never `/root/...`, `/home/...`, `/Users/...`, `~/...`.
2. Copying the path shown in the editor/IDE title bar or via "copy file path"
   is the usual trigger of this bug — always paste the relative import.
3. Before committing a new spec, a sweep (must come back empty):

   ```bash
   grep -rn 'from "/' tests/ | grep -v 'from "\.\.'
   ```

**Inverse symptom (same cause):** a test that passes locally and, on CI,
fails with `Cannot find module` / `EACCES` pointing to a path that **exists**
on your machine — it's that path, not the test.

## Related rule — never commit a measurement probe

The file that motivated this KB (`tests/specs/zz-shot.spec.ts`) didn't have a
single `expect()`: it measured the hover box size and printed to stdout
(`process.stdout.write("K ...")`). A test without an assertion protects
nothing and only costs suite time — and the flow it covered (hovering the
badge + keyboard resize) already had real assertions in
`hover-markdown.spec.ts`.

When debugging a behavior: write the real `expect()` and delete the probe, or
leave the probe out of the stage. Temporary debugging in `tests/specs/`
becomes a production file on the first commit.
