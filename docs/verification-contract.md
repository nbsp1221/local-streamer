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
| Browser-visible but not runtime-sensitive UI flow | base verification bundle + `bun run verify:e2e-smoke` |
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
- `bun run verify:e2e-smoke` is the required browser smoke layer for browser-visible changes. It currently covers home owner login, playlist owner flow, player layout, and protected playback compatibility.

## Parity rules

- Tests must not depend on an ambient local `.env`.
- Runtime-sensitive test entrypoints should use shared helpers that seed only the required env.
- Required browser smoke should run against an isolated runtime workspace instead of mutating repo-local auth or storage state.
- Required browser smoke and runtime workspace helpers must not read fixture assets from ignored repo-local `storage/`.
- CI-sensitive playback/browser fixtures must come from a test-owned tracked surface such as `tests/fixtures/`.
- CI and local verification should use the same Bun version contract declared by `package.json`.
- Runtime-sensitive verification should run under explicit timezone and locale settings instead of runner defaults.
- `bun install` should fail fast when the running `bun` does not match the repo `packageManager` contract.
- Local Docker parity is not CI-faithful unless it also covers the required `e2e-smoke` surface and the same hermetic input guard.

## Command Authority

The authoritative commands for the current repo state are:

- `bun run verify:hermetic-inputs`
- `bun run verify:base`
- `bun run verify:e2e-smoke`
- `bun run verify:ci-faithful`
- `bun run verify:ci-faithful:docker`
- `bun run verify:ci-clean-export`
- `bun run verify:ci-worktree:docker`
- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run verify:e2e-smoke`
- `docker run --rm --user "$(id -u):$(id -g)" -e CI=true -e GITHUB_ACTIONS=true -e LANG=C.UTF-8 -e LC_ALL=C.UTF-8 -e TZ=Etc/UTC -v "$PWD":/workspace -w /workspace oven/bun:<matching-packageManager-version> bash -lc 'bun install --frozen-lockfile && bun run lint && bun run typecheck && bun run test && bun run build'` as explanatory reference only

The authoritative Docker verification surfaces are `bun run verify:ci-faithful:docker` and `bun run verify:ci-worktree:docker`.
`bun run verify:ci-clean-export` is an authoritative clean-export parity command, but it is not Docker-backed.
Use `bun run verify:ci-worktree:docker` only when you must prove the current dirty worktree in a CI-like container without leaving root-owned artifacts in the host repository.
The raw Docker command above is explanatory reference only and must track the Bun version declared by `package.json` (`bun@1.3.5` at the time of writing) instead of drifting to an arbitrary image tag.

## CI contract

GitHub Actions should run dedicated jobs for:

- `lint`
- `typecheck`
- `test`
- `build`
- `e2e-smoke`

`test` should run the hermetic input guard before `bun run test`.

`e2e-smoke` should run `bun run verify:e2e-smoke`. If broader browser suites are added later, they can remain non-required under `bun run test:e2e` until they are deterministic.

## Broader browser suite

`bun run test:e2e` remains the developer browser entrypoint. In the current repo state it executes the same checked-in specs that `bun run verify:e2e-smoke` targets, while `verify:e2e-smoke` remains the required hermetic smoke wrapper around that suite. If broader browser coverage is added later, it should remain non-required until it is deterministic.

## Browser QA Escalation

When a change is browser-visible and runtime-sensitive, passing the browser smoke suite may still be insufficient. In those cases:

- use `docs/browser-qa-contract.md` to decide whether Playwright MCP or equivalent isolated browser QA is required
- prefer HTTP-level checks before browser QA, but do not use them as a substitute for directly observing a browser-only success condition
- report when browser QA used a fallback because Playwright MCP was unavailable
- if a browser-visible fix depends on tracked fixture assets, verify the same flow from a clean export or equivalent clean-checkout proof before completion

## Non-goals

- Git hooks are optional convenience tools. They are not the correctness boundary.
- A local pass is not considered CI-safe unless the same script and runtime contract also pass in CI.
- “Test added and green” is not sufficient. Runtime-sensitive tests must be hermetic, contract-relevant, and reproducible from tracked inputs only.
