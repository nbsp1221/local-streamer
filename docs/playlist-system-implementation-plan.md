# Playlist System Implementation Plan

## 📋 Overview

This document outlines the comprehensive implementation plan for adding a unified playlist system to Local Streamer. The playlist system will handle both user-created playlists and series/episode management using a single, flexible architecture.

## 🏗️ Architecture Analysis

### Current System Structure

**Existing Module Pattern:**
- Uses Clean Architecture with UseCase pattern
- Port/Adapter (Hexagonal) architecture
- Domain-driven module organization
- JSON-based repositories with write queues

**Current Modules:**
```
app/modules/
├── auth/           # Authentication domain
├── video/          # Video management domain
├── thumbnail/      # Thumbnail processing domain
```

### Design Principles

Based on DDD Hexagonal Architecture best practices:

1. **Domain Separation**: Each module represents a bounded context
2. **Port/Adapter Pattern**: Abstract infrastructure concerns
3. **UseCase-Driven**: Business logic in dedicated use cases
4. **Repository Pattern**: Abstract data persistence
5. **Vertical Slicing**: Complete feature ownership per module

## 🎯 Implementation Phases

---

## Phase 1: Core Playlist Domain (Weeks 1-2)

### 🎯 Objectives
- Establish playlist domain module
- Implement core CRUD operations
- Create foundational data structures
- Set up repository layer

### 📁 File Structure

```
app/modules/playlist/
├── domain/
│   ├── playlist.entity.ts
│   ├── playlist.errors.ts
│   └── playlist.types.ts
├── application/
│   └── ports/
│       ├── playlist-repository.port.ts
│       └── playlist-service.port.ts
├── commands/
│   ├── create-playlist/
│   │   ├── create-playlist.usecase.ts
│   │   ├── create-playlist.types.ts
│   │   └── create-playlist.usecase.test.ts
│   ├── update-playlist/
│   │   ├── update-playlist.usecase.ts
│   │   ├── update-playlist.types.ts
│   │   └── update-playlist.usecase.test.ts
│   ├── delete-playlist/
│   │   ├── delete-playlist.usecase.ts
│   │   ├── delete-playlist.types.ts
│   │   └── delete-playlist.usecase.test.ts
│   ├── add-video-to-playlist/
│   │   ├── add-video-to-playlist.usecase.ts
│   │   ├── add-video-to-playlist.types.ts
│   │   └── add-video-to-playlist.usecase.test.ts
│   └── reorder-playlist-items/
│       ├── reorder-playlist-items.usecase.ts
│       ├── reorder-playlist-items.types.ts
│       └── reorder-playlist-items.usecase.test.ts
├── queries/
│   ├── find-playlists/
│   │   ├── find-playlists.usecase.ts
│   │   ├── find-playlists.types.ts
│   │   └── find-playlists.usecase.test.ts
│   └── get-playlist-details/
│       ├── get-playlist-details.usecase.ts
│       ├── get-playlist-details.types.ts
│       └── get-playlist-details.usecase.test.ts
└── infrastructure/
    └── adapters/
        └── json-playlist.repository.ts
```

### 🏗️ Domain Model

```typescript
// app/modules/playlist/domain/playlist.types.ts
export interface Playlist {
  id: string;
  name: string;
  description?: string;
  type: PlaylistType;
  videoIds: string[];           // Ordered array of video IDs
  thumbnailUrl?: string;
  ownerId: string;             // User who created the playlist
  isPublic: boolean;           // Public/private visibility
  createdAt: Date;
  updatedAt: Date;

  // Extended metadata for series/seasons
  metadata?: PlaylistMetadata;
}

export type PlaylistType =
  | 'user_created'     // User-made playlist
  | 'series'           // TV series/anime
  | 'season'           // Season within a series
  | 'auto_generated';  // Auto-created (e.g., from tags)

export interface PlaylistMetadata {
  seriesName?: string;          // "Attack on Titan"
  seasonNumber?: number;        // 1, 2, 3...
  episodeCount?: number;        // Total episodes in playlist
  genre?: string[];             // ["anime", "action"]
  year?: number;                // Production year
  status?: 'ongoing' | 'completed' | 'hiatus';
  parentPlaylistId?: string;    // For seasons pointing to main series
}

export interface PlaylistItem {
  videoId: string;
  position: number;             // 1-based position in playlist
  addedAt: Date;
  addedBy: string;              // User who added this item

  // Episode-specific metadata
  episodeMetadata?: {
    episodeNumber?: number;     // 1, 2, 3...
    episodeTitle?: string;      // "The Fall of Shiganshina"
    watchProgress?: number;     // 0-1, watching progress
  };
}
```

### 🏗️ Use Cases

**Create Playlist UseCase:**
```typescript
export interface CreatePlaylistRequest {
  name: string;
  description?: string;
  type: PlaylistType;
  isPublic?: boolean;
  metadata?: PlaylistMetadata;
  initialVideoIds?: string[];
}

export interface CreatePlaylistResponse {
  playlistId: string;
  message: string;
}

export interface CreatePlaylistDependencies {
  playlistRepository: PlaylistRepositoryPort;
  userRepository: UserRepositoryPort;
  videoRepository: VideoRepositoryPort;
  logger?: Logger;
}
```

### 🗄️ Repository Layer

```typescript
// app/modules/playlist/application/ports/playlist-repository.port.ts
export interface PlaylistRepositoryPort {
  findAll(filters?: PlaylistFilters): Promise<Playlist[]>;
  findById(id: string): Promise<Playlist | null>;
  findByUserId(userId: string): Promise<Playlist[]>;
  findByType(type: PlaylistType): Promise<Playlist[]>;
  findBySeries(seriesName: string): Promise<Playlist[]>;

  create(playlist: Omit<Playlist, 'id' | 'createdAt' | 'updatedAt'>): Promise<Playlist>;
  update(id: string, updates: Partial<Playlist>): Promise<Playlist>;
  delete(id: string): Promise<void>;

  addVideoToPlaylist(playlistId: string, videoId: string, position?: number): Promise<void>;
  removeVideoFromPlaylist(playlistId: string, videoId: string): Promise<void>;
  reorderPlaylistItems(playlistId: string, newOrder: string[]): Promise<void>;

  // Analytics queries
  getMostPopularPlaylists(limit: number): Promise<Playlist[]>;
  getRecentlyCreatedPlaylists(limit: number): Promise<Playlist[]>;
}

export interface PlaylistFilters {
  type?: PlaylistType;
  ownerId?: string;
  isPublic?: boolean;
  genre?: string[];
  searchQuery?: string;
}
```

### 🧪 Testing Strategy

**Unit Tests per UseCase:**
- Positive scenarios (happy path)
- Validation errors
- Business rule violations
- Integration with repositories

**Repository Tests:**
- CRUD operations
- Filtering and querying
- Concurrent access scenarios
- Data integrity checks

### 📊 Data Migration

```typescript
// scripts/migrate-existing-data-to-playlists.ts
export interface MigrationPlan {
  1. analyzeExistingTags();      // Find series patterns in tags
  2. createAutoPlaylists();      // Generate playlists from tag patterns
  3. preserveUserPreferences();  // Maintain existing user settings
  4. validateDataIntegrity();    // Ensure no data loss
}
```

### ✅ Phase 1 Deliverables

- [ ] Complete playlist domain module
- [ ] All core use cases implemented and tested
- [ ] JSON repository with atomic operations
- [ ] Domain entity with business rules
- [ ] Comprehensive unit test suite (>90% coverage)
- [ ] Data migration scripts
- [ ] API integration points prepared

---

## Phase 2: API Integration & Basic UI (Weeks 3-4)

### 🎯 Objectives
- Implement RESTful API endpoints
- Create basic UI components
- Integrate with existing video system
- Add playlist management to current UI

### 🔌 API Design

Following REST best practices and YouTube API patterns:

```typescript
// API Routes (add to app/routes.ts)
route('api/playlists', 'routes/api/playlists/index.ts'),
route('api/playlists/:id', 'routes/api/playlists/$id.ts'),
route('api/playlists/:id/items', 'routes/api/playlists/$id.items.ts'),
route('api/playlists/:id/reorder', 'routes/api/playlists/$id.reorder.ts'),

// UI Routes
route('playlists', 'routes/playlists/index.tsx'),
route('playlists/:id', 'routes/playlists/$id.tsx'),
route('playlists/create', 'routes/playlists/create.tsx'),
```

**API Endpoint Specifications:**

```
GET    /api/playlists                  # List user playlists (with pagination)
POST   /api/playlists                  # Create new playlist
GET    /api/playlists/:id              # Get playlist details
PUT    /api/playlists/:id              # Update playlist metadata
DELETE /api/playlists/:id              # Delete playlist

GET    /api/playlists/:id/items        # Get playlist videos (paginated)
POST   /api/playlists/:id/items        # Add video to playlist
DELETE /api/playlists/:id/items/:videoId  # Remove video from playlist
POST   /api/playlists/:id/reorder      # Batch reorder playlist items
```

### 🎨 UI Components

**New Components:**
```
app/components/playlist/
├── PlaylistCard.tsx              # Playlist thumbnail card
├── PlaylistGrid.tsx              # Grid of playlists
├── PlaylistDetails.tsx           # Detailed playlist view
├── CreatePlaylistModal.tsx       # Playlist creation form
├── EditPlaylistModal.tsx         # Playlist editing form
├── PlaylistItemList.tsx          # Draggable list of videos
├── AddToPlaylistDropdown.tsx     # Add video to playlist selector
└── PlaylistTypeSelector.tsx      # Series vs user playlist toggle
```

**Enhanced Components:**
- `VideoCard.tsx` → Add "Add to Playlist" button
- `VideoModal.tsx` → Add playlist management options
- `AppSidebar.tsx` → Add playlists navigation section
- `RelatedVideos.tsx` → Show playlist context

### 📱 UI Pages

```typescript
// app/routes/playlists/index.tsx - Playlist Library
export default function PlaylistsIndex() {
  const { playlists, loading } = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <PlaylistGrid playlists={playlists} />
      <CreatePlaylistButton />
    </AppLayout>
  );
}

// app/routes/playlists/$id.tsx - Playlist Details
export default function PlaylistDetails() {
  const { playlist, videos } = useLoaderData<typeof loader>();

  return (
    <AppLayout>
      <PlaylistHeader playlist={playlist} />
      <PlaylistItemList items={videos} onReorder={handleReorder} />
    </AppLayout>
  );
}
```

### 🔗 Integration Points

**Video System Integration:**
- Modify `VideoCard` to show playlist membership
- Add bulk operations for multiple videos
- Update `RelatedVideos` to prioritize playlist context

**Navigation Updates:**
- Add "Playlists" to main navigation
- Show playlist count in sidebar
- Add playlist creation shortcuts

### ✅ Phase 2 Deliverables

- [ ] Complete RESTful API with proper error handling
- [ ] Basic UI for playlist management
- [ ] Integration with existing video components
- [ ] Playlist creation and editing workflows
- [ ] Video-to-playlist assignment UI
- [ ] Responsive design for mobile/desktop
- [ ] API documentation

---

## Phase 3: Advanced Features & Series Intelligence (Weeks 5-6)

### 🎯 Objectives
- Implement series auto-detection
- Add continuous playback features
- Create smart playlist recommendations
- Add advanced management tools

### 🤖 Series Auto-Detection

```typescript
// app/modules/playlist/services/series-detection/
├── series-detection.service.ts
├── filename-analyzer.ts
├── metadata-extractor.ts
└── series-matcher.ts

export interface SeriesDetectionService {
  analyzeVideoCollection(videos: Video[]): Promise<SeriesCandidate[]>;
  suggestPlaylistCreation(candidates: SeriesCandidate[]): Promise<PlaylistSuggestion[]>;
  autoCreatePlaylists(suggestions: PlaylistSuggestion[]): Promise<Playlist[]>;
}

export interface SeriesCandidate {
  seriesName: string;
  episodes: Array<{
    videoId: string;
    episodeNumber: number;
    confidence: number;        // 0-1 confidence score
  }>;
  confidence: number;
  metadata: {
    year?: number;
    genre?: string[];
    totalEpisodes?: number;
  };
}
```

### 🎬 Continuous Playback

```typescript
// app/components/player/ContinuousPlayback.tsx
export interface ContinuousPlaybackProps {
  playlist: Playlist;
  currentVideoId: string;
  onNextEpisode: (nextVideoId: string) => void;
  onPreviousEpisode: (prevVideoId: string) => void;
}

// Features:
// - Auto-play next episode after completion
// - Skip intro/outro functionality
// - Resume from last watched position
// - Binge-watching mode with minimal UI
```

### 🎭 Smart Recommendations

```typescript
// app/modules/playlist/services/recommendation/
export interface PlaylistRecommendationService {
  suggestSimilarPlaylists(playlistId: string): Promise<Playlist[]>;
  recommendNextWatch(userId: string): Promise<Playlist[]>;
  findPlaylistsToComplete(userId: string): Promise<Playlist[]>;
  suggestPlaylistMerge(playlistIds: string[]): Promise<MergeRecommendation>;
}
```

### 📊 Analytics & Insights

```typescript
// app/modules/playlist/analytics/
export interface PlaylistAnalytics {
  getPlaylistStats(playlistId: string): Promise<PlaylistStats>;
  getUserPlaylistHabits(userId: string): Promise<UserPlaylistHabits>;
  getPopularSeriesReports(): Promise<SeriesPopularityReport[]>;
}

export interface PlaylistStats {
  totalWatchTime: number;       // Total minutes
  completionRate: number;       // 0-1
  averageEpisodeRating: number; // If rating system added later
  viewerRetention: number;      // How many finish the series
}
```

### 🛠️ Advanced Management Tools

**Bulk Operations:**
- Bulk playlist creation from folders
- Batch metadata editing
- Playlist merging and splitting
- Import/export functionality

**Series Management:**
- Season grouping UI
- Episode ordering tools
- Missing episode detection
- Multi-language/version management

### ✅ Phase 3 Deliverables

- [ ] Series auto-detection system
- [ ] Continuous playback functionality
- [ ] Smart playlist recommendations
- [ ] Advanced playlist management tools
- [ ] Analytics dashboard
- [ ] Bulk operations interface
- [ ] Import/export capabilities

---

## 📋 Technical Specifications

### 🗄️ Database Schema

**JSON File Structure:**
```
storage/data/
├── playlists.json              # Main playlist data
├── playlist-items.json         # Video-playlist relationships
├── playlist-analytics.json     # Usage statistics
└── playlist-migrations.json    # Migration tracking
```

### 🔒 Security Considerations

**Access Control:**
- Playlist ownership validation
- Public/private playlist enforcement
- Bulk operation permission checks
- Rate limiting for API endpoints

**Data Protection:**
- Input sanitization for all playlist data
- SQL injection prevention (even with JSON)
- XSS protection in UI components
- Audit logging for sensitive operations

### 🚀 Performance Optimizations

**Caching Strategy:**
- In-memory caching for frequently accessed playlists
- Pagination for large playlists (>100 items)
- Lazy loading for playlist thumbnails
- Debounced search queries

**Database Optimizations:**
- Indexed queries for common lookups
- Batch operations for bulk updates
- Atomic transactions for consistency
- Background processing for heavy operations

### 🧪 Quality Assurance

**Testing Strategy:**
- **Unit Tests**: >90% coverage for all use cases
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Critical user workflows
- **Performance Tests**: Load testing with large playlists

**Code Quality:**
- TypeScript strict mode
- ESLint configuration compliance
- Automated dependency updates
- Security vulnerability scanning

---

## 📅 Implementation Timeline

### Week 1-2: Phase 1 (Foundation)
- **Days 1-3**: Domain model and core entities
- **Days 4-7**: Use cases implementation
- **Days 8-10**: Repository layer and testing
- **Days 11-14**: Data migration and validation

### Week 3-4: Phase 2 (Integration)
- **Days 15-18**: API endpoints implementation
- **Days 19-22**: Basic UI components
- **Days 23-26**: Integration with existing system
- **Days 27-28**: Testing and bug fixes

### Week 5-6: Phase 3 (Advanced Features)
- **Days 29-32**: Series auto-detection
- **Days 33-36**: Continuous playback
- **Days 37-40**: Analytics and recommendations
- **Days 41-42**: Final testing and optimization

---

## 🎯 Success Metrics

### Technical Metrics
- [ ] API response time < 200ms for playlist operations
- [ ] UI rendering time < 100ms for playlist views
- [ ] Test coverage > 90% across all modules
- [ ] Zero data loss during migration
- [ ] Memory usage increase < 10% vs baseline

### User Experience Metrics
- [ ] Playlist creation time < 30 seconds
- [ ] Video-to-playlist assignment < 5 clicks
- [ ] Series auto-detection accuracy > 85%
- [ ] User adoption rate > 60% within first month
- [ ] User satisfaction score > 4/5

---

## 🔄 Migration Strategy

### Existing Data Preservation
1. **Tag Analysis**: Identify series patterns in current tags
2. **Auto-Playlist Creation**: Generate playlists from detected patterns
3. **User Notification**: Inform users of auto-created playlists
4. **Rollback Plan**: Ability to revert to tag-only system

### Backward Compatibility
- Existing tag system remains functional
- Related videos logic preserved as fallback
- No breaking changes to existing APIs
- Gradual UI migration with feature flags

---

## 📚 Documentation Requirements

### Technical Documentation
- [ ] API reference documentation
- [ ] Component usage guidelines
- [ ] Database schema documentation
- [ ] Deployment and configuration guide

### User Documentation
- [ ] Playlist creation tutorial
- [ ] Series management guide
- [ ] Advanced features walkthrough
- [ ] FAQ and troubleshooting guide

---

## 🎉 Post-Implementation

### Future Enhancements (Phase 4+)
- **Social Features**: Playlist sharing and collaboration
- **Advanced Analytics**: Watch time heatmaps, user behavior
- **AI Recommendations**: Machine learning-based suggestions
- **Mobile App**: Dedicated playlist management app
- **Third-party Integrations**: Import from YouTube, Plex, etc.

### Maintenance Plan
- Regular performance monitoring
- User feedback collection and analysis
- Feature usage analytics
- Security audits and updates
- Dependency updates and patches

---

*This implementation plan provides a comprehensive roadmap for adding a world-class playlist system to Local Streamer while maintaining the existing high-quality architecture and user experience.*