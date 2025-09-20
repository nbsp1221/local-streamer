# CLAUDE CODE CONFIGURATION - LOCAL STREAMER PROJECT

This file contains project-specific configuration and behavioral rules for Claude Code when working with the Local Streamer codebase.

## PROJECT INFORMATION

- **Git Repository:** Yes
- **Main Branch:** `main`
- **Project Type:** Personal Media Server (React Router v7 + Bun Runtime)
- **Package Manager:** `bun` (CRITICAL: Never use npm, yarn, or pnpm)
- **Runtime:** Bun (Pure Bun runtime, no Node.js)
- **Focus:** DASH Video Streaming with AES-128 Encryption + Clean Architecture
- **Paradigm:** Clean Architecture with UseCase Pattern + Vertical Slicing + CQRS Separation

## WHY CLEAN ARCHITECTURE?

### The Pattern Mixing Crisis

This project started with mixed architectural patterns - direct API calls, business logic in components, and inconsistent state management. This created several critical issues:

- **Debugging Nightmare:** Business logic scattered across routes, hooks, and components
- **Security Risks:** Encryption logic mixed with UI concerns
- **Testing Difficulty:** Coupled code making unit testing nearly impossible
- **AI Collaboration Problems:** No clear patterns for AI to follow consistently

### The Clean Architecture Success

**The architectural consolidation was highly successful,** providing clear separation of concerns, security by design, and AI-friendly patterns that enable safe feature additions.

### Key Insight for AI Development

**When working with this codebase, you are dealing with:**
1. **Media streaming complexity** requiring strict security and performance standards
2. **Financial-grade encryption** where implementation errors mean security breaches
3. **Clean patterns** that enable AI to safely add features without breaking architecture
4. **User experience standards** matching YouTube's UX patterns for familiarity

## DEVELOPMENT AREAS

### Active Development
**All areas EXCEPT those listed as legacy below are active and can be modified.**

Examples of active areas include:
- **`app/modules/`** - Clean Architecture UseCases and domain logic
- **`app/components/`** - React functional components and UI primitives
- **`app/hooks/`** - Custom hooks for state management
- **`app/repositories/`** - Data access layer with JSON storage
- **`app/routes/`** - API routes (thin controllers only)
- **`app/types/`** - TypeScript interfaces and type definitions
- **`tests/`** - All test files
- Any new modules you create for the project

### Legacy Areas (MODIFY WITH CAUTION)

- **`app/welcome/`** - Legacy welcome components (use `app/routes/home.tsx` instead)
- **Direct API calls in components** - Use custom hooks instead
- **Business logic in routes** - Move to UseCases in `app/modules/`

## CRITICAL RULES

### Development Constraints

- **ALWAYS USE Clean Architecture patterns** - UseCases for business logic, thin controllers for routes
- **ALWAYS USE `bun` FOR ALL PACKAGE MANAGEMENT** - never use npm, yarn, pnpm
- **NEVER MIX business logic with presentation layer** - keep UseCases separate from React components
- **SECURITY FIRST** - all video access must use JWT tokens + AES-128 encryption
- **YOUTUBE-INSPIRED UX** - maintain familiar interface patterns for user experience

### Code Quality Standards

- **NO STUBS OR INCOMPLETE CODE** - always finish implementation completely
- **ALL FUNCTIONS MUST HAVE COMPREHENSIVE TYPE HINTS** - no `any` types; use strict TypeScript
- **EVERY USECASE MUST HAVE UNIT TESTS** with comprehensive business logic validation
- **IMMUTABLE DATA PATTERNS** - prefer readonly interfaces and functional updates
- **DOCSTRINGS REQUIRED** for all public functions and UseCases
- **75% MINIMUM CODE COVERAGE** - measured by `bun run test -- --coverage`

### Security Standards

- **JWT TOKEN MANDATORY** for all video/playlist access
- **AES-128 ENCRYPTION** required for all video segments and thumbnails
- **NO SECRETS IN LOGS** - sanitize all console.log statements
- **ARGON2 HASHING** for all password storage
- **CORS PROTECTION** - validate all cross-origin requests
- **INPUT VALIDATION** using Zod schemas for all user inputs

### Performance Requirements

- **2-SECOND STREAMING START** - video playback must begin within 2 seconds
- **4GB FILE SUPPORT** - handle video files up to 4GB efficiently
- **10 CONCURRENT USERS** - support at least 10 simultaneous streams
- **MEMORY EFFICIENCY** - keep memory usage under 512MB during normal operation

### Language Policy

- **Internal Processing:** All thinking, analysis, and technical work in English
- **User Communication:** Final responses only in Korean (한국어)
- **Code Comments:** English only
- **Documentation:** English only
- **UI Text:** English (can be localized later)

## COMMON COMMANDS

### Development Workflow (Recommended)

```bash
# Setup environment
bun install

# Development with type checking
bun run dev         # Start development server
bun run typecheck   # Type checking (required before commits)
bun run lint        # Code linting (required before commits)
bun run lint:fix    # Auto-fix linting issues
bun run test        # Run test suite (required before commits)
```

### Quality Assurance Commands

```bash
# Full quality check (run before any commit)
bun run typecheck && bun run lint && bun run test

# Test with coverage (75% minimum required)
bun run test -- --coverage

# Build verification
bun run build && bun run start
```

### Video Processing Commands

```bash
# Download required binaries (first time setup)
bun run download:ffmpeg  # Download FFmpeg for video processing
bun run download:shaka   # Download Shaka Packager for DASH

# Initialize data directories
bun run init-data       # Create required data directories
```

### Avoid These Commands

```bash
# ⚠️ AVOID - Wrong package managers
npm install
yarn install
pnpm install

# ⚠️ AVOID - Skipping quality checks
git commit -m "quick fix"  # Always run quality checks first
```

## CLEAN ARCHITECTURE PATTERNS

### Vertical Slicing Pattern (Feature Organization)

Each business feature must be organized using Vertical Slicing where all related code is grouped together:

```typescript
// ✅ CORRECT - All "create video" code in one place
modules/video/commands/create-video/
├── create-video.command.ts    # Input/Output contracts
├── create-video.service.ts    # Business logic (UseCase)
├── create-video.controller.ts # API handling
└── create-video.spec.ts       # Feature tests

// ❌ WRONG - Scattered across multiple locations
routes/api/create-video.ts           # Controller here
modules/video/create-video.service.ts # Service here
types/video.ts                       # Types here
tests/video/create-video.test.ts     # Tests here
```

### Adding New Feature: Decision Tree

**STEP 1: Identify Operation Type**
- **State Changing?** → Create in `modules/{domain}/commands/{feature-name}/`
- **Data Retrieval?** → Create in `modules/{domain}/queries/{feature-name}/`

**STEP 2: Identify Domain**
- **Video related?** → `modules/video/`
- **Playlist related?** → `modules/playlist/`
- **User/Auth related?** → `modules/auth/`
- **Cross-domain?** → Consider `modules/shared/` or new integration module

**STEP 3: Create Feature Structure**
```bash
# Example: Adding "like video" feature
mkdir -p app/modules/video/commands/like-video/
cd app/modules/video/commands/like-video/

# Create all required files
touch like-video.command.ts      # Input DTO
touch like-video.service.ts      # UseCase business logic
touch like-video.controller.ts   # API route handler
touch like-video.spec.ts         # Feature tests
```

**STEP 4: Implementation Order**
1. **Define types** in `{feature}.command.ts`
2. **Write tests** in `{feature}.spec.ts`
3. **Implement UseCase** in `{feature}.service.ts`
4. **Create API route** in `{feature}.controller.ts`
5. **Verify quality** with full checklist

### Shared Logic Guidelines

**When to Create Shared Services:**
- Logic used by **3 or more features** → Move to `modules/shared/domain/`
- Infrastructure concerns (database, files, etc.) → Move to `modules/shared/infrastructure/`
- Domain-specific but reusable → Keep in `modules/{domain}/domain/`

**Examples:**
```bash
# Used by video + playlist + auth → shared
modules/shared/domain/jwt-token.service.ts

# Used only by video features → domain
modules/video/domain/video-encryption.service.ts

# Infrastructure utility → shared
modules/shared/infrastructure/json-write-queue.ts
```

### Commands vs Queries Separation (CQRS)

All operations must be clearly categorized as either Commands (state-changing) or Queries (data-retrieval):

```typescript
// ✅ CORRECT - Clear Command pattern
// modules/video/commands/create-video/create-video.command.ts
export interface CreateVideoCommand {
  title: string;
  file: Buffer;
  userId: string;
}

// modules/video/commands/create-video/create-video.service.ts
export class CreateVideoService {
  async execute(command: CreateVideoCommand): Promise<Result<Video, Error>> {
    // State-changing business logic
  }
}

// ✅ CORRECT - Clear Query pattern
// modules/video/queries/find-videos/find-videos.query.ts
export interface FindVideosQuery {
  userId: string;
  tags?: string[];
  limit?: number;
}

// modules/video/queries/find-videos/find-videos.handler.ts
export class FindVideosHandler {
  async execute(query: FindVideosQuery): Promise<Result<Video[], Error>> {
    // Data retrieval logic
  }
}

// ❌ WRONG - Mixed Command and Query in one service
export class VideoService {
  async createVideo(data: any): Promise<Video> { } // Command
  async findVideos(filters: any): Promise<Video[]> { } // Query - should be separate
}
```

### Domain Services Pattern (Shared Logic)

Shared business logic must be organized in domain services within appropriate boundaries:

```typescript
// ✅ CORRECT - Domain-specific shared service
// modules/video/domain/video-encryption.service.ts
export class VideoEncryptionService {
  encryptSegments(segments: Buffer[]): EncryptedSegment[] {
    // Video domain specific encryption logic
  }
}

// ✅ CORRECT - Cross-domain shared service
// modules/shared/domain/jwt-token.service.ts
export class JwtTokenService {
  generate(payload: TokenPayload): string {
    // Used by auth, video, playlist modules
  }
}

// ❌ WRONG - Duplicated logic in multiple features
// modules/video/create-video/jwt-utils.ts
// modules/playlist/create-playlist/jwt-utils.ts
// Same JWT logic duplicated
```

### UseCase Requirements (Business Logic Layer)

- **SINGLE RESPONSIBILITY:** Each UseCase handles exactly one business operation
- **DEPENDENCY INJECTION:** All external dependencies injected through constructor
- **RESULT PATTERN:** Return `{ success: boolean, data?: T, error?: Error }` for business operations
- **NO SIDE EFFECTS:** Pure business logic without direct I/O operations
- **COMPLETE TYPE SAFETY:** Full TypeScript interfaces for all inputs/outputs

```typescript
// ✅ CORRECT - UseCase with dependency injection
export class CreateVideoUseCase {
  async execute(request: CreateVideoRequest): Promise<CreateVideoResult> {
    const validation = this.validateRequest(request);
    if (!validation.success) return { success: false, error: validation.error };

    const video = await this.processVideo(request);
    return { success: true, data: video };
  }
}

// ❌ WRONG - Business logic in API route
export async function action({ request }: Route.ActionArgs) {
  const data = await request.json();
  // 🚨 Business logic should be in UseCase!
  if (!data.title) return Response.json({ error: "Invalid title" });
  const video = await getVideoRepository().create(data);
  return Response.json({ success: true, data: video });
}
```

### Repository Pattern (Data Access Layer)

```typescript
// ✅ CORRECT - Repository with concurrency safety
export class JsonVideoRepository extends BaseJsonRepository<Video> {
  protected createEntity(input: CreateVideoInput): Video {
    return { id: uuidv4(), ...input, addedAt: new Date() };
  }
}

// ❌ WRONG - Direct file operations without concurrency safety
export async function saveVideo(video: Video) {
  const videos = JSON.parse(await fs.readFile('videos.json', 'utf-8'));
  videos.push(video); // 🚨 Race condition risk!
  await fs.writeFile('videos.json', JSON.stringify(videos));
}
```

### React Component Pattern (Presentation Layer)

```typescript
// ✅ CORRECT - Component with custom hooks
export function VideoLibrary() {
  const { videos, deleteVideo } = useVideoLibrary();
  const { user } = useAuthStore();

  return (
    <VideoGrid
      videos={videos}
      onDelete={deleteVideo}
      currentUser={user}
    />
  );
}

// ❌ WRONG - Business logic in component
export function VideoLibrary() {
  const [videos, setVideos] = useState<Video[]>([]);
  const handleDelete = async (videoId: string) => {
    // 🚨 API calls should be in hooks!
    const response = await fetch(`/api/delete/${videoId}`, { method: 'DELETE' });
    if (response.ok) setVideos(prev => prev.filter(v => v.id !== videoId));
  };
}
```

### API Route Pattern (Controller Layer)

```typescript
// ✅ CORRECT - Thin controller with UseCase
export async function action({ request }: Route.ActionArgs) {
  try {
    // 1. Authentication
    const user = await requireAuth(request);

    // 2. Parse input
    const body = await request.json();

    // 3. Create and execute UseCase
    const useCase = new CreateVideoUseCase({
      videoRepository: getVideoRepository(),
      encryptionService: getEncryptionService(),
      logger: console,
    });

    const result = await useCase.execute({ ...body, userId: user.id });

    // 4. Handle result
    if (result.success) {
      return Response.json({ success: true, data: result.data });
    } else {
      return Response.json({ success: false, error: result.error.message }, { status: 400 });
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ❌ WRONG - Business logic in route
export async function action({ request }: Route.ActionArgs) {
  const data = await request.json();

  // 🚨 All this should be in UseCase!
  if (!data.title) throw new Error('Title required');

  const encryptedFile = await encryptVideo(data.file);
  const thumbnail = await generateThumbnail(data.file);
  const video = await getVideoRepository().create({
    ...data,
    encryptedFile,
    thumbnail
  });

  return Response.json({ success: true, data: video });
}
```

## TASK COMPLETION VERIFICATION

### BEFORE CONSIDERING ANY TASK COMPLETE:

1. **ARCHITECTURE COMPLIANCE**
   - ✅ Business logic in UseCases only
   - ✅ API routes are thin controllers
   - ✅ React components handle presentation only
   - ✅ Repository pattern for all data access

2. **TYPE SAFETY**
   - ✅ No `any` types in new code: `bun run typecheck`
   - ✅ Complete interface definitions for all data structures
   - ✅ Proper error type handling with Result pattern

3. **SECURITY VERIFICATION**
   - ✅ JWT token validation for protected endpoints
   - ✅ AES-128 encryption for video segments
   - ✅ Input validation using Zod schemas
   - ✅ No secrets in logs or console outputs

4. **PERFORMANCE STANDARDS**
   - ✅ Video streaming starts within 2 seconds
   - ✅ Memory usage under 512MB during operation
   - ✅ Supports files up to 4GB
   - ✅ Handles 10 concurrent users

5. **TESTING REQUIREMENTS**
   - ✅ All UseCases have unit tests: `bun run test`
   - ✅ Integration tests for API endpoints
   - ✅ 75% code coverage minimum: `bun run test -- --coverage`
   - ✅ Error scenarios covered in tests

6. **CODE QUALITY**
   - ✅ No linting errors: `bun run lint`
   - ✅ Proper TypeScript types: `bun run typecheck`
   - ✅ Gitmoji commit convention followed
   - ✅ Documentation for all public APIs

### Testing Commands by Scope

```bash
# Run all tests with coverage
bun run test -- --coverage

# Test specific modules
bun test tests/modules/video/
bun test tests/repositories/

# Integration testing
bun test tests/ --grep "integration"

# Performance testing
bun test tests/performance/
```

## DEVELOPMENT WORKFLOW

### Before Starting Any Task

1. **Understand the domain:** Check existing UseCases and patterns in `app/modules/`
2. **Verify security requirements:** Ensure JWT tokens and encryption are properly handled
3. **Plan the architecture:** Identify which layer (UseCase, Repository, Component) needs changes
4. **Design tests first:** Plan comprehensive test coverage for new functionality

### Implementation Process

1. **Write tests first** for business logic and edge cases
2. **Implement UseCase** with complete business logic and error handling
3. **Create Repository methods** if new data access is needed
4. **Add API routes** as thin controllers calling UseCases
5. **Update React components** to use new hooks or state
6. **Verify security and performance** requirements are met
7. **Run complete quality checklist** before considering done


### Complete Feature Addition Example

```bash
# Scenario: Add "Add video to favorites" feature

# 1. Decision: State-changing + User-related → auth/commands
mkdir -p app/modules/auth/commands/add-to-favorites/

# 2. Create required files: command.ts, service.ts, controller.ts, spec.ts
# 3. Register API route in app/routes.ts
# 4. Run quality checks: bun run typecheck && bun run lint && bun run test
```

### Never Do These Things

**Architecture Violations:**
- **DON'T put business logic in API routes** - use UseCases in modules/{domain}/commands or queries
- **DON'T put business logic in React components** - use custom hooks
- **DON'T access repositories directly from routes** - use UseCases
- **DON'T mix Commands and Queries** - separate state-changing from data-retrieval operations
- **DON'T put shared logic in multiple places** - use modules/shared/ for cross-domain concerns

**Folder Structure Violations:**
- **DON'T create files outside the Vertical Slicing structure** - everything goes in modules/{domain}/{commands|queries}/{feature}/
- **DON'T mix feature code across domains** - video logic stays in modules/video/, playlist logic in modules/playlist/
- **DON'T create deep nested folders** - maximum depth: modules/{domain}/{type}/{feature}/{file}
- **DON'T duplicate similar features** - check existing commands/queries before creating new ones

**Security and Quality:**
- **DON'T skip JWT validation** for protected video/playlist operations
- **DON'T use `any` types** - maintain strict TypeScript
- **DON'T commit without running quality checks** - always verify tests pass
- **DON'T mix package managers** - use `bun` exclusively
- **DON'T expose sensitive data in logs** - sanitize all outputs
- **DON'T skip encryption** for video segments or thumbnails

**Common Anti-Patterns:**
- **DON'T create "utils" folders inside feature modules** - use modules/shared/ instead
- **DON'T import across domain boundaries** - use shared services or domain events
- **DON'T create generic "service" files** - be specific: video-encryption.service.ts, not video.service.ts

## SECURITY AND PERFORMANCE REQUIREMENTS

### Video Streaming Security

```typescript
// ✅ CORRECT - Secure video access pattern
export class GenerateVideoTokenUseCase {
  async execute(request: { videoId: string; userId: string }): Promise<TokenResult> {
    // 1. Verify user has access to video
    const hasAccess = await this.checkVideoAccess(request.videoId, request.userId);
    if (!hasAccess) {
      return { success: false, error: new UnauthorizedError() };
    }

    // 2. Generate JWT token with expiration
    const token = jwt.sign(
      { videoId: request.videoId, userId: request.userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return { success: true, data: { token } };
  }
}

// ❌ WRONG - Insecure video access
export async function videoHandler({ params }: Route.LoaderArgs) {
  // 🚨 No authentication check!
  const videoPath = path.join('data/videos', params.videoId, 'manifest.mpd');
  return new Response(await fs.readFile(videoPath));
}
```

### Performance Optimization Patterns

```typescript
// ✅ CORRECT - Efficient video processing
export class ProcessVideoUseCase {
  async execute(request: ProcessVideoRequest): Promise<ProcessVideoResult> {
    // 1. Validate file size (max 4GB)
    if (request.fileSize > 4 * 1024 * 1024 * 1024) {
      return { success: false, error: new FileTooLargeError() };
    }

    // 2. Stream processing to avoid memory issues
    const processor = new StreamingVideoProcessor();
    const result = await processor.process(request.filePath);

    return { success: true, data: result };
  }
}

// ❌ WRONG - Memory-inefficient processing
export async function processVideo(filePath: string) {
  // 🚨 Loading entire file into memory!
  const fileBuffer = await fs.readFile(filePath);
  const processedBuffer = await heavyProcessing(fileBuffer);
  return processedBuffer;
}
```

## VERTICAL SLICING ARCHITECTURE

### Core Principle: "Everything Related to a Feature in One Place"

This project follows **Vertical Slicing** pattern where each business feature contains all its related code in a single module. This enables:
- **Predictable Code Location:** AI and developers can instantly find all code related to a specific feature
- **Independent Development:** Each feature can be developed, tested, and deployed independently
- **Microservice Ready:** Clear boundaries enable easy extraction to separate services if needed


## FILE STRUCTURE REFERENCE

```
app/
├── modules/                    # Business Features (Vertical Slices)
│   ├── video/
│   │   ├── commands/          # State-changing operations
│   │   │   ├── create-video/
│   │   │   │   ├── create-video.command.ts    # Input DTO
│   │   │   │   ├── create-video.service.ts    # UseCase (business logic)
│   │   │   │   ├── create-video.controller.ts # API route handler
│   │   │   │   └── create-video.spec.ts       # Feature tests
│   │   │   ├── delete-video/
│   │   │   │   ├── delete-video.command.ts
│   │   │   │   ├── delete-video.service.ts
│   │   │   │   ├── delete-video.controller.ts
│   │   │   │   └── delete-video.spec.ts
│   │   │   ├── process-video/
│   │   │   └── update-video/
│   │   ├── queries/           # Data-retrieval operations
│   │   │   ├── find-videos/
│   │   │   │   ├── find-videos.query.ts
│   │   │   │   ├── find-videos.handler.ts
│   │   │   │   ├── find-videos.controller.ts
│   │   │   │   └── find-videos.spec.ts
│   │   │   ├── get-video/
│   │   │   └── get-video-manifest/
│   │   └── domain/            # Shared domain logic for video
│   │       ├── video.entity.ts
│   │       ├── video.repository.port.ts
│   │       └── video-encryption.service.ts
│   ├── playlist/
│   │   ├── commands/
│   │   │   ├── create-playlist/
│   │   │   ├── add-video-to-playlist/
│   │   │   ├── remove-video-from-playlist/
│   │   │   └── delete-playlist/
│   │   ├── queries/
│   │   │   ├── find-playlists/
│   │   │   ├── get-playlist/
│   │   │   └── get-playlist-items/
│   │   └── domain/
│   │       ├── playlist.entity.ts
│   │       ├── playlist.repository.port.ts
│   │       └── playlist-validation.service.ts
│   ├── auth/
│   │   ├── commands/
│   │   │   ├── login/
│   │   │   ├── logout/
│   │   │   └── setup-user/
│   │   ├── queries/
│   │   │   ├── get-user/
│   │   │   └── validate-session/
│   │   └── domain/
│   │       ├── user.entity.ts
│   │       ├── session.entity.ts
│   │       └── auth-token.service.ts
│   └── shared/                # Cross-domain services (Shared Kernel)
│       ├── domain/
│       │   ├── jwt-token.service.ts      # JWT generation/validation
│       │   ├── encryption.service.ts     # AES-128 encryption
│       │   ├── file-validation.service.ts # File type/size validation
│       │   └── uuid.service.ts           # UUID generation
│       └── infrastructure/
│           ├── json-write-queue.ts       # Concurrency-safe file operations
│           ├── logger.service.ts         # Application logging
│           └── config.service.ts         # Environment configuration
├── components/                # Frontend React Components (separate architecture)
│   ├── ui/                    # Design system primitives
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   └── VideoCard.tsx
│   └── pages/                 # Page-level components
│       ├── HomePage.tsx
│       ├── VideoPlayerPage.tsx
│       └── PlaylistPage.tsx
├── hooks/                     # Frontend state management
├── repositories/              # Data access implementations
│   ├── base/                  # BaseJsonRepository
│   ├── JsonVideoRepository.ts
│   ├── JsonPlaylistRepository.ts
│   └── JsonUserRepository.ts
├── routes/                    # API routing (thin layer)
│   ├── api/                   # RESTful API endpoints
│   └── pages/                 # React Router SSR pages
├── types/                     # Global TypeScript definitions
├── stores/                    # Global Zustand stores
└── utils/                     # Global utility functions

tests/
├── modules/                   # Feature tests (mirrors module structure)
│   ├── video/
│   │   ├── commands/
│   │   └── queries/
│   ├── playlist/
│   └── auth/
├── repositories/              # Data layer tests
├── integration/               # End-to-end API tests
└── shared/                    # Shared service tests
```

## IMPORTANT NOTES

### Media Streaming Domain Requirements

- **YouTube UX Standard:** All UI patterns should match YouTube's familiar interface
- **2-Second Rule:** Video playback must start within 2 seconds of user action
- **Security First:** Every video access requires JWT token validation
- **Quality Focus:** 75% test coverage minimum, zero `any` types allowed
- **Performance Critical:** Support 4GB files with 10 concurrent users

### Key Architectural Benefits

The Clean Architecture implementation provides testability through independent layers, maintainability via clear separation, predictable AI collaboration patterns, domain-level security, and concurrency-safe performance.

### Common Mistakes to Avoid

- **Pattern Mixing:** Never mix direct API calls with UseCase patterns
- **Business Logic Leakage:** Keep domain logic in UseCases, not components
- **Security Shortcuts:** Always validate JWT tokens for protected resources
- **Type Safety Compromises:** Maintain strict TypeScript throughout
- **Test Skipping:** Write tests before implementation, not after

---

_This configuration file defines the behavioral rules and constraints for Claude Code when working with the Local Streamer media server. All interactions must follow these guidelines strictly to maintain architecture quality, security standards, and performance requirements._
