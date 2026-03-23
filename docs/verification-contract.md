# Verification Contract

The repo verification contract uses the standard script surface:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`

## Required Verification Matrix

Use this matrix to decide what must run before reporting a task complete.

| Change type | Required verification |
| --- | --- |
| Documentation-only | `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` |
| Pure module or non-runtime-sensitive server logic | `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` |
| Browser-visible but not runtime-sensitive UI flow | base verification bundle + `bun run test:e2e -- tests/e2e/home-library-owner-smoke.spec.ts tests/e2e/player-layout.spec.ts` |
| Auth, playback, route wiring, storage, or other runtime-sensitive behavior | base verification bundle + Docker CI-like verification |
| Runtime-sensitive and browser-visible flow | base verification bundle + Docker CI-like verification + required browser smoke + Playwright MCP or equivalent isolated browser QA when HTTP checks are insufficient |

The base verification bundle is:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`

## Purpose of each command

- `lint` checks static lint rules.
- `typecheck` checks React Router type generation plus TypeScript contracts.
- `test` covers Vitest plus the Bun auth smoke layers under env-scrubbed conditions.
- `build` verifies the production build succeeds.
- `bun run test:e2e -- tests/e2e/home-library-owner-smoke.spec.ts tests/e2e/player-layout.spec.ts` is the required browser smoke layer for browser-visible changes.

## Parity rules

- Tests must not depend on an ambient local `.env`.
- Runtime-sensitive test entrypoints should use shared helpers that seed only the required env.
- Required browser smoke should run against an isolated runtime workspace instead of mutating repo-local auth or storage state.
- CI and local verification should use the same Bun version contract declared by `package.json`.
- Runtime-sensitive verification should run under explicit timezone and locale settings instead of runner defaults.
- `bun install` should fail fast when the running `bun` does not match the repo `packageManager` contract.

## Command Authority

The authoritative commands for the current repo state are:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run test:e2e -- tests/e2e/home-library-owner-smoke.spec.ts tests/e2e/player-layout.spec.ts`
- `docker run --rm --user "$(id -u):$(id -g)" -e CI=true -e GITHUB_ACTIONS=true -e LANG=C.UTF-8 -e LC_ALL=C.UTF-8 -e TZ=Etc/UTC -v "$PWD":/workspace -w /workspace oven/bun:<matching-packageManager-version> bash -lc 'bun install --frozen-lockfile && bun run lint && bun run typecheck && bun run test && bun run build'`

The Docker command must track the Bun version declared by `package.json` (`bun@1.3.5` at the time of writing) instead of drifting to an arbitrary image tag.

## CI contract

GitHub Actions should run dedicated jobs for:

- `lint`
- `typecheck`
- `test`
- `build`
- `e2e-smoke`

`e2e-smoke` should run `bun run test:e2e -- tests/e2e/home-library-owner-smoke.spec.ts tests/e2e/player-layout.spec.ts`. Heavier browser suites can remain non-required under `bun run test:e2e` until they are deterministic.

## Broader browser suite

`bun run test:e2e` remains the broader developer browser suite. It is useful for local browser/playback investigation, but it is not part of the standard hermetic verification contract until the heavier playback compatibility scenarios become deterministic.

## Browser QA Escalation

When a change is browser-visible and runtime-sensitive, passing the browser smoke suite may still be insufficient. In those cases:

- use `docs/browser-qa-contract.md` to decide whether Playwright MCP or equivalent isolated browser QA is required
- prefer HTTP-level checks before browser QA, but do not use them as a substitute for directly observing a browser-only success condition
- report when browser QA used a fallback because Playwright MCP was unavailable

## Non-goals

- Git hooks are optional convenience tools. They are not the correctness boundary.
- A local pass is not considered CI-safe unless the same script and runtime contract also pass in CI.
