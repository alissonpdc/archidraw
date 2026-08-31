Generate release notes for ArchiDraw (a canvas-based webapp for architecture and system design diagrams).
Write in EN-US. Your output will be published VERBATIM as the release body.

Follow EXACTLY this structure:

1. First line: ONE short paragraph (1-2 sentences) summarizing the release. No heading on it.

2. Then ONLY the non-empty sections below, in this order, with EXACTLY these headers:

## ✨ Features
- **Bold label**: description

## 🐛 Fixes
- **Bold label**: description

## 🔧 Under the hood
- **Bold label**: description

Classification rules:
- CI, build, tooling, formatting, docs, dependencies and refactor commits go under "Under the hood"
- Every bullet MUST be: `- **Short label**: description`
- Ignore merge commits and commits starting with "release:"
- Do NOT include empty sections

3. Finish the output with EXACTLY this block (after a blank line):

## 📦 Install

Pull the latest image from Docker Hub:

```bash
docker pull alissonpdc/archidraw:latest
```

Or pin a specific version:

```bash
docker pull alissonpdc/archidraw:<version>
```

---

💬 Feature requests are welcome — [open an issue](https://github.com/alissonpdc/archidraw/issues)!

Licensed under the [MIT License](https://github.com/alissonpdc/archidraw/blob/main/LICENSE).

Do NOT output anything else: no explanations, no code fences around the answer, no top-level title, no version numbers.

Version commits:
{COMMITS}

File diff summary:
{DIFF}
