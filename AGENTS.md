# Repository Guidelines

## Project Structure & Module Organization
The React Router app lives in `app/` and follows feature-sliced design: `pages/` expose route shells, `widgets/` bundle UI compositions, `features/` handle workflow logic, `entities/` shape domain models, and shared helpers belong in `lib/`, `stores/`, and `types/`. Use the `~/*` alias from `tsconfig.json` for internal imports. Static assets stay in `public/`, runtime data in `storage/`, generated bundles in `build/`, and command scripts in `scripts/`. Architectural notes and investigations reside in `docs/`, while Vitest suites live in `tests/` and mirror the features they validate.

## Build, Test, and Development Commands
Install once with `bun install` (other package managers are unsupported). Use `bun run dev` to serve the app at `http://localhost:5173`; prime local data with `bun run init-data` when needed. Before any PR, run `bun run lint`, `bun run lint:fix`, `bun run typecheck`, `bun run test`, and `bun run build`—all must pass. `bun run download:ffmpeg` and `bun run download:shaka` fetch media tooling, and `bun run start` exercises the built server for smoke checks.

## Coding Style & Naming Conventions
TypeScript operates in strict mode, so prefer explicit interfaces and avoid `any`. Match the prevailing two-space indentation and split multiline JSX props per the Stylistic ESLint rules. Components, hooks, and providers use PascalCase; helpers and state setters use camelCase; file names mirror their primary export. Reusable primitives belong in `app/components/`, while slice-specific UI should stay under its feature directory.

## Testing Guidelines
Vitest drives unit and integration coverage. Name files `*.test.ts`, keep arrange/act/assert sections clear, and maintain ≥75% coverage with `bun run test -- --coverage` as noted in `CLAUDE.md`. For end-to-end work, follow `docs/E2E_TESTING_GUIDE.md`: start the dev server, cover API flows with cURL, and escalate to Playwright for UI, playback, or DRM checks.

## Commit & Pull Request Guidelines
Commits follow the gitmoji + Title Case pattern visible in history (e.g., `♻️ Refactor home library view`). Keep subjects under 72 characters, group related work, and avoid force-pushing shared branches. PRs should describe the problem, summarize changes in bullets, list verification steps (lint/test/typecheck/build or Playwright runs), and attach screenshots or clips for UI updates. Link issues or follow-up tasks when available.

## Agent-Specific Notes
Documentation and code comments stay in English, while progress reports to the project owner are delivered in Korean. Maintain Clean Architecture boundaries by routing business logic through `app/modules/` or dedicated hooks and keeping routes thin. Consult `docs/clearkey-investigation.md` before modifying playback flows.
