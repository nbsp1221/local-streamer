# E2E Smoke SQLite Contention Implementation Plan

Status: Completed implementation record
Last reviewed: 2026-05-01

> This document records the plan and outcome for the e2e smoke SQLite contention stabilization pass.
> Do not treat it as a fresh execution directive. Use `docs/verification-contract.md` and
> `docs/E2E_TESTING_GUIDE.md` for current verification guidance.

**Goal:** Make the required hermetic browser smoke suite deterministic by removing shared SQLite write contention as a flaky failure source and by improving auth failure diagnostics.

**Architecture:** The immediate e2e harness fix is to serialize the required hermetic smoke run because it currently uses one built server, one runtime workspace, and one SQLite database. The product-side resilience fix belongs in the primary SQLite adapter so auth, playlist, ingest, and playback repositories share the same per-database write coordination instead of adding auth-specific retries. The e2e login helper should expose the actual login response and cookie state before waiting on final navigation.

**Tech Stack:** Bun 1.3.5, React Router v7, TypeScript, Playwright, Vitest, SQLite/libsql, `async-mutex`.

---

## 1. Review Findings Covered

This plan covers the new flaky-CI findings:

- `playwright.config.ts:13-23`: hermetic smoke shares one mutable DB/storage workspace across parallel Playwright workers.
- `app/modules/storage/infrastructure/sqlite/primary-sqlite.database.ts:117-123`: primary SQLite enables WAL but has no busy timeout, retry, or per-database write coordination.

The older completed-plan finding for `docs/plans/2026-04-30-runtime-documentation-alignment-implementation-plan.md` is not part of this implementation. That document already starts with `Status: Completed implementation record` and should remain a historical record.

## 2. Current Failure Model

Observed failure:

- CI initially failed in `tests/e2e/player-layout.spec.ts`.
- The failing helper was `tests/e2e/support/player-auth.ts`.
- The browser stayed at `/login?redirectTo=%2Fplayer%2F...` until `page.waitForURL(/player/:id$/)` timed out.
- Local `--workers=1` passed.
- Local parallel repeat reproduced the same failure pattern.
- A trace-enabled run passed, which is consistent with timing-sensitive contention.

Root cause to address:

- `bun run verify:e2e-smoke` runs multiple smoke spec files through one Playwright process.
- `playwright.config.ts` creates one hermetic runtime workspace and passes its single `DATABASE_SQLITE_PATH` and `STORAGE_DIR` to one web server.
- `tests/support/create-runtime-test-workspace.ts` sets `authDbPath`, `databasePath`, and `videoMetadataDbPath` to the same `storage/db.sqlite`.
- Auth login writes `auth_sessions`.
- Playlist and upload smoke specs also write the same primary DB.
- Player access can touch the auth session.
- The primary SQLite adapter does not coordinate writes across repository adapters that open the same DB path.

## 3. Non-Goals

- Do not redesign the Playwright harness into per-worker web servers in this pass.
- Do not split auth back out into a separate SQLite database.
- Do not change product authentication policy, cookie names, session TTL, or rate-limit behavior.
- Do not hide all errors with broad retries in route handlers.
- Do not relax the required smoke coverage surface.
- Do not commit automatically; stage and commit only when the project owner explicitly asks.

## 4. Task List

### Task 1: Add Primary SQLite Write-Contention Regression Coverage

**Files:**

- Create: `app/modules/storage/infrastructure/sqlite/primary-sqlite.database.test.ts`

**Step 1: Write a regression test for concurrent write transactions against one DB path**

Create a module test that opens two primary SQLite adapters for the same file. Hold the first write transaction open, start the second transaction, and assert the second write does not enter the transaction body until the first one completes.

Use this structure:

```ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { createPrimarySqliteDatabase } from './primary-sqlite.database';

interface EventRow {
  id: string;
  position: number;
}

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

const workspaces: string[] = [];

afterEach(async () => {
  await Promise.all(
    workspaces.splice(0).map(workspace => rm(workspace, { force: true, recursive: true })),
  );
});

describe('createPrimarySqliteDatabase', () => {
  test('serializes write transactions opened from separate adapters for one database file', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'local-streamer-primary-sqlite-'));
    workspaces.push(workspace);
    const dbPath = join(workspace, 'storage', 'db.sqlite');
    const firstDatabase = await createPrimarySqliteDatabase({ dbPath });
    const secondDatabase = await createPrimarySqliteDatabase({ dbPath });
    const firstStarted = deferred();
    const releaseFirst = deferred();
    let secondEntered = false;

    await firstDatabase.exec(`
      CREATE TABLE events (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL
      ) STRICT
    `);

    const firstWrite = firstDatabase.transaction(async database => {
      await database.prepare(`
        INSERT INTO events (id, position)
        VALUES (?, ?)
      `).run('first', 1);
      firstStarted.resolve();
      await releaseFirst.promise;
    });

    await firstStarted.promise;

    const secondWrite = secondDatabase.transaction(async database => {
      secondEntered = true;
      await database.prepare(`
        INSERT INTO events (id, position)
        VALUES (?, ?)
      `).run('second', 2);
    });

    const racedBeforeRelease = await Promise.race([
      secondWrite.then(() => 'completed' as const),
      new Promise<'blocked'>(resolve => setTimeout(() => resolve('blocked'), 50)),
    ]);

    expect(racedBeforeRelease).toBe('blocked');
    expect(secondEntered).toBe(false);

    releaseFirst.resolve();

    await firstWrite;
    await secondWrite;

    await expect(firstDatabase.prepare<EventRow>(`
      SELECT id, position
      FROM events
      ORDER BY position
    `).all()).resolves.toEqual([
      { id: 'first', position: 1 },
      { id: 'second', position: 2 },
    ]);
  });
});
```

If this test unexpectedly passes before implementation on a specific platform, keep it as regression coverage and use the parallel Playwright repeat command in Task 6 as the failing baseline.

**Step 2: Run the focused module test**

Run:

```bash
bun run test:modules -- app/modules/storage/infrastructure/sqlite/primary-sqlite.database.test.ts
```

Expected before implementation: the test fails or flakes with a lock/transaction contention symptom.

### Task 2: Add Per-Database Write Coordination And Busy Timeout

**Files:**

- Modify: `app/modules/storage/infrastructure/sqlite/primary-sqlite.database.ts`
- Modify: `app/modules/storage/infrastructure/sqlite/migrated-primary-sqlite.database.ts`
- Test: `app/modules/storage/infrastructure/sqlite/primary-sqlite.database.test.ts`
- Test: `app/modules/storage/infrastructure/sqlite/schema-migration-runner.test.ts`

**Step 1: Add a module-level write mutex map**

Import `resolve` and `Mutex`:

```ts
import { dirname, resolve } from 'node:path';
import { Mutex } from 'async-mutex';
```

Add a per-path mutex map near the interfaces:

```ts
const writeMutexes = new Map<string, Mutex>();

function getWriteMutex(dbPath: string): Mutex {
  const key = resolve(dbPath);
  let mutex = writeMutexes.get(key);

  if (!mutex) {
    mutex = new Mutex();
    writeMutexes.set(key, mutex);
  }

  return mutex;
}
```

Do not add cleanup yet. The app normally opens a small number of configured DB paths per process. Adding eviction now would create more risk than value.

**Step 2: Lock top-level writes, exec calls, and write transactions**

Update the adapter factory so top-level `exec`, `statement.run`, and `transaction` are serialized through the per-path mutex. Do not lock `all` or `get`.

Use this shape:

```ts
function createStatement<RowType>(
  executor: StatementExecutor,
  sql: string,
  writeMutex?: Mutex,
): SqliteStatement<RowType> {
  return {
    async all(...params) {
      const result = await executor.execute({
        args: params,
        sql,
      });

      return result.rows as RowType[];
    },

    async get(...params) {
      const rows = await this.all(...params);
      return rows[0];
    },

    async run(...params) {
      const executeRun = async () => {
        const result = await executor.execute({
          args: params,
          sql,
        });

        return {
          changes: result.rowsAffected,
          lastInsertRowid: result.lastInsertRowid,
        };
      };

      return writeMutex ? writeMutex.runExclusive(executeRun) : executeRun();
    },
  };
}
```

Update `createLibsqlAdapter` to accept the mutex:

```ts
function createLibsqlAdapter(client: Client, writeMutex: Mutex): SqliteDatabaseAdapter {
  return {
    async exec(sql) {
      await writeMutex.runExclusive(async () => {
        await client.executeMultiple(sql);
      });
    },

    prepare<RowType = unknown>(sql: string) {
      return createStatement<RowType>(client, sql, writeMutex);
    },

    async transaction<T>(callback: (database: SqliteDatabaseAdapter) => Promise<T>) {
      return writeMutex.runExclusive(async () => {
        const transaction = await client.transaction('write');
        const transactionAdapter = createTransactionAdapter(transaction);

        try {
          const result = await callback(transactionAdapter);
          await transaction.commit();
          return result;
        }
        catch (error) {
          await transaction.rollback();
          throw error;
        }
      });
    },
  };
}
```

Leave `createTransactionAdapter` unlocked. It is already running inside the outer write lock, and locking again with the same mutex would deadlock.

**Step 3: Enable SQLite busy timeout**

In `createPrimarySqliteDatabase`, derive the mutex and enable a timeout:

```ts
const client = createClient({
  url: toFileDatabaseUrl(input.dbPath),
});
const database = createLibsqlAdapter(client, getWriteMutex(input.dbPath));

await database.exec('PRAGMA foreign_keys = ON');
await database.exec('PRAGMA busy_timeout = 5000');
await database.exec('PRAGMA journal_mode = WAL');
```

The mutex handles same-process repository contention. `busy_timeout` handles lower-level SQLite waits and gives external same-file access a short window to clear.

**Step 4: Normalize migration coordination keys**

In `app/modules/storage/infrastructure/sqlite/migrated-primary-sqlite.database.ts`, normalize the migration promise key with `resolve(input.dbPath)` so migration coordination uses the same per-file identity as the write mutex.

**Step 5: Run module coverage**

Run:

```bash
bun run test:modules -- app/modules/storage/infrastructure/sqlite/primary-sqlite.database.test.ts app/modules/storage/infrastructure/sqlite/schema-migration-runner.test.ts
```

Expected: all tests pass.

### Task 3: Serialize The Required Hermetic Smoke Entry Point

**Files:**

- Modify: `playwright.config.ts`
- Read: `tests/support/detect-playwright-runtime-mode.ts`
- Test: `bun run verify:e2e-smoke`

**Step 1: Add a Playwright worker cap for hermetic smoke**

Add this config property near `forbidOnly` and `reporter`:

```ts
workers: runtimeMode === 'hermetic-smoke' ? 1 : undefined,
```

Keep the setting in `playwright.config.ts`, not in `package.json`, so the worker cap follows the detected runtime mode instead of only one npm script.

**Step 2: Preserve explicit stress-test overrides**

Do not remove the ability to pass `--workers=4` manually. The implementation should let a developer run the exact smoke file list with an explicit worker override when stress-testing the SQLite fix.

**Step 3: Run a config sanity check**

Run:

```bash
bun run test:e2e -- tests/e2e/home-library-owner-smoke.spec.ts tests/e2e/add-videos-owner-upload-smoke.spec.ts tests/e2e/playlist-owner-smoke.spec.ts tests/e2e/player-layout.spec.ts tests/e2e/player-playback-compatibility.spec.ts --list
```

Expected: Playwright lists the smoke tests without starting unrelated developer-full fixture backfill.

### Task 4: Harden Smoke Login Diagnostics

**Files:**

- Create: `tests/e2e/support/auth.ts`
- Modify: `tests/e2e/support/player-auth.ts`
- Modify: `tests/e2e/home-library-owner-smoke.spec.ts`
- Modify: `tests/e2e/playlist-owner-smoke.spec.ts`
- Modify: `tests/e2e/add-videos-owner-upload-smoke.spec.ts`
- Test: the exact hermetic smoke file list

**Step 1: Use one shared login helper for smoke specs**

Create `loginToPath` as the shared smoke helper. It should:

- navigate to `/login?redirectTo=...`,
- wait for the client hydration signal before filling and clicking,
- submit through the real login UI,
- assert that `/api/auth/login` returns `{ success: true }`,
- assert that the browser context stores `site_session`,
- require the expected post-login URL without manually navigating there.

Expose the hydration signal from `app/root.tsx` with `document.documentElement.dataset.localStreamerHydrated = 'true'` in a client `useEffect`. The smoke helper may wait for that signal, but it must not repair a failed login redirect by calling `page.goto(input.redirectTo)`.

If the project later makes `AUTH_SESSION_COOKIE_NAME` configurable in e2e, replace the literal `site_session` with a shared test helper. Do not add that abstraction in this pass unless a test already needs it.

**Step 2: Run the affected e2e specs**

Run the exact smoke file list so Playwright enters hermetic mode:

```bash
bun run test:e2e -- tests/e2e/home-library-owner-smoke.spec.ts tests/e2e/add-videos-owner-upload-smoke.spec.ts tests/e2e/playlist-owner-smoke.spec.ts tests/e2e/player-layout.spec.ts tests/e2e/player-playback-compatibility.spec.ts --grep "player layout"
```

Expected: the player layout tests pass. If they fail, the error should now show hydration readiness, login response status/body, missing `site_session` state, or failed post-login redirect state.

### Task 5: Document The Stabilized Smoke Contract

**Files:**

- Modify: `docs/E2E_TESTING_GUIDE.md`
- Modify: `docs/verification-contract.md`

**Step 1: Update the E2E guide**

In `docs/E2E_TESTING_GUIDE.md`, under the required browser smoke section, add a short note:

```md
The required hermetic smoke command intentionally runs with one Playwright worker while it uses a single built server and a single temporary SQLite runtime workspace. Use explicit `bun run test:e2e -- ... --workers=N` invocations only for targeted stress investigation.
```

**Step 2: Update the verification contract**

In `docs/verification-contract.md`, under the description of `bun run verify:e2e-smoke`, add:

```md
This required smoke command is the stability boundary and may use stricter worker settings than ad hoc `bun run test:e2e` runs. Parallel browser stress runs are diagnostic, not the default required gate, until the harness owns per-worker runtime isolation.
```

Keep the command authority list unchanged unless the script name changes.

### Task 6: Run Required Verification And Stress Checks

**Files:**

- Read: `docs/verification-contract.md`
- Read: `docs/browser-qa-contract.md`

**Step 1: Run focused module checks**

Run:

```bash
bun run test:modules -- app/modules/storage/infrastructure/sqlite/primary-sqlite.database.test.ts app/modules/storage/infrastructure/sqlite/schema-migration-runner.test.ts
```

Expected: pass.

**Step 2: Run auth/session regression coverage**

Run:

```bash
bun run test:modules -- app/modules/auth/application/use-cases/create-auth-session.usecase.test.ts app/modules/auth/application/use-cases/resolve-auth-session.usecase.test.ts app/modules/auth/infrastructure/sqlite/sqlite-session.repository.test.ts
bun run test:integration -- tests/integration/auth/auth-phase1-routes.test.ts
```

Expected: pass.

**Step 3: Run the required browser smoke gate**

Run:

```bash
bun run verify:e2e-smoke
```

Expected: pass.

**Step 4: Run a parallel stress proof**

Run:

```bash
bun run test:e2e -- tests/e2e/home-library-owner-smoke.spec.ts tests/e2e/add-videos-owner-upload-smoke.spec.ts tests/e2e/playlist-owner-smoke.spec.ts tests/e2e/player-layout.spec.ts tests/e2e/player-playback-compatibility.spec.ts --workers=4 --repeat-each=10
```

Expected: pass. If this fails, keep the diagnostic output and do not claim the root cause is fixed. Investigate whether the failure is still `/api/auth/login`, session cookie storage, protected route redirect-back, upload media prep timeout, or another browser-visible issue.

**Step 5: Run the base verification authority**

Run:

```bash
bun run verify:base
```

Expected: pass.

**Step 6: Run CI-like Docker verification if local Docker is available**

Because this changes runtime-sensitive storage behavior and required browser smoke behavior, run:

```bash
bun run verify:ci-worktree:docker
```

Expected: pass.

Use `bun run verify:ci-faithful:docker` only after the relevant changes are committed or otherwise present in a clean tracked export. If Docker is unavailable, report that blocker explicitly and run `bun run verify:ci-faithful` as the fallback.

## 5. Success Conditions

- The required smoke command is deterministic in its default supported path.
- `loginToPath` failures report the login API result or missing session cookie instead of timing out only on final URL.
- Primary SQLite writes from separate adapters for one DB file are coordinated inside one process.
- Primary SQLite enables a nonzero busy timeout.
- Existing auth/session, migration, and browser smoke tests pass.
- Parallel smoke stress with `--workers=4 --repeat-each=10` passes. A better diagnostic is useful for follow-up triage, but it is not sufficient to claim the SQLite contention fix is complete.
- `docs/E2E_TESTING_GUIDE.md` and `docs/verification-contract.md` describe why the required smoke path is serialized while the harness has one shared runtime workspace.

## 6. Implementation Outcome

Implemented on 2026-05-01:

- The hermetic Playwright smoke project now runs with one worker while it shares one built server and one runtime SQLite workspace.
- The primary SQLite adapter now enables `PRAGMA busy_timeout = 5000` and serializes same-process write `exec`, write statements, and write transactions per resolved DB path.
- Migration de-duplication now keys by the resolved DB path, matching the write coordination key.
- E2E smoke login setup now uses one shared helper that waits for client hydration, submits through the real login UI, verifies the `/api/auth/login` response, verifies `site_session`, and then requires the expected post-login URL without manually navigating there.
- The e2e and verification docs now state that the required hermetic smoke path is intentionally serialized until the harness has per-worker runtime isolation.

## 7. If The Stress Run Still Fails

Do not broaden retries blindly. Use the new diagnostics to branch:

- `/api/auth/login` returns 500: inspect server output and SQLite error code, then extend shared DB retry/queue handling.
- `/api/auth/login` returns 200 but `site_session` is missing: investigate Set-Cookie handling through the production React Router server.
- `site_session` exists but `/player/:id` redirects back to login: inspect `requireProtectedPageSession`, session lookup, and cookie parsing.
- login succeeds but player assertions fail later: treat as a separate player/layout/playback issue.

Only consider a per-worker server/workspace Playwright harness after this smaller fix is verified insufficient.
