# Local Streamer 백엔드 아키텍처 개선 계획

**문서 버전**: 1.0  
**작성일**: 2025-08-05  
**대상 프로젝트**: Local Streamer v1.0  

## 📋 목차

1. [개요](#개요)
2. [현재 아키텍처 분석](#현재-아키텍처-분석)
3. [목표 아키텍처](#목표-아키텍처)
4. [개선 계획 개요](#개선-계획-개요)
5. [Phase별 상세 구현 계획](#phase별-상세-구현-계획)
6. [구현 가이드라인](#구현-가이드라인)
7. [리스크 분석 및 대응방안](#리스크-분석-및-대응방안)
8. [성공 지표 및 측정 방법](#성공-지표-및-측정-방법)

## 개요

### 목적
Local Streamer 프로젝트의 백엔드 아키텍처를 현재의 단순함을 유지하면서도 확장성, 유지보수성, 테스트 용이성을 확보할 수 있도록 점진적으로 개선하는 것을 목표로 합니다.

### 핵심 원칙
- **점진적 개선**: 기존 기능을 손상시키지 않으면서 단계별 개선
- **타입 안전성**: TypeScript와 React Router v7의 장점 최대 활용
- **확장성 준비**: 향후 DB 마이그레이션 및 스케일링 대비
- **개발자 경험**: 코드 품질 향상 및 개발 생산성 증대

## 현재 아키텍처 분석

### 현재 구조 개요

```
Local Streamer Architecture (현재)
├── React Router v7 (Frontend + SSR)
├── API Routes (app/routes/api/)
├── Services Layer (app/services/)
├── File-based Storage (JSON)
└── Authentication (Session-based)
```

### 파일 구조 분석
```
app/
├── routes/api/          # API 엔드포인트 (Controller 역할)
│   ├── auth/           # 인증 관련 API
│   ├── stream.$id.ts   # 비디오 스트리밍
│   ├── thumbnail.$id.ts # 썸네일 서빙
│   └── ...
├── services/           # 비즈니스 로직 + 데이터 접근
│   ├── video-store.server.ts
│   ├── user-store.server.ts
│   ├── session-store.server.ts
│   └── file-manager.server.ts
├── utils/             # 공통 유틸리티
│   └── auth.server.ts
└── types/             # 타입 정의
    ├── auth.ts
    └── video.ts
```

### 현재 구조의 강점

#### ✅ 장점
1. **단순성**: 복잡한 설정 없이 빠른 개발 가능
2. **타입 안전성**: TypeScript + React Router v7 자동 타입 생성
3. **SSR 지원**: SEO 최적화 및 초기 로딩 성능
4. **완전한 인증 시스템**: 세션 기반 인증, Argon2 해싱
5. **파일 기반 단순함**: DB 설정 없이 즉시 사용 가능

#### ✅ 구현된 기능
- 사용자 인증 및 권한 관리
- 비디오 업로드 및 관리
- 실시간 스트리밍 (Range Request 지원)
- 썸네일 생성 (ffmpeg)
- 파일 관리 및 UUID 기반 식별

### 현재 구조의 한계

#### ❌ 확장성 제한
1. **동시성 문제**: JSON 파일 기반 저장으로 인한 Race Condition
2. **검색 성능**: 대용량 데이터 시 선형 검색으로 인한 성능 저하
3. **백업/복구**: 파일 시스템 의존적 데이터 관리

#### ❌ 유지보수성 이슈
1. **비즈니스 로직 분산**: 서비스와 데이터 로직이 혼재
2. **에러 처리 비일관성**: 각 API별로 다른 에러 처리 방식
3. **검증 로직 중복**: API별로 중복된 입력 검증

#### ❌ 테스트 어려움
1. **파일 시스템 의존성**: 단위 테스트 시 실제 파일 I/O 필요
2. **Mock 어려움**: 구체 클래스 의존으로 Mock 객체 생성 복잡
3. **통합 테스트 부재**: API 엔드포인트 테스트 환경 미구축

## 목표 아키텍처

### 설계 원칙

#### 1. 관심사 분리 (Separation of Concerns)
- **Presentation Layer**: API 라우트 (입력/출력 처리)
- **Business Layer**: 서비스 (비즈니스 로직)
- **Data Layer**: Repository (데이터 접근)
- **Infrastructure Layer**: 파일시스템, 외부 API

#### 2. 의존성 역전 (Dependency Inversion)
- 고수준 모듈이 저수준 모듈에 의존하지 않음
- 인터페이스에 의존하여 구현체 교체 용이성 확보

#### 3. 단일 책임 원칙 (Single Responsibility)
- 각 클래스/모듈이 하나의 책임만 가짐
- 변경 사유가 하나로 제한

### 목표 아키텍처 다이어그램

```
Target Architecture
┌─────────────────────────────────────────────────────┐
│                 Presentation Layer                  │
├─────────────────────────────────────────────────────┤
│ React Router v7 Routes + API Endpoints             │
│ - Input Validation (Zod)                           │
│ - Error Handling                                    │
│ - Response Formatting                               │
└─────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────┐
│                  Business Layer                     │
├─────────────────────────────────────────────────────┤
│ Services (Pure Business Logic)                     │
│ - VideoService                                      │
│ - UserService                                       │
│ - AuthService                                       │
│ - FileProcessingService                             │
└─────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────┐
│                   Data Layer                        │
├─────────────────────────────────────────────────────┤
│ Repositories (Data Access Abstraction)             │
│ - IVideoRepository → JSONVideoRepository            │
│ - IUserRepository → JSONUserRepository              │
│ - ISessionRepository → JSONSessionRepository        │
└─────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────┐
│                Infrastructure Layer                 │
├─────────────────────────────────────────────────────┤
│ - File System                                       │
│ - Cache (Memory/Redis)                              │
│ - External APIs                                     │
│ - Configuration Management                          │
└─────────────────────────────────────────────────────┘
```

## 개선 계획 개요

### Phase 구성
총 5개 Phase로 구성되며, 각 Phase는 2-3주 내에 완료 가능한 규모로 설계

- **Phase 1-A**: 기반 인프라 구축 (Configuration, Logging)
- **Phase 1-B**: API 레이어 개선 (Validation, Error Handling)
- **Phase 1-C**: 데이터 레이어 리팩토링 (Repository Pattern)
- **Phase 1-D**: 보안 및 성능 개선 (Auth Enhancement, Caching)
- **Phase 1-E**: 개발자 경험 개선 (Testing, Monitoring)

### 전체 일정
- **예상 기간**: 5-6주
- **병렬 작업 가능**: 일부 Feature들은 독립적으로 구현 가능
- **점진적 배포**: 각 Feature 완료 후 즉시 적용 가능

## Phase별 상세 구현 계획

### Phase 1-A: 기반 인프라 구축

#### Feature 1: 🔧 Configuration Management System

**목적**: 환경별 설정을 중앙화하고 타입 안전하게 관리

**구현 상세**:

```typescript
// app/config/index.ts
export interface AppConfig {
  server: ServerConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  storage: StorageConfig;
  logging: LoggingConfig;
}

// app/config/server.ts
export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: 'development' | 'production' | 'test';
}

// app/config/database.ts
export interface DatabaseConfig {
  type: 'json' | 'sqlite' | 'postgresql';
  path: string;
  maxConnections?: number;
}
```

**파일 구조 변경**:
```
app/config/
├── index.ts          # 통합 설정 인터페이스
├── server.ts         # 서버 관련 설정
├── database.ts       # 데이터베이스 설정
├── auth.ts           # 인증 관련 설정
└── storage.ts        # 파일 저장소 설정
```

**구현 단계**:
1. 기본 설정 인터페이스 정의
2. 환경변수 기반 설정 로더 구현
3. 기존 하드코딩된 설정값 교체
4. 설정 검증 로직 추가

**테스트 방법**:
```typescript
// config.test.ts
describe('Configuration', () => {
  it('환경변수에 따른 설정 로드', () => {
    process.env.NODE_ENV = 'test';
    const config = loadConfig();
    expect(config.server.nodeEnv).toBe('test');
  });
});
```

**마이그레이션 가이드**:
- 기존 코드에서 `process.env` 직접 사용 → `config` 객체 사용
- 설정 변경 시 재시작 필요 → 런타임 설정 변경 지원

**예상 시간**: 2-3시간  
**위험도**: 낮음

---

#### Feature 2: 📝 Structured Logging System

**목적**: 중앙화된 로깅 시스템으로 디버깅 및 모니터링 개선

**구현 상세**:

```typescript
// app/lib/logger.ts
export interface Logger {
  debug(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, error?: Error, meta?: Record<string, any>): void;
}

export class StructuredLogger implements Logger {
  info(message: string, meta: Record<string, any> = {}) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
  
  error(message: string, error?: Error, meta: Record<string, any> = {}) {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error?.message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      ...meta
    }));
  }
}
```

**환경별 로그 포맷**:
- **Development**: 가독성 있는 포맷
- **Production**: JSON 구조화 로그

**구현 단계**:
1. Logger 인터페이스 및 구현체 생성
2. 환경별 로그 포맷터 구현
3. 기존 `console.log` 점진적 교체
4. 로그 레벨 설정 기능 추가

**사용 예시**:
```typescript
// Before
console.log('User logged in:', user.email);

// After
logger.info('User logged in', { 
  userId: user.id, 
  email: user.email,
  userAgent: request.headers.get('User-Agent')
});
```

**예상 시간**: 2-3시간  
**위험도**: 매우 낮음

---

### Phase 1-B: API 레이어 개선

#### Feature 3: ✅ API Validation Middleware

**목적**: Zod 기반 타입 안전한 입력 검증 시스템 구축

**구현 상세**:

```typescript
// app/lib/validation.ts
import { z } from 'zod';

export const VideoSchema = z.object({
  title: z.string().min(1).max(200),
  tags: z.array(z.string()).max(10),
  description: z.string().max(1000).optional()
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4)
});

// 검증 미들웨어
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return async (request: Request): Promise<T> => {
    const body = await request.json();
    
    try {
      return schema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid input', error.errors);
      }
      throw error;
    }
  };
}
```

**API 라우트 적용**:
```typescript
// app/routes/api/auth/login.ts
export async function action({ request }: Route.ActionArgs) {
  const { email, password } = await validateRequest(LoginSchema)(request);
  
  // 검증된 데이터로 안전하게 처리
  const user = await authenticateUser(email, password);
  // ...
}
```

**구현 단계**:
1. 공통 스키마 정의
2. 검증 미들웨어 구현
3. 각 API 라우트에 검증 적용
4. 에러 메시지 국제화 준비

**예상 시간**: 4-5시간  
**위험도**: 중간

---

#### Feature 4: 🚨 Centralized Error Handling

**목적**: 통일된 에러 처리 시스템으로 안정성 향상

**구현 상세**:

```typescript
// app/lib/errors.ts
export abstract class AppError extends Error {
  abstract statusCode: number;
  abstract errorCode: string;
  
  constructor(message: string, public metadata?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  statusCode = 400;
  errorCode = 'VALIDATION_ERROR';
}

export class NotFoundError extends AppError {
  statusCode = 404;
  errorCode = 'NOT_FOUND';
}

export class AuthenticationError extends AppError {
  statusCode = 401;
  errorCode = 'AUTHENTICATION_REQUIRED';
}

// 전역 에러 핸들러
export function handleApiError(error: unknown): Response {
  const logger = getLogger();
  
  if (error instanceof AppError) {
    logger.warn('Application error', {
      errorCode: error.errorCode,
      message: error.message,
      metadata: error.metadata
    });
    
    return Response.json({
      success: false,
      error: {
        code: error.errorCode,
        message: error.message
      }
    }, { status: error.statusCode });
  }
  
  // 예상치 못한 에러
  logger.error('Unexpected error', error as Error);
  
  return Response.json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred'
    }
  }, { status: 500 });
}
```

**API 응답 표준화**:
```typescript
// 성공 응답
{
  "success": true,
  "data": { ... }
}

// 에러 응답
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [...]
  }
}
```

**예상 시간**: 3-4시간  
**위험도**: 중간

---

### Phase 1-C: 데이터 레이어 리팩토링

#### Feature 5: 🗄️ Repository Pattern Implementation

**목적**: 데이터 접근 로직을 추상화하여 확장성 및 테스트 용이성 확보

**구현 상세**:

```typescript
// app/repositories/interfaces/IVideoRepository.ts
export interface IVideoRepository {
  findAll(): Promise<Video[]>;
  findById(id: string): Promise<Video | null>;
  findByTag(tag: string): Promise<Video[]>;
  create(video: Omit<Video, 'id' | 'addedAt'>): Promise<Video>;
  update(id: string, updates: Partial<Video>): Promise<Video | null>;
  delete(id: string): Promise<boolean>;
  search(query: string): Promise<Video[]>;
}

// app/repositories/impl/JSONVideoRepository.ts
export class JSONVideoRepository implements IVideoRepository {
  constructor(
    private filePath: string,
    private logger: Logger
  ) {}
  
  async findAll(): Promise<Video[]> {
    try {
      await this.ensureFile();
      const content = await fs.readFile(this.filePath, 'utf-8');
      const videos = JSON.parse(content);
      
      return videos.map(this.deserializeVideo);
    } catch (error) {
      this.logger.error('Failed to load videos', error);
      return [];
    }
  }
  
  async create(videoData: Omit<Video, 'id' | 'addedAt'>): Promise<Video> {
    const video: Video = {
      id: uuidv4(),
      addedAt: new Date(),
      ...videoData
    };
    
    const videos = await this.findAll();
    videos.unshift(video);
    await this.saveAll(videos);
    
    this.logger.info('Video created', { videoId: video.id });
    return video;
  }
  
  private deserializeVideo(data: any): Video {
    return {
      ...data,
      addedAt: new Date(data.addedAt)
    };
  }
  
  private async saveAll(videos: Video[]): Promise<void> {
    const serialized = videos.map(video => ({
      ...video,
      addedAt: video.addedAt.toISOString()
    }));
    
    await fs.writeFile(
      this.filePath, 
      JSON.stringify(serialized, null, 2), 
      'utf-8'
    );
  }
}
```

**의존성 주입 설정**:
```typescript
// app/lib/container.ts
export class DIContainer {
  private static instance: DIContainer;
  private repositories: Map<string, any> = new Map();
  
  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }
  
  getVideoRepository(): IVideoRepository {
    if (!this.repositories.has('video')) {
      const config = getConfig();
      const logger = getLogger();
      
      this.repositories.set('video', 
        new JSONVideoRepository(config.database.videosPath, logger)
      );
    }
    
    return this.repositories.get('video');
  }
}
```

**파일 구조**:
```
app/repositories/
├── interfaces/
│   ├── IVideoRepository.ts
│   ├── IUserRepository.ts
│   └── ISessionRepository.ts
├── impl/
│   ├── JSONVideoRepository.ts
│   ├── JSONUserRepository.ts
│   └── JSONSessionRepository.ts
└── index.ts
```

**마이그레이션 전략**:
1. Repository 인터페이스 먼저 정의
2. 기존 `*-store.server.ts` 파일들을 Repository로 변환
3. 서비스에서 Repository 인터페이스 사용
4. 기존 서비스 코드에서 데이터 로직 제거

**예상 시간**: 6-8시간  
**위험도**: 높음

---

#### Feature 6: 🔄 Service Layer Enhancement

**목적**: 순수한 비즈니스 로직으로 서비스 레이어 리팩토링

**구현 상세**:

```typescript
// app/services/VideoService.ts
export class VideoService {
  constructor(
    private videoRepository: IVideoRepository,
    private fileManager: IFileManager,
    private logger: Logger
  ) {}
  
  async createVideo(videoData: CreateVideoRequest): Promise<Video> {
    // 비즈니스 규칙 검증
    await this.validateVideoCreation(videoData);
    
    // 파일 처리
    const processedFile = await this.fileManager.processVideo(
      videoData.filePath
    );
    
    // 비디오 생성
    const video = await this.videoRepository.create({
      title: videoData.title,
      tags: videoData.tags,
      videoUrl: processedFile.videoUrl,
      thumbnailUrl: processedFile.thumbnailUrl,
      duration: processedFile.duration,
      format: processedFile.format
    });
    
    this.logger.info('Video created successfully', { 
      videoId: video.id 
    });
    
    return video;
  }
  
  async searchVideos(query: SearchQuery): Promise<SearchResult> {
    const { q, tags, sortBy = 'addedAt', order = 'desc' } = query;
    
    let videos: Video[];
    
    if (q) {
      videos = await this.videoRepository.search(q);
    } else {
      videos = await this.videoRepository.findAll();
    }
    
    // 태그 필터링
    if (tags && tags.length > 0) {
      videos = videos.filter(video => 
        tags.some(tag => video.tags.includes(tag))
      );
    }
    
    // 정렬
    videos = this.sortVideos(videos, sortBy, order);
    
    return {
      videos,
      total: videos.length,
      query
    };
  }
  
  private async validateVideoCreation(data: CreateVideoRequest): Promise<void> {
    // 제목 중복 검사
    const existingVideos = await this.videoRepository.findAll();
    const duplicate = existingVideos.find(v => v.title === data.title);
    
    if (duplicate) {
      throw new BusinessRuleError('Video with this title already exists');
    }
    
    // 파일 크기 검사
    if (data.fileSize > MAX_VIDEO_SIZE) {
      throw new BusinessRuleError('Video file too large');
    }
  }
}
```

**서비스 팩토리**:
```typescript
// app/services/ServiceFactory.ts
export class ServiceFactory {
  private static videoService: VideoService;
  
  static getVideoService(): VideoService {
    if (!this.videoService) {
      const container = DIContainer.getInstance();
      
      this.videoService = new VideoService(
        container.getVideoRepository(),
        container.getFileManager(),
        container.getLogger()
      );
    }
    
    return this.videoService;
  }
}
```

**API 라우트에서 사용**:
```typescript
// app/routes/api/videos.ts
export async function action({ request }: Route.ActionArgs) {
  const videoService = ServiceFactory.getVideoService();
  const videoData = await validateRequest(CreateVideoSchema)(request);
  
  try {
    const video = await videoService.createVideo(videoData);
    return Response.json({ success: true, data: video });
  } catch (error) {
    return handleApiError(error);
  }
}
```

**예상 시간**: 4-6시간  
**위험도**: 높음

---

### Phase 1-D: 보안 및 성능 개선

#### Feature 7: 🔐 Enhanced Authentication Middleware

**목적**: 인증/권한 체계 강화 및 보안 향상

**구현 상세**:

```typescript
// app/middleware/auth.ts
export interface AuthContext {
  user: User;
  permissions: Permission[];
}

export class AuthMiddleware {
  constructor(
    private userService: UserService,
    private sessionService: SessionService,
    private logger: Logger
  ) {}
  
  requireAuth(permissions?: Permission[]) {
    return async (request: Request): Promise<AuthContext> => {
      const sessionId = this.extractSessionId(request);
      
      if (!sessionId) {
        throw new AuthenticationError('Authentication required');
      }
      
      const session = await this.sessionService.validateSession(sessionId);
      if (!session) {
        throw new AuthenticationError('Invalid or expired session');
      }
      
      const user = await this.userService.findById(session.userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }
      
      // 권한 검사
      if (permissions && permissions.length > 0) {
        const userPermissions = await this.getUserPermissions(user);
        const hasPermission = permissions.every(p => 
          userPermissions.includes(p)
        );
        
        if (!hasPermission) {
          throw new AuthorizationError('Insufficient permissions');
        }
      }
      
      return { user, permissions: await this.getUserPermissions(user) };
    };
  }
}
```

**Rate Limiting**:
```typescript
// app/middleware/rateLimit.ts
export class RateLimitMiddleware {
  private attempts: Map<string, number[]> = new Map();
  
  limitRequests(maxAttempts: number, windowMs: number) {
    return (request: Request): void => {
      const clientId = this.getClientId(request);
      const now = Date.now();
      
      const attempts = this.attempts.get(clientId) || [];
      const recentAttempts = attempts.filter(time => 
        now - time < windowMs
      );
      
      if (recentAttempts.length >= maxAttempts) {
        throw new RateLimitError('Too many requests');
      }
      
      recentAttempts.push(now);
      this.attempts.set(clientId, recentAttempts);
    };
  }
}
```

**JWT 토큰 지원**:
```typescript
// JWT 기반 API 인증 (세션과 병행)
export class JWTAuthService {
  generateApiToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'api' },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
  }
  
  validateApiToken(token: string): { userId: string } {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      return { userId: payload.userId };
    } catch {
      throw new AuthenticationError('Invalid API token');
    }
  }
}
```

**예상 시간**: 4-5시간  
**위험도**: 중간

---

#### Feature 8: 🚀 Basic Caching Layer

**목적**: 메모리 기반 캐싱으로 성능 최적화

**구현 상세**:

```typescript
// app/lib/cache.ts
export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryCache implements CacheProvider {
  private cache: Map<string, CacheEntry> = new Map();
  
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value as T;
  }
  
  async set<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    
    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now()
    });
  }
}

interface CacheEntry {
  value: any;
  expiresAt: number;
  createdAt: number;
}
```

**캐시 전략 적용**:
```typescript
// app/services/VideoService.ts (캐시 적용)
export class VideoService {
  async findAllVideos(): Promise<Video[]> {
    const cacheKey = 'videos:all';
    
    // 캐시에서 먼저 확인
    let videos = await this.cache.get<Video[]>(cacheKey);
    
    if (!videos) {
      videos = await this.videoRepository.findAll();
      await this.cache.set(cacheKey, videos, 300); // 5분 캐시
      
      this.logger.debug('Videos loaded from database and cached');
    } else {
      this.logger.debug('Videos loaded from cache');
    }
    
    return videos;
  }
  
  async createVideo(videoData: CreateVideoRequest): Promise<Video> {
    const video = await this.videoRepository.create(videoData);
    
    // 캐시 무효화
    await this.cache.delete('videos:all');
    await this.cache.delete(`videos:search:*`);
    
    return video;
  }
}
```

**썸네일 캐싱**:
```typescript
// app/routes/api/thumbnail.$id.ts
export async function loader({ params, request }: Route.LoaderArgs) {
  const cacheKey = `thumbnail:${params.id}`;
  
  // 캐시 확인
  let thumbnailData = await cache.get<Buffer>(cacheKey);
  
  if (!thumbnailData) {
    thumbnailData = await generateThumbnail(params.id);
    await cache.set(cacheKey, thumbnailData, 86400); // 24시간
  }
  
  return new Response(thumbnailData, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}
```

**예상 시간**: 3-4시간  
**위험도**: 낮음

---

### Phase 1-E: 개발자 경험 개선

#### Feature 9: 🧪 Testing Infrastructure

**목적**: 테스트 환경 구축으로 코드 품질 및 안정성 확보

**구현 상세**:

**테스트 설정**:
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts']
  },
  resolve: {
    alias: {
      '~': './app'
    }
  }
});
```

**Mock 및 테스트 유틸리티**:
```typescript
// tests/mocks/repositories.ts
export class MockVideoRepository implements IVideoRepository {
  private videos: Video[] = [];
  
  async findAll(): Promise<Video[]> {
    return [...this.videos];
  }
  
  async create(videoData: Omit<Video, 'id' | 'addedAt'>): Promise<Video> {
    const video: Video = {
      id: `test-${Date.now()}`,
      addedAt: new Date(),
      ...videoData
    };
    
    this.videos.unshift(video);
    return video;
  }
  
  // Mock 데이터 제어 메서드
  setVideos(videos: Video[]): void {
    this.videos = [...videos];
  }
  
  clear(): void {
    this.videos = [];
  }
}
```

**단위 테스트 예시**:
```typescript
// tests/services/VideoService.test.ts
describe('VideoService', () => {
  let videoService: VideoService;
  let mockVideoRepository: MockVideoRepository;
  let mockFileManager: MockFileManager;
  
  beforeEach(() => {
    mockVideoRepository = new MockVideoRepository();
    mockFileManager = new MockFileManager();
    
    videoService = new VideoService(
      mockVideoRepository,
      mockFileManager,
      mockLogger
    );
  });
  
  describe('createVideo', () => {
    it('should create video successfully', async () => {
      const videoData = {
        title: 'Test Video',
        tags: ['test'],
        filePath: '/tmp/test.mp4',
        fileSize: 1000000
      };
      
      mockFileManager.setProcessResult({
        videoUrl: '/videos/test.mp4',
        thumbnailUrl: '/thumbnails/test.jpg',
        duration: 120,
        format: 'mp4'
      });
      
      const result = await videoService.createVideo(videoData);
      
      expect(result).toBeDefined();
      expect(result.title).toBe('Test Video');
      expect(result.tags).toEqual(['test']);
    });
    
    it('should throw error for duplicate title', async () => {
      mockVideoRepository.setVideos([
        createTestVideo({ title: 'Existing Video' })
      ]);
      
      const videoData = {
        title: 'Existing Video',
        tags: [],
        filePath: '/tmp/test.mp4',
        fileSize: 1000000
      };
      
      await expect(videoService.createVideo(videoData))
        .rejects.toThrow('Video with this title already exists');
    });
  });
});
```

**통합 테스트**:
```typescript
// tests/integration/api.test.ts
describe('API Integration Tests', () => {
  let app: any;
  
  beforeAll(async () => {
    app = await createTestApp();
  });
  
  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });
});
```

**테스트 데이터 팩토리**:
```typescript
// tests/factories/video.ts
export function createTestVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: faker.string.uuid(),
    title: faker.lorem.words(3),
    tags: faker.helpers.arrayElements(['action', 'comedy', 'drama']),
    videoUrl: `/videos/${faker.string.uuid()}.mp4`,
    thumbnailUrl: `/thumbnails/${faker.string.uuid()}.jpg`,
    duration: faker.number.int({ min: 60, max: 7200 }),
    addedAt: faker.date.recent(),
    format: 'mp4',
    ...overrides
  };
}
```

**예상 시간**: 5-6시간  
**위험도**: 없음

---

#### Feature 10: 📊 Health Check & Monitoring

**목적**: 시스템 상태 모니터링 및 운영 가시성 확보

**구현 상세**:

```typescript
// app/routes/api/health.ts
export async function loader({ request }: Route.LoaderArgs) {
  const healthCheck = new HealthCheckService();
  
  const checks = await Promise.allSettled([
    healthCheck.checkDatabase(),
    healthCheck.checkFileSystem(),
    healthCheck.checkMemory(),
    healthCheck.checkDiskSpace()
  ]);
  
  const results = checks.map((check, index) => ({
    name: ['database', 'filesystem', 'memory', 'disk'][index],
    status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
    details: check.status === 'fulfilled' ? check.value : check.reason
  }));
  
  const isHealthy = results.every(r => r.status === 'healthy');
  
  return Response.json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: results,
    uptime: process.uptime(),
    version: process.env.npm_package_version
  }, {
    status: isHealthy ? 200 : 503
  });
}
```

**메트릭 수집**:
```typescript
// app/lib/metrics.ts
export class MetricsCollector {
  private metrics: Map<string, MetricValue> = new Map();
  
  incrementCounter(name: string, value = 1, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    const current = this.metrics.get(key) || { value: 0, type: 'counter' };
    
    this.metrics.set(key, {
      ...current,
      value: current.value + value,
      timestamp: Date.now()
    });
  }
  
  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.buildKey(name, tags);
    
    this.metrics.set(key, {
      value,
      type: 'gauge',
      timestamp: Date.now()
    });
  }
  
  getMetrics(): Record<string, MetricValue> {
    return Object.fromEntries(this.metrics);
  }
}
```

**사용 예시**:
```typescript
// 미들웨어에서 메트릭 수집
export function metricsMiddleware(metrics: MetricsCollector) {
  return (request: Request) => {
    const start = Date.now();
    
    return {
      onComplete: (response: Response) => {
        const duration = Date.now() - start;
        
        metrics.incrementCounter('http_requests_total', 1, {
          method: request.method,
          status: response.status.toString()
        });
        
        metrics.recordGauge('http_request_duration_ms', duration, {
          method: request.method
        });
      }
    };
  };
}
```

**시스템 리소스 모니터링**:
```typescript
// app/services/SystemMonitorService.ts
export class SystemMonitorService {
  async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform
    };
  }
  
  async getDiskUsage(): Promise<DiskUsage> {
    const stats = await fs.stat(process.cwd());
    const free = await this.getFreeDiskSpace();
    
    return {
      total: stats.size,
      free,
      used: stats.size - free,
      usagePercent: ((stats.size - free) / stats.size) * 100
    };
  }
}
```

**예상 시간**: 2-3시간  
**위험도**: 없음

---

## 구현 가이드라인

### 코딩 표준

#### TypeScript 활용
- 모든 공개 인터페이스에 명시적 타입 정의
- `any` 타입 사용 금지, `unknown` 활용
- Strict mode 유지

#### 에러 처리
- 모든 비동기 함수에서 적절한 에러 처리
- 비즈니스 에러와 시스템 에러 구분
- 구조화된 에러 정보 제공

#### 로깅
- 중요한 비즈니스 이벤트는 반드시 로그 기록
- 에러 발생 시 충분한 컨텍스트 정보 포함
- 개인정보는 로그에 포함하지 않음

### 테스트 전략

#### 단위 테스트
- 각 서비스 클래스는 90% 이상 테스트 커버리지
- Repository는 Mock 사용
- 비즈니스 로직 중심 테스트

#### 통합 테스트
- 중요한 API 엔드포인트는 반드시 통합 테스트
- 실제 파일 시스템 사용하지 않고 테스트
- 인증이 필요한 엔드포인트 테스트 포함

### 성능 가이드라인

#### 캐싱 전략
- 자주 조회되는 데이터는 적극적으로 캐싱
- 캐시 무효화 전략 명확히 정의
- 메모리 사용량 모니터링

#### 파일 I/O 최적화
- 대용량 파일 처리 시 스트림 사용
- 불필요한 파일 읽기 최소화
- 비동기 I/O 활용

## 리스크 분석 및 대응방안

### 고위험 항목

#### 1. Repository Pattern 도입 (Feature 5)
**위험**: 기존 데이터 접근 로직 전면 수정으로 인한 버그 발생 가능성

**대응방안**:
- 단계적 마이그레이션: 한 번에 하나의 엔티티씩 변환
- 기존 서비스와 새 Repository 병행 운영 기간 확보
- 철저한 테스트 커버리지 확보
- 롤백 계획 수립

#### 2. Service Layer 리팩토링 (Feature 6)
**위험**: 비즈니스 로직 변경 과정에서 기능 손실 가능성

**대응방안**:
- 기존 기능에 대한 회귀 테스트 작성
- 점진적 리팩토링으로 위험 분산
- 코드 리뷰 강화

### 중위험 항목

#### 3. API Validation (Feature 3)
**위험**: 기존 클라이언트와의 호환성 문제

**대응방안**:
- 점진적 검증 도입 (warning → error)
- API 버전 관리 고려
- 클라이언트 업데이트 계획 수립

#### 4. Error Handling 표준화 (Feature 4)
**위험**: 프론트엔드 에러 처리 로직 영향

**대응방안**:
- 기존 에러 응답 형식과 호환성 유지
- 단계적 마이그레이션
- 프론트엔드 팀과 협업

### 저위험 항목

#### 5. Configuration Management (Feature 1)
**위험**: 설정 변경으로 인한 런타임 에러

**대응방안**:
- 설정 검증 로직 추가
- 기본값 제공
- 환경별 테스트

## 성공 지표 및 측정 방법

### 기술적 지표

#### 코드 품질
- **테스트 커버리지**: 80% 이상 달성
- **타입 안전성**: TypeScript strict mode 유지
- **복잡도**: 순환 복잡도 10 이하 유지

#### 성능 지표
- **API 응답 시간**: 평균 200ms 이하 유지
- **메모리 사용량**: 현재 대비 20% 이하 증가
- **캐시 히트율**: 70% 이상 달성

#### 안정성 지표
- **에러율**: 1% 이하 유지
- **장애 복구 시간**: 기존 대비 50% 단축
- **로그 품질**: 구조화된 로그 100% 적용

### 개발자 경험 지표

#### 개발 생산성
- **새 기능 개발 시간**: 현재 대비 30% 단축 목표
- **버그 수정 시간**: 평균 시간 측정 및 개선
- **코드 리뷰 시간**: 효율성 향상

#### 유지보수성
- **코드 중복도**: 10% 이하 유지
- **의존성 결합도**: 명확한 인터페이스 분리
- **문서화 수준**: 모든 공개 API 문서화

### 운영 지표

#### 모니터링
- **시스템 가시성**: Health check 엔드포인트 100% 가용성
- **메트릭 수집**: 핵심 지표 실시간 모니터링
- **알림 체계**: 중요 이벤트 자동 알림

#### 확장성
- **DB 마이그레이션 준비도**: Repository 추상화 완료
- **캐싱 효율성**: 응답 시간 개선 정도
- **부하 처리**: 동시 사용자 처리 능력

## 결론

본 백엔드 아키텍처 개선 계획은 Local Streamer 프로젝트의 현재 단순함을 유지하면서도 확장성과 유지보수성을 크게 향상시킬 것입니다.

### 핵심 성과 예상
1. **확장성**: Repository 패턴으로 DB 전환 준비 완료
2. **안정성**: 중앙화된 에러 처리 및 로깅으로 안정성 향상
3. **개발 효율성**: 타입 안전성과 테스트 커버리지 확보
4. **운영 가시성**: 모니터링 및 Health check 도입

### 다음 단계
Phase 1 완료 후에는 다음 사항들을 고려할 수 있습니다:
- SQLite/PostgreSQL 마이그레이션
- Redis 캐싱 도입
- 마이크로서비스 아키텍처 검토
- API 버전 관리 도입

이 계획을 통해 Local Streamer는 개인 프로젝트에서 프로덕션 수준의 애플리케이션으로 성장할 수 있는 견고한 기반을 마련하게 될 것입니다.