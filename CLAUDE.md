# CLAUDE.md — Portfolio Website

This file is the authoritative guide for Claude (and any AI coding assistant) working on the website codebase. Read it fully before making any changes.

## Code style

- Use named exports, not default exports, for components. Exception: Next.js
  page files which require default exports.
- Prefer `const` arrow functions for utilities; use `function` declarations for
  React components (easier to read in stack traces).
- No inline styles — everything goes through Tailwind tokens.
- Format with Prettier on save. ESLint must pass with zero warnings before commit.
- Commit messages follow Conventional Commits:
  `feat:`, `fix:`, `chore:`, `docs:`, `test:`

---

## Git workflow

- Never commit directly to `main` or `develop`
- Create a feature branch before starting any new screen or feature:
  `git checkout -b feat/description-of-feature`
- Commit after each logical unit of work — not at end of session
- Commit messages follow Conventional Commits:
  `feat: add location selector to nav bar`
  `fix: correct refrigerant GWP calculation for R404A`
  `test: add unit tests for commuting tCO2e formula`
- Always run `pnpm lint` and `pnpm test` before committing
- Never commit with failing tests or lint errors
- Write a meaningful commit message — not "wip" or "update"

---

## Progress Report

`docs/progress.md` is a skimmable snapshot, not a full changelog. Before committing:

1. **Always**: add a one-line row to the **Recent Phase Reference** table in `docs/progress.md` (or update **Current State** if a top-level capability changes).
2. **Only if non-obvious**: add or amend an entry under **Architectural Invariants**. Bias against adding — if the decision is visible in the code, leave it out.
3. **Never**: enumerate file modifications, paste verification command output, or list test counts. Those live in `git log`, the diff, and `pnpm test`.

The long-form historical changelog (Phases 0 through 1.10) lives in `docs/progress-archive.md`. Do not append to that file.

---

## Project Context

- On Claude instance startup, the context should be obtained from the files in `docs/` (`project-brief.md`, `progress.md`, `design.md`, `landing.md`, `todo.md`) and a summary should be provided. Skip `progress-archive.md` unless rationale on a specific historical decision is needed.

## UI Tweaks

For UI tweaks (colors, spacing, typography):

- Edit design tokens in src/app/globals.css first (Tailwind v4 is CSS-first; there is no tailwind.config.ts)
- Never read or modify files in /.next, /dist, /build, /node_modules
- Do not search the codebase if I've named the file
- Skip PRD/progress doc checks for tweaks tagged [ui-tweak]
