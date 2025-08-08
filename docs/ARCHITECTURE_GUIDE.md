# Local Streamer Architecture & Refactoring Guide (2025)

Purpose: A concise, opinionated guide to architecture choices and refactoring directions for this project. It distills industry practices (Remix/React Router, Hexagonal/Clean Architecture, lightweight DDD) so contributors don’t need to re-search the same topics.

- Scope: Backend-facing app code (Remix/React Router server routes, services, file I/O, streaming), not UI styling.
- Tone: Practical over theoretical. Code examples are intentionally lightweight.

## 1) TL;DR — Recommendations

- Keep routes thin (Remix loaders/actions): input validation → call use case → return typed result/errors.
- Adopt lightweight Ports & Adapters (Hexagonal/Clean style): define interfaces (ports) in app, implement adapters (JSON/FS/FFmpeg/crypto) separately.
- Function-first services with manual dependency injection (DI). Use small classes only for stateful, resource-oriented components (locks, queues, crypto streams).
- Harden streaming: async I/O, proper Range validation (416), ETag/Last-Modified, consistent headers, error paths, and nginx for production video serving.
- File I/O safety: basename/normalize checks, atomic writes (tmp → rename), a single-writer queue/mutex for JSON.
- Security: environment-enforced keys (no defaults), signed short-lived URLs if sharing, strict cookies, input validation everywhere.
- Testing: mock ports in unit tests; add a few integration tests for critical API flows; measure streaming with range curl tests.
- Tooling consistency: pick Bun or npm and align Dockerfile; add ESLint/Prettier and CI checks.

## 2) Architectural Philosophy (Practical)

### 2.1 Ports & Adapters (Hexagonal)
Ports define what the application needs (interfaces). Adapters provide concrete implementations (file system, JSON, FFmpeg, crypto). This separates business logic from infrastructure and enables easy swapping (e.g., JSON → SQLite).

### 2.2 Clean Architecture (Layering)
Same spirit as Hexagonal: Presentation → Application (use cases) → Domain (entities/rules). Infrastructure is outside rings. This guide uses the lightest viable layering to avoid ceremony.

### 2.3 DDD (Lightweight)
DDD is a modeling approach, not an architecture. Use its vocabulary (entities/value objects, ubiquitous language) and keep domain logic in pure modules. Full aggregates/domain events may be overkill at current scale.

### 2.4 Classes vs Functions
- Prefer function-based services (factory functions returning an object of operations) for simple dependencies and testability.
- Use small classes for stateful adapters: file write queue, rate limiter, encryption transforms, caches. Encapsulation of internal state and lifecycle is useful here.

### 2.5 DI Style
Avoid heavy containers. Compose dependencies in a small assembly module (request-scoped if needed). Pass dependencies explicitly into factories.

## 3) Remix/React Router Patterns (Server)

- Routes are thin: do validation (Zod), call a use case, and return a `Response`/JSON. Throw `Response` for error flows when idiomatic.
- Keep SSR on if you need it; treat data mutations in `action` and reads in `loader`.
- ESM only: import Node core modules via ESM (no `require` in ESM).
- Use `stream.pipeline` for Node streams and handle abort/error events.

## 4) Current State — Key Observations

- Storage is JSON/FS-based in `app/services/*-store.server.ts` with direct file I/O and no explicit write concurrency control.
- Streaming route uses sync I/O and partial Range handling; headers and error behavior can be tightened.
- FFmpeg thumbnail/duration logic exists; no explicit concurrency control.
- XOR crypto stream exists; one method uses `require('crypto')` under ESM.
- Security: default XOR key is allowed; cookie flags are reasonable but can be stricter; path traversal protections can be stronger.
- Tooling: repo prefers Bun, Dockerfile uses npm. Align one toolchain.

## 5) Minimal-Overhead Folder Layout

```
app/
  routes/                  # Remix routes (thin)
  application/             # use-case factories (function-first)
  domain/                  # pure types/rules
  ports/                   # interfaces (repositories, storage, crypto, thumbnail)
  adapters/
    json/                  # JsonVideoRepository, JsonUserRepository, JsonSessionRepository
    fs/                    # FileStorage, WriteQueue
    ffmpeg/                # ThumbnailService
    crypto/                # XorEncryption
  lib/                     # logger, validation, errors, http helpers
  dependencies.server.ts   # assembly (request-scoped, if needed)
```

Keep current `app/components`, `app/types`, and `configs` as-is, moving only cross-cutting helpers into `lib/` where appropriate.

## 6) Small Code Examples

### 6.1 Port (interface)
```ts
// app/ports/VideoRepository.ts
import type { Video } from "~/types/video";

export interface VideoRepository {
  findAll(): Promise<Video[]>;
  findById(id: string): Promise<Video | null>; 
  create(input: Omit<Video, "id" | "addedAt">): Promise<Video>;
  update(id: string, updates: Partial<Omit<Video, "id" | "addedAt">>): Promise<Video | null>;
  delete(id: string): Promise<boolean>;
}
```

### 6.2 Adapter (JSON impl)
```ts
// app/adapters/json/JsonVideoRepository.ts
import { promises as fs } from "fs";
import type { VideoRepository } from "~/ports/VideoRepository";
import type { Video } from "~/types/video";

export function createJsonVideoRepository(filePath: string): VideoRepository {
  async function read(): Promise<Video[]> {
    const raw = await fs.readFile(filePath, "utf-8").catch(() => "[]");
    const list = JSON.parse(raw) as any[];
    return list.map(v => ({ ...v, addedAt: new Date(v.addedAt) }));
  }
  async function write(videos: Video[]): Promise<void> {
    const data = videos.map(v => ({ ...v, addedAt: v.addedAt.toISOString() }));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }
  return {
    async findAll() { return read(); },
    async findById(id) { return (await read()).find(v => v.id === id) ?? null; },
    async create(input) {
      const now = new Date();
      const video: Video = { id: crypto.randomUUID(), addedAt: now, ...input } as Video;
      const all = await read();
      all.unshift(video);
      await write(all);
      return video;
    },
    async update(id, updates) {
      const all = await read();
      const i = all.findIndex(v => v.id === id);
      if (i === -1) return null;
      all[i] = { ...all[i], ...updates, id, addedAt: all[i].addedAt };
      await write(all);
      return all[i];
    },
    async delete(id) {
      const all = await read();
      const next = all.filter(v => v.id !== id);
      await write(next);
      return next.length !== all.length;
    },
  };
}
```

### 6.3 Service (function-first use case)
```ts
// app/application/video-service.ts
import type { VideoRepository } from "~/ports/VideoRepository";

export function createVideoService(deps: { videoRepo: VideoRepository }) {
  return {
    async list() {
      return deps.videoRepo.findAll();
    },
    async create(input: { title: string; tags: string[]; videoUrl: string; thumbnailUrl?: string; duration?: number; format: string; description?: string }) {
      // Example rule: unique title (simple check)
      const existing = await deps.videoRepo.findAll();
      if (existing.some(v => v.title === input.title)) throw new Error("Video title already exists");
      return deps.videoRepo.create({ ...input, addedAt: undefined } as any);
    },
  };
}
```

### 6.4 Route usage (thin Remix action)
```ts
// app/routes/api/videos.ts
import { createVideoService } from "~/application/video-service";
import { createJsonVideoRepository } from "~/adapters/json/JsonVideoRepository";

export async function action({ request }: { request: Request }) {
  const repo = createJsonVideoRepository(process.cwd() + "/data/videos.json");
  const videoService = createVideoService({ videoRepo: repo });
  const body = await request.json();
  // TODO: validate with Zod
  const created = await videoService.create(body);
  return Response.json({ success: true, data: created });
}
```

## 7) Streaming Hardening (Key Points)

- Replace sync I/O with async (`fs.promises.stat`); unify both encrypted and plain paths using `stream.pipeline`.
- Validate Range: reject invalid formats; clamp values; return 416 on out-of-range; always include `Accept-Ranges: bytes`.
- Add `ETag`/`Last-Modified`; support conditional requests (`If-None-Match`, `If-Modified-Since`) for thumbnails/static responses.
- Production: serve `/videos/*` via nginx with `sendfile` and `mp4` module; proxy `/api/*` and UI to Remix server.

## 8) File I/O Safety

- Path traversal: only allow `path.basename(filename)` and ensure normalized path starts with the allowed base directory.
- Atomic writes: write to `*.tmp` then `rename`.
- Single-writer queue: serialize writes to JSON files to avoid races.

Example (pseudo):
```ts
class WriteQueue {
  private last = Promise.resolve();
  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.last.then(task, task);
    this.last = run.then(() => undefined, () => undefined);
    return run;
  }
}
```

## 9) Security Notes

- Do not allow default XOR key in production; require `XOR_ENCRYPTION_KEY`. Consider signed, short-lived URLs instead of relying on obfuscation.
- Cookies: `HttpOnly`, `Secure` (behind TLS/proxy), `SameSite=strict` when possible. Rate-limit login.
- Validate inputs with Zod; centralize error formatting.

## 10) Performance Notes

- Remove HLS overhead for MVP; prefer direct MP4 + Range.
- For production streaming speed, let nginx handle `/videos/*` directly.
- Cache thumbnails and static responses with `Cache-Control`.

## 11) Testing Strategy

- Unit: mock ports (repositories/storage) to test application services.
- Integration: login, import, stream Range (small byte windows), delete flows.
- Benchmarks: curl Range tests comparing API vs nginx (after switching).

## 12) Refactoring Roadmap (Small Project Scale)

1. Quick fixes (1–2h)
   - Replace ESM `require` usages; switch sync fs to async in hot paths; enforce env key; basic Range validation.
2. Boundary setup (0.5–1d)
   - Introduce ports; extract JSON adapters from `*-store.server.ts`; create function-first services; add a small `dependencies.server.ts`.
3. Streaming hardening (0.5–1d)
   - Unify streaming with `pipeline`; add 416 and headers; document nginx config under `docs/DEPLOYMENT.md`.
4. Concurrency & I/O (0.5d)
   - Add write queue + atomic JSON writes; path normalization checks.
5. Tooling (0.5d)
   - Align Bun vs npm (and Dockerfile); add ESLint/Prettier; CI for typecheck + tests.

## 13) References (curated)

- Remix / React Router official docs (server loaders/actions, SSR patterns)
- Hexagonal (Ports & Adapters), Clean Architecture summaries
- DDD lightweight practices in JS/TS
- Node.js streams and `stream.pipeline` guidance
- nginx mp4 module/sendfile best practices for static video

This guide aims to stay small, actionable, and specific to this repository. Prefer small, incremental edits over large rewrites.


