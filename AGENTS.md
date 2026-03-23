# Repository Guidelines

## Project Structure & Module Organization
The React Router app lives in `app/` and follows feature-sliced design: `pages/` expose route shells, `widgets/` bundle UI compositions, `features/` handle workflow logic, `entities/` shape domain models, and shared helpers belong in `shared/`. For new frontend work, reusable primitives live in `app/shared/ui`, shared UI helpers live in `app/shared/lib`, and feature-specific UI stays inside its owning slice. `app/legacy/components/ui/*` remains frozen for compatibility and must not receive new work. Treat `app/shared/ui/*` as generated shadcn source: do not hand-edit primitive internals unless the maintainer explicitly requests it; prefer regenerating via shadcn CLI, version updates, or fixing semantics in the usage layer. Use the `~/*` alias from `tsconfig.json` for internal imports. Static assets stay in `public/`, runtime data in `storage/`, generated bundles in `build/`, and command scripts in `scripts/`. Architectural notes and investigations reside in `docs/`, while Vitest suites live in `tests/` and mirror the features they validate.

## Build, Test, and Development Commands
Install once with `bun install` (other package managers are unsupported). Use `bun run dev` to serve the app at `http://localhost:5173`; prime local data with `bun run init-data` when needed. Before any PR, run `bun run lint`, `bun run lint:fix`, `bun run typecheck`, `bun run test`, and `bun run build`—all must pass. `bun run test` is the full verification entry point and includes the Vitest suite plus both Bun smoke layers. The default `bun run test*` verification commands are env-scrubbed by design: Bun `.env` autoloading is disabled and Vite env-file loading is disabled for the test-facing entrypoints, so they must not depend on an ambient local `.env`. `bun run download:ffmpeg` and `bun run download:shaka` fetch media tooling, and `bun run start` exercises the built server for manual smoke checks.

## Coding Style & Naming Conventions
TypeScript operates in strict mode, so prefer explicit interfaces and avoid `any`. Match the prevailing two-space indentation and split multiline JSX props per the Stylistic ESLint rules. Components, hooks, and providers use PascalCase; helpers and state setters use camelCase; file names mirror their primary export. New reusable UI primitives must be generated or maintained through shadcn in `app/shared/ui`; do not hand-roll repeated primitive controls in page/widget files, do not add new primitive work under `app/legacy/components/ui`, and do not patch shadcn-generated primitive files to solve page-level semantics or layout concerns.

## Testing Guidelines
Vitest drives unit and integration coverage. Name files `*.test.ts`, keep arrange/act/assert sections clear, and maintain ≥75% coverage with `bun run test:run -- --coverage` as noted in `CLAUDE.md`. Use `bun run test:run`, `bun run test:modules`, `bun run test:integration`, `bun run test:ui-dom`, and `bun run test:legacy` for focused Vitest work. Prefer `jsdom + React Testing Library + jest-dom + user-event` for new component-level UI tests instead of string-based markup assertions. Use `bun run test` before handoff so the Bun smoke layers run too. For end-to-end work, follow `docs/E2E_TESTING_GUIDE.md`: start the dev server, cover API flows with cURL, and escalate to Playwright for UI, playback, or DRM checks.

Treat `docs/verification-contract.md` as the source of truth for required verification and escalation rules.
Treat `docs/browser-qa-contract.md` as the source of truth for when Playwright MCP or equivalent isolated browser QA is required.
Use `docs/E2E_TESTING_GUIDE.md` for the practical workflow and test-layer guidance.

High-signal summary:
- always run the base verification bundle before handoff
- add the Docker CI-like verification gate for runtime-sensitive auth, playback, route wiring, or storage changes
- add the required browser smoke and escalate to Playwright MCP or equivalent isolated browser QA when the change is browser-visible and runtime-sensitive
- keep tests environment-independent and free from hidden local-state coupling per the verification contract

## Commit & Pull Request Guidelines
Commits follow the gitmoji + capitalized imperative subject pattern visible in history (e.g., `♻️ Refactor home library view`). Keep subjects under 72 characters, group related work, and avoid force-pushing shared branches. PRs should describe the problem, summarize changes in bullets, list verification steps (lint/test/typecheck/build or Playwright runs), and attach screenshots or clips for UI updates. Link issues or follow-up tasks when available.

## Agent-Specific Notes
Documentation and code comments stay in English, while progress reports to the project owner are delivered in Korean. Maintain Clean Architecture boundaries by routing business logic through `app/modules/` or dedicated hooks and keeping routes thin. For frontend work, prefer shadcn-driven primitives from `~/shared/ui/*`; raw `radix-ui` or `@radix-ui/*` imports belong only inside that primitive layer. Consult `docs/clearkey-investigation.md` before modifying playback flows.
