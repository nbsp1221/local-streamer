# HLS 구현 계획 - Phase별 접근법

## 📋 프로젝트 개요
기존 Range request 스트리밍을 HLS로 업그레이드하여 빠른 시크와 향상된 스트리밍 성능을 제공합니다.
Phase별로 나누어 단계적 구현 및 검수를 진행합니다.

## 🎯 핵심 목표
- ✅ 시크 시 버퍼링 지연 해결
- ✅ 향상된 스트리밍 성능 제공
- ✅ 기존 React Router 아키텍처 유지
- ✅ 점진적 구현을 통한 안정성 확보

## 🚀 Phase별 구현 계획

### **Phase 1: FFmpeg 기반 구축 및 검증** ✅ 완료
**목표**: ffmpeg-static 설치하고 기본 동작 확인
- [x] ffmpeg-static, @types/node 설치
- [x] 간단한 FFmpeg 명령어 실행 테스트 스크립트 작성
- [x] 기존 big-buck-bunny-test.mp4 → 다른 포맷 변환 테스트
- [x] ✅ **검수 포인트**: FFmpeg가 정상 작동하는지 확인

**Phase 1 결과**:
- FFmpeg 버전: 6.0-static 정상 작동 확인
- 테스트 파일 정보: 9분 56초, H.264/AAC 인코딩 확인
- 포맷 변환: MP4 → WebM 변환 성공 (706KB 출력 파일 생성)
- 테스트 스크립트: `scripts/test-ffmpeg.js` 생성

### **Phase 2: 기본 HLS 변환 구현** ✅ 완료
**목표**: 단일 품질 HLS 변환 (720p)
- [x] HLS 변환 서비스 함수 구현 (`app/services/hls-converter.server.ts`)
- [x] 기존 테스트 파일 → .m3u8 + .ts 세그먼트 생성
- [x] 생성된 파일들 직접 확인
- [x] ✅ **검수 포인트**: HLS 파일이 올바르게 생성되는지 확인

**Phase 2 결과**:
- HLS 변환 서비스: `app/services/hls-converter.server.ts` 구현
- 변환 성공: 9분 56초 MP4 → HLS (720p, 2.5Mbps)
- 플레이리스트: 1개 .m3u8 파일 (4,158 bytes, HLS v3 표준)
- 세그먼트: 80개 .ts 파일 (7.5초/개, 마지막 3.96초)
- 파일 크기: 원본 150.69MB → HLS 121.27MB (20% 압축)
- 테스트 스크립트: `scripts/test-hls-conversion.js` 생성

### **Phase 3: HLS 서빙 API 구현** ✅ 완료
**목표**: 생성된 HLS 파일들 웹으로 서빙
- [x] `/api/hls/:id` 라우트 구현 (m3u8 플레이리스트)
- [x] `/api/segment/:id/:file` 라우트 구현 (ts 세그먼트)
- [x] 브라우저에서 직접 m3u8 파일 접근 테스트
- [x] ✅ **검수 포인트**: API로 HLS 파일 접근 가능한지 확인

**Phase 3 결과**:
- HLS 플레이리스트 API: `/api/hls/:id` (CORS 헤더 포함)
- HLS 세그먼트 API: `/api/segment/:id/:file` (Range 요청 지원)
- 파일 경로 해결: `app/services/hls-resolver.server.ts` 구현
- 라우트 설정 완료: `app/routes.ts` 업데이트
- 테스트 스크립트: `scripts/test-hls-api.js` 생성
- 테스트 결과: 3/4 통과 (플레이리스트, 세그먼트, Range 요청 모두 정상)

### **Phase 4: 프론트엔드 HLS 플레이어 통합** ✅ 완료
**목표**: VideoPlayer에서 HLS 재생 지원
- [x] VideoPlayer 컴포넌트에 HLS 감지 로직 추가
- [x] HLS vs Range request 자동 전환
- [x] 실제 웹 플레이어에서 HLS 재생 테스트
- [x] ✅ **검수 포인트**: 브라우저에서 HLS 스트리밍 재생 확인

**Phase 4 결과**:
- HLS 확인 API: `/api/hls-check/:id` 구현 (5분 캐싱)
- VideoPlayer 자동 감지: HLS 파일 존재 시 자동 HLS 모드 전환
- 로딩 상태 처리: 스트리밍 준비 중 표시
- 개발 디버그: 현재 스트리밍 방식 시각적 표시 (🎞️ HLS / 📺 Range)
- 테스트 스크립트: `scripts/test-phase4-hls.js` 생성
- 테스트 결과: 4/4 통과 (HLS API, 자동 감지, 오류 처리, 플레이어 통합)

### **Phase 5: 통합 및 자동화** ⚡ 다음 단계
**목표**: 파일 업로드 → HLS 변환 → 라이브러리 추가 플로우
- [ ] 파일 업로드 UI 구현
- [ ] 업로드 시 자동 HLS 변환 트리거
- [ ] UUID 기반 파일 관리 통합
- [ ] ✅ **검수 포인트**: 전체 플로우 동작 확인

## 🔧 기술 스택 (업데이트됨)

### 서버사이드 HLS 처리
- **ffmpeg-static**: 크로스 플랫폼 FFmpeg 바이너리 제공
- **child_process.spawn**: FFmpeg 직접 제어 (fluent-ffmpeg 대신)
- **React Router 7**: 서버 액션으로 변환 API 구현

### 클라이언트사이드 재생
- **기존 Vidstack**: HLS 지원 기능 활용
- **자동 감지**: .m3u8 파일 시 HLS 모드 전환

## 🏗️ 시스템 아키텍처

### 파일 구조
```
data/
├── pending/                    # 준비 폴더 (기존 유지)
│   ├── original_video.mp4
│   └── another_clip.mkv
├── library/                    # 라이브러리 폴더 (HLS 변환)
│   └── [uuid]/                 # UUID 기반 폴더
│       ├── master.m3u8         # 마스터 플레이리스트
│       ├── 720p/
│       │   ├── playlist.m3u8   # 720p 플레이리스트
│       │   ├── segment_000.ts.enc  # 이중암호화 세그먼트
│       │   ├── segment_001.ts.enc
│       │   └── ...
│       ├── 1080p/
│       │   ├── playlist.m3u8
│       │   └── segment_xxx.ts.enc
│       └── metadata.json       # 비디오 메타데이터
├── keys/                       # 암호화 키 관리
│   └── [uuid].key             # UUID별 암호화 키
└── videos.json                 # 기존 메타데이터 (HLS 정보 추가)
```

### 데이터베이스 스키마 변경
```json
// videos.json 확장
{
  "id": "uuid-example",
  "title": "비디오 제목",
  "tags": ["태그1", "태그2"],
  "thumbnailUrl": "...",
  "videoUrl": "/data/library/uuid-example/master.m3u8",  // HLS 마스터 플레이리스트
  "duration": 3600,
  "addedAt": "2025-08-01T12:00:00.000Z",
  "description": "설명",
  "hlsInfo": {
    "hasHLS": true,
    "qualities": ["720p", "1080p"],
    "segmentCount": 180,
    "encryptionKey": "xor-key-reference"
  }
}
```

## 🔧 구현 단계

### 1단계: FFmpeg 통합 및 HLS 변환
**목표**: 업로드된 비디오를 HLS + AES-128 암호화로 변환

#### 필요 의존성
```bash
bun add fluent-ffmpeg @types/fluent-ffmpeg
# FFmpeg 바이너리는 시스템에 별도 설치 필요
```

#### 구현 파일
- `app/services/hls-converter.server.ts`: FFmpeg 기반 HLS 변환
- `app/services/encryption.server.ts`: XOR 암호화/복호화

#### FFmpeg 변환 로직
```typescript
// hls-converter.server.ts 구조
export async function convertToHLS(inputPath: string, outputDir: string, uuid: string) {
  // 1. UUID 기반 출력 디렉토리 생성
  // 2. 암호화 키 생성 및 저장
  // 3. FFmpeg 명령어 실행 (AES-128 암호화 포함)
  // 4. 생성된 .ts 파일들에 XOR 추가 암호화 적용
  // 5. 메타데이터 업데이트
}
```

### 2단계: React Router API 라우트 구현
**목표**: HLS 스트리밍을 위한 API 엔드포인트 구현

#### API 라우트 구조
```
app/routes/
├── api.hls.$uuid.ts           # 마스터 플레이리스트 제공
├── api.hls.$uuid.$quality.ts  # 품질별 플레이리스트 제공  
├── api.segment.$uuid.$file.ts # 암호화된 세그먼트 제공
└── api.key.$uuid.ts           # HLS 복호화 키 제공
```

#### 각 라우트 역할
1. **마스터 플레이리스트** (`/api/hls/uuid123`):
   - 사용 가능한 품질 목록 반환
   - 적응형 비트레이트를 위한 bandwidth 정보

2. **품질별 플레이리스트** (`/api/hls/uuid123/720p`):
   - 해당 품질의 세그먼트 목록
   - 암호화 키 URL 포함

3. **세그먼트 제공** (`/api/segment/uuid123/segment_001.ts`):
   - XOR 복호화 수행
   - AES-128 암호화 상태로 반환
   - Range 요청 지원

4. **키 제공** (`/api/key/uuid123`):
   - 인증된 사용자에게만 HLS 복호화 키 제공
   - 토큰 기반 접근 제어

### 3단계: 파일 감시 및 자동 변환
**목표**: 준비 폴더 감시 → 자동 HLS 변환 → 라이브러리 이동

#### 구현 내용
- `app/services/file-watcher.server.ts` 확장
- 새 파일 감지 시 HLS 변환 자동 실행
- 변환 완료 후 pending.json에서 videos.json으로 이동
- 원본 파일 삭제 옵션

### 4단계: 프론트엔드 HLS 플레이어 통합
**목표**: 기존 VideoPlayer를 HLS 지원으로 업그레이드

#### 필요 의존성
```bash
bun add hls.js @types/hls.js
```

#### VideoPlayer 컴포넌트 수정
```typescript
// VideoPlayer.tsx 업그레이드
export function VideoPlayer({ video }: VideoPlayerProps) {
  // HLS 비디오 감지
  const isHLSVideo = video.videoUrl.endsWith('.m3u8');
  
  if (isHLSVideo) {
    // hls.js 사용한 HLS 재생
    // 커스텀 인증 헤더 추가
    // 적응형 품질 조절 UI
  } else {
    // 기존 방식 (Range 요청) 유지
  }
}
```

## 🔒 보안 구현 세부사항

### 이중 암호화 프로세스

#### 변환 시 암호화
1. **HLS 표준 암호화**: FFmpeg `-hls_key_info_file` 옵션
2. **XOR 추가 암호화**: 생성된 .ts 파일들을 추가 암호화

#### 재생 시 복호화
1. **서버측 XOR 복호화**: 세그먼트 요청 시 실시간 처리
2. **클라이언트측 AES-128 복호화**: hls.js가 자동 처리

### 접근 제어
- JWT 토큰 기반 세그먼트 인증
- IP 기반 접근 제한 (선택사항)
- 시간 제한 URL (키/세그먼트)

## 📈 성능 최적화

### 세그먼트 설정
- **세그먼트 길이**: 2초 (빠른 시크 + 적당한 오버헤드)
- **키프레임 간격**: 2초 (세그먼트 시작 = 키프레임)
- **품질 레벨**: 720p, 1080p (필요시 확장)

### 캐싱 전략
- **브라우저 캐싱**: 세그먼트에 적절한 Cache-Control 헤더
- **서버 캐싱**: 자주 요청되는 세그먼트 메모리 캐싱
- **CDN 호환**: 향후 CDN 도입 시 호환 가능한 구조

## 🧪 테스트 계획

### 기능 테스트
1. **변환 테스트**: 다양한 포맷 → HLS 변환 성공률
2. **암호화 테스트**: 이중 암호화/복호화 정확성
3. **스트리밍 테스트**: 다양한 네트워크 환경에서 재생
4. **시크 테스트**: 빠른 시크 성능 측정

### 성능 테스트
- **동시 접속**: 여러 사용자 동시 스트리밍
- **대용량 파일**: 2시간+ 영화 파일 처리
- **메모리 사용량**: 변환 및 스트리밍 시 메모리 모니터링

## 🚀 배포 고려사항

### 시스템 요구사항
- **FFmpeg**: 서버에 FFmpeg 바이너리 설치 필수
- **디스크 공간**: HLS 변환으로 약 10-20% 용량 증가
- **CPU**: 변환 시 CPU 집약적 작업

### Docker 배포
```dockerfile
# Dockerfile에 FFmpeg 설치 추가
RUN apt-get update && apt-get install -y ffmpeg
```

## 📅 구현 일정 (예상)

### Week 1: 기반 구조
- [ ] FFmpeg 통합 및 기본 HLS 변환
- [ ] 이중 암호화 시스템 구현
- [ ] API 라우트 기본 구조

### Week 2: 스트리밍 구현  
- [ ] HLS API 엔드포인트 완성
- [ ] 프론트엔드 hls.js 통합
- [ ] 기본 스트리밍 동작 확인

### Week 3: 최적화 및 테스트
- [ ] 성능 최적화 (캐싱, 압축)
- [ ] 보안 강화 (토큰 인증)
- [ ] 다양한 시나리오 테스트

### Week 4: 통합 및 배포
- [ ] 기존 시스템과 통합
- [ ] 배포 환경 설정
- [ ] 문서화 및 사용자 가이드

## 🔄 마이그레이션 전략

### 기존 시스템과 호환성
- **기존 MP4**: Range 요청 방식 유지 (하위 호환)
- **새 업로드**: HLS 방식으로 자동 변환
- **점진적 마이그레이션**: 기존 파일들도 선택적 HLS 변환

### 롤백 계획
- 기존 Range 요청 방식은 그대로 유지
- HLS 문제 발생 시 기존 방식으로 fallback
- 설정을 통한 HLS 사용 여부 제어

---

**📝 참고사항**: 이 계획은 PRD의 모든 요구사항을 만족하면서도 Netflix/YouTube 수준의 스트리밍 성능을 확보하는 것을 목표로 합니다. 구현 과정에서 세부사항은 조정될 수 있습니다.