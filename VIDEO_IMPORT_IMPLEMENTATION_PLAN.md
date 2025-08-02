# 동영상 파일 라이브러리 편입 기능 구현 계획

## 🎯 프로젝트 목표

사용자가 로컬 폴더에 동영상 파일을 넣고, 웹 UI에서 메타데이터(제목, 태그)를 설정하여 라이브러리에 편입시키는 핵심 기능 구현

## 📋 현재 단계에서 구현할 기능

### 1. 폴더 구조 설정
- [x] `incoming/` 폴더 생성 (프로젝트 루트)
- [x] `.gitignore`에 `/incoming/` 추가
- [x] 기존 `data/videos/` 폴더를 최종 저장소로 활용

### 2. API 엔드포인트 개발
- [x] **`/api/scan-incoming`** 
  - 준비 폴더의 새 동영상 파일들을 스캔
  - 파일 정보(이름, 크기, 확장자) 반환
  - 비디오 파일만 필터링 (.mp4, .avi, .mkv, .mov 등)

- [x] **`/api/add-to-library`**
  - POST 요청으로 메타데이터와 파일명 받음
  - UUID 생성하여 파일명 변경
  - `incoming/` → `data/videos/{uuid}/` 이동
  - `videos.json`에 메타데이터 저장
  - 원본 파일 정리

### 3. UI/UX 구현
- [x] **새 페이지**: `/add-videos` 라우트 생성
- [x] **네비게이션**: NavBar에 "동영상 추가" 링크 추가
- [x] **컴포넌트들** (shadcn/ui 기반):
  - `PendingVideoList` - 준비 중인 동영상 목록
  - `VideoImportCard` - 개별 동영상 정보 및 입력 폼
  - 기존 shadcn 컴포넌트 활용: Button, Input, Label, Card, Badge

### 4. 파일 처리 서비스
- [x] **`services/file-manager.server.ts`**
  - 파일 스캔 로직
  - 파일 이동 로직
  - UUID 생성 및 파일명 변경
  - 디렉토리 생성 관리

### 5. 타입 정의 확장
- [x] 기존 `PendingVideo` 타입 활용/수정
- [x] 필요시 새로운 타입 추가

## 🗂️ 구현할 파일 목록

### 새로 생성할 파일
1. `routes/add-videos.tsx` - 동영상 추가 페이지
2. `routes/api.scan-incoming.ts` - 파일 스캔 API
3. `routes/api.add-to-library.ts` - 라이브러리 추가 API  
4. `services/file-manager.server.ts` - 파일 관리 유틸리티
5. `components/VideoImportCard.tsx` - 동영상 가져오기 카드
6. `components/PendingVideoList.tsx` - 대기 중인 동영상 목록

### 수정할 파일
1. `.gitignore` - incoming 폴더 추가
2. `app/routes.ts` - 새 라우트 등록
3. `components/NavBar.tsx` - 네비게이션 링크 추가
4. `app/types/video.ts` - 필요시 타입 확장

## 🔄 사용자 플로우

1. **파일 준비**: 사용자가 `incoming/` 폴더에 동영상 파일 복사
2. **페이지 접근**: NavBar의 "동영상 추가" 링크를 통해 `/add-videos` 페이지 방문
3. **파일 감지**: 페이지 로드/새로고침 시 자동으로 새 파일들 스캔
4. **메타데이터 입력**: 각 동영상의 제목과 태그 입력
5. **라이브러리 추가**: "라이브러리에 추가" 버튼 클릭으로 개별 또는 일괄 처리
6. **파일 이동**: 파일이 UUID로 이름 변경되어 `data/videos/{uuid}/` 으로 이동
7. **확인**: 홈 페이지에서 새로 추가된 동영상 확인

## 🎨 UI 설계 방침

### shadcn/ui 컴포넌트 활용
- **Card**: 개별 동영상 정보 표시
- **Input & Label**: 제목/태그 입력 폼
- **Button**: 액션 버튼들
- **Badge**: 파일 형식, 크기 표시
- **Alert**: 성공/오류 메시지
- **Separator**: 섹션 구분

### 레이아웃
- 반응형 그리드 레이아웃
- 카드 기반 정보 표시
- YouTube 스타일 일관성 유지

## 📦 기술적 구현 세부사항

### 파일 처리
```typescript
// 지원 동영상 포맷
const SUPPORTED_FORMATS = ['.mp4', '.avi', '.mkv', '.mov', '.webm', '.m4v'];

// 파일 이동 경로
incoming/{filename} → data/videos/{uuid}/{uuid}.{ext}
```

### API 응답 형식
```typescript
// GET /api/scan-incoming
{
  files: PendingVideo[]
}

// POST /api/add-to-library
{
  success: boolean,
  videoId?: string,
  error?: string
}
```

## 🚫 현재 단계에서 제외하는 기능

### 1. 썸네일 생성
- **이유**: 복잡도 증가, FFmpeg 의존성 추가
- **대안**: 기본 비디오 아이콘 또는 placeholder 이미지 사용
- **향후 계획**: 2단계에서 FFmpeg 기반 썸네일 추출 구현

### 2. HLS 변환
- **이유**: 파일 처리 시간 증가, 복잡한 에러 처리 필요
- **대안**: 기존 MP4 직접 스트리밍 방식 유지
- **향후 계획**: 라이브러리 편입 후 백그라운드에서 HLS 변환 옵션 제공

### 3. 파일 유효성 검증
- **이유**: 핵심 기능 집중
- **대안**: 확장자 기반 간단한 필터링만 적용
- **향후 계획**: FFprobe를 활용한 실제 비디오 파일 검증

### 4. 진행률 표시
- **이유**: 현재 단계에서는 동기 처리로 충분
- **향후 계획**: 대용량 파일 처리 시 WebSocket 기반 진행률 표시

## 📅 구현 순서

1. **Phase 1**: 폴더 설정 및 기본 구조
2. **Phase 2**: API 엔드포인트 구현
3. **Phase 3**: UI 컴포넌트 및 페이지 구현
4. **Phase 4**: 통합 테스트 및 UX 개선

## 🎯 성공 기준

- [x] 사용자가 incoming 폴더에 동영상 파일을 넣을 수 있다
- [x] 웹 UI에서 새 파일들을 확인할 수 있다
- [x] 제목과 태그를 입력하여 라이브러리에 추가할 수 있다
- [x] 파일이 UUID로 변경되어 적절한 위치로 이동된다
- [x] 홈 페이지에서 새로 추가된 동영상을 확인할 수 있다
- [x] 전체 과정이 직관적이고 에러 없이 동작한다

---

**구현 시작일**: 2025-08-02  
**예상 완료일**: 2025-08-02 (1일 작업)  
**담당자**: Claude Code