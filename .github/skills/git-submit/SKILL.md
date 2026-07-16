---
name: git-submit
description: "Commit and push changes with a properly formatted git message. Use when: staging files, writing a commit message, and pushing to remote. Enforces conventional commit format."
---

# Git Commit & Push

## Commit Message Format

```
<type>: <short description>
```

- **Must be English**
- **type** — one of: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`
- **description** — lowercase, no period, imperative mood (e.g. `add`, `remove`, `update`)
- Do **not** wrap git commands in a sandbox shell.

**Examples:**
```
feat: add pipeline progress event support
fix: correct preferences-api import path
refactor: move pipelines dir under service
chore: update dependencies
docs: add git-submit skill
```

## Version Bump (package.json)

Before committing, update the `version` field in `package.json`:

- Check commits since the last push: `git log origin/main..HEAD --oneline`
- If **any** commit has type `feat` → bump **minor** (e.g. `1.0.0` → `1.1.0`)
- Otherwise → bump **patch** (e.g. `1.0.0` → `1.0.1`)

Include the version bump in the same commit.

## Steps

1. Review changed files: `git status`
2. Check commits since last push and bump version in `package.json` accordingly
3. Run `npm i` in the workspace root to update `package-lock.json`
4. Stage files: `git add <files>` (or `git add -A` for all)
5. Commit: `git commit -m "<type>: <description>"`
6. Push: `git push`
