# Playlist System Implementation Plan

Status: Historical planning note
Last reviewed: 2026-04-19
Superseded by:

- `docs/roadmap/current-refactor-status.md`
- `app/modules/playlist/*`
- `app/routes/playlists._index.tsx`
- `app/routes/playlists.$id.tsx`

Important note:

- this plan reflects an earlier playlist roadmap and should not be used as the current implementation status
- playlist listing, creation, detail routing, and active application ownership now exist in the live codebase
- ideas in the remainder of this file should be treated as optional future product work unless they are re-approved

## 📋 Current Status (Updated: 2025-09-20)

### ✅ **Phase 1 COMPLETED: MVP Foundation**
**Status: 100% Complete**

- ✅ Complete backend architecture (Clean Architecture + UseCase pattern)
- ✅ All API endpoints implemented and tested
  - `/api/playlists` (GET/POST) - List/Create playlists
  - `/api/playlists/:id` (GET/PUT/DELETE) - Manage individual playlists
  - `/api/playlists/:id/items` (POST/PUT/DELETE) - Video management
- ✅ Feature-based frontend architecture aligned with the FSD guidelines documented below
- ✅ Playlist listing page with server-side data loading
- ✅ Playlist creation functionality (React Hook Form + Zod validation)
- ✅ Authentication integration with cookie forwarding
- ✅ Unnecessary complexity removed (complex Zustand stores, detail pages)

**Key Achievement:** Solid foundation with working create/list functionality and clean architecture.

---

## 🎯 **User Flow-Based Roadmap**

### **Primary User Story**: *"I want to watch a playlist continuously like YouTube"*
### **Secondary User Story**: *"I want to manage my playlists easily"*

---

## 🚀 **Phase 2: Enhanced User Flow Implementation**

### 🎯 Objectives
Transform current "playlist listing" into YouTube-like browsing and continuous viewing experience

### 📝 Implementation Plan

#### **2.1 Playlist Detail Page Flow**
```
Current: PlaylistCard → (blocked)
Target:  PlaylistCard → Playlist Detail Page → Player + Playlist Context
```

**User Journey:**
1. **Playlist Discovery**: User browses playlist grid
2. **Playlist Exploration**: Click playlist card → detailed view with metadata
3. **Playback Decision**: Choose "Play All", specific video, or shuffle
4. **Continuous Viewing**: Watch with auto-progression and playlist sidebar

#### **2.2 Playlist Detail Page Features**
- **Playlist Information**: Title, description, video count, total duration
- **Action Buttons**: "Play All", "Shuffle", "Edit", "Share"
- **Video List**: Thumbnails, titles, durations with individual play buttons
- **Quick Access**: Breadcrumb navigation back to playlist library

#### **2.3 Enhanced Player Experience**
- **Playlist Context**: Detect playlist parameter and show sidebar
- **Auto-progression**: Seamless transition between videos
- **Navigation Controls**: Next/Previous buttons and keyboard shortcuts
- **Progress Tracking**: Visual indicator of current position in playlist

#### **2.4 Playlist Management UI**
Add convenient management without disrupting primary flow:

1. **PlaylistCard Enhancement**
   - Add "..." menu button (hover/click)
   - Dropdown options: Edit, Delete, Share
   - Keep primary click for playback

2. **Quick Edit Modal**
   ```
   app/features/playlist/components/
   └── EditPlaylistModal.tsx     # Lightweight editing
       ├── Name/description editing
       ├── Privacy toggle
       └── Delete confirmation
   ```

### ✅ Phase 2 Deliverables
- [ ] Playlist detail page with comprehensive information
- [ ] Multiple playback options (Play All, Shuffle, specific video)
- [ ] Player with playlist sidebar and context
- [ ] Auto-progression between videos
- [ ] Playlist management menu on cards
- [ ] Quick edit/delete functionality

**Success Metric:** User can explore playlist details → make informed viewing decisions → enjoy seamless continuous playback

---

## 🔧 **Phase 3: Enhanced Management Features**

### 🎯 Objectives
Add power-user features while keeping simplicity

#### **3.1 Video Management**
1. **Add Videos to Playlist**
   - "Add to Playlist" button on VideoCard
   - Bulk selection interface
   - Drag & drop support

2. **Playlist Organization**
   - Reorder videos within playlist
   - Remove videos from playlist
   - Duplicate playlist functionality

#### **3.2 Smart Features**
1. **Resume Watching**
   - Remember last watched position in playlist
   - "Continue Watching" section

2. **Playlist Suggestions**
   - Auto-detect series from similar titles
   - Suggest creating playlists from tags
   - "You might also like" recommendations

### ✅ Phase 3 Deliverables
- [ ] Video-to-playlist assignment UI
- [ ] Drag & drop playlist management
- [ ] Resume watching functionality
- [ ] Smart playlist suggestions
- [ ] Bulk operations interface

---

## 📅 **Implementation Timeline**

### **Week 1: Detail Page & Navigation (Phase 2.1-2.3)**
- Day 1-2: Playlist detail page implementation
- Day 3-4: Player playlist context and sidebar
- Day 5-6: Auto-progression and navigation controls
- Day 7: Testing and UX refinement

### **Week 2: Management UI (Phase 2.4)**
- Day 1-2: Playlist card menu system
- Day 3-4: Edit/Delete modals
- Day 5-6: Integration testing
- Day 7: UX polish and bug fixes

### **Week 3-4: Enhanced Features (Phase 3)**
- Week 3: Video management features
- Week 4: Smart features and optimization

---

## 🎨 **Design Principles**

### **Simplicity First**
- Primary actions should be obvious and direct
- Complex features hidden behind secondary interactions
- No feature creep without clear user value

### **YouTube-like UX**
- Familiar interaction patterns
- Continuous playback as default expectation
- Minimal cognitive load for basic operations

### **Performance Focused**
- Server-side data loading (React Router v7 loaders)
- Minimal client-side state management
- Fast transitions between videos

---

## 🔍 **Technical Architecture**

### **Frontend Architecture Summary**

We standardized the SPA around a lightweight interpretation of Feature-Sliced Design (FSD) to end the previous “component soup.” Core ideas:

- `components/ui` holds purely presentational primitives that know nothing about business concepts.
- `entities` groups UI and model helpers around domain nouns (e.g., `video`, `playlist`) so repeated blocks—`VideoCard`, `PlaylistCard`—live in one place.
- `features` encapsulate user actions (verbs) such as creating or editing playlists; they may compose entities and shared components but remain self-contained.
- `widgets` assemble entities and features into page-ready sections (library view, playlist detail, etc.).
- `pages/routes` orchestrate widgets to deliver complete screens and own data loading via React Router loaders.

This dependency direction keeps concerns separated while staying approachable for a single-maintainer project.

### **FSD (Feature-Sliced Design) Structure**

This project follows **Feature-Sliced Design** architectural methodology with 3-level hierarchy:

#### **1. Layers (Standardized)**
```
Features → Widgets → Entities → Shared
```

#### **2. Slices (Business Domains)**
```
playlist/ → video/ → user/ → (domain-specific)
```

#### **3. Segments (Technical Purpose)**
```
model/ → ui/ → api/ → (technical-specific)
```

### **Current FSD Implementation**
```
✅ Completed Structure:

app/features/
└── playlist/                    # 🎯 Slice (Business Domain)
    └── create-playlist/         # 🎯 Feature (Single Action)
        ├── model/
        │   └── useCreatePlaylist.ts     # ✅ Complete
        ├── ui/
        │   ├── CreatePlaylistForm.tsx   # ✅ Complete
        │   └── CreatePlaylistDialog.tsx # ✅ Complete
        └── api/ (future)

app/widgets/
└── playlists-view/              # 🎯 Widget (Complex UI Assembly)
    ├── model/
    │   └── usePlaylistsView.ts          # ✅ Complete
    └── ui/
        ├── PlaylistsView.tsx            # ✅ Complete
        └── PlaylistGrid.tsx             # ✅ Complete

app/entities/
└── playlist/                    # 🎯 Entity (Pure Domain UI)
    └── ui/
        └── PlaylistCard.tsx             # ✅ Complete
```

### **🔄 Phase 2 FSD Extensions**
```
🚀 Planned Additions:

app/features/
└── playlist/
    ├── create-playlist/         # ✅ Complete
    ├── edit-playlist/           # 🔄 Phase 2
    │   ├── model/useEditPlaylist.ts
    │   └── ui/EditPlaylistModal.tsx
    ├── delete-playlist/         # 🔄 Phase 2
    │   ├── model/useDeletePlaylist.ts
    │   └── ui/DeleteConfirmDialog.tsx
    └── add-video-to-playlist/   # 🔄 Phase 3
        ├── model/useAddToPlaylist.ts
        └── ui/AddToPlaylistDropdown.tsx

app/widgets/
├── playlists-view/              # ✅ Complete
├── playlist-detail-view/        # 🔄 Phase 2
│   ├── model/usePlaylistDetail.ts
│   └── ui/PlaylistDetailView.tsx
└── playlist-player/             # 🔄 Phase 2
    ├── model/usePlaylistPlayer.ts
    └── ui/PlaylistSidebar.tsx
```

### **🎯 FSD Development Guidelines**

#### **Adding New Features (MUST FOLLOW)**
1. **Identify Operation Type**:
   - Single Action → `features/[domain]/[action]/`
   - Complex UI Assembly → `widgets/[purpose]/`
   - Pure Domain Display → `entities/[domain]/ui/`

2. **Create Complete Vertical Slice**:
   ```bash
   mkdir -p app/features/playlist/[new-feature]/
   cd app/features/playlist/[new-feature]/
   touch model/use[FeatureName].ts    # Business logic
   touch ui/[FeatureName]Form.tsx     # UI components
   touch api/[feature].api.ts         # API calls (if needed)
   ```

3. **Respect Dependency Rules**:
   - Features MAY import from: Entities, Shared
   - Features MUST NOT import from: Widgets, Pages
   - Widgets MAY import from: Features, Entities, Shared
   - Never reverse dependencies!

4. **Public API Only**:
   ```typescript
   // ✅ CORRECT - Import from feature root
   import { useCreatePlaylist } from '~/features/playlist/create-playlist'

   // ❌ WRONG - Don't import internals
   import { useCreatePlaylist } from '~/features/playlist/create-playlist/model/useCreatePlaylist'
   ```

#### **📋 Feature Development Checklist**
- [ ] Feature organized in correct Layer > Slice > Segment structure
- [ ] Dependencies flow downward only (no circular imports)
- [ ] Public API exported from feature index
- [ ] Business logic in `model/` segment
- [ ] UI components in `ui/` segment
- [ ] Types co-located with usage
- [ ] Tests follow same structure pattern

### **API Endpoints (All Complete)**
```
✅ GET    /api/playlists           # List playlists
✅ POST   /api/playlists           # Create playlist
✅ GET    /api/playlists/:id       # Get playlist details
✅ PUT    /api/playlists/:id       # Update playlist
✅ DELETE /api/playlists/:id       # Delete playlist
✅ POST   /api/playlists/:id/items # Add video to playlist
✅ DELETE /api/playlists/:id/items/:videoId # Remove video
✅ PUT    /api/playlists/:id/items # Reorder playlist
```

---

## 📊 **Success Metrics**

### **Phase 2 Success Criteria**
- [ ] Playlist click → detail page loads < 1 second
- [ ] Play button → video starts playing < 2 seconds
- [ ] Auto-play next video works 100% of time
- [ ] Playlist management accessible within 2 clicks
- [ ] Zero broken states in browsing and playback flow

### **User Experience Goals**
- [ ] 90%+ users find playlist playback intuitive
- [ ] 70%+ users create at least one playlist
- [ ] 60%+ users use auto-progression feature
- [ ] <5% support requests about playlist functionality

---

## 🔄 **Migration & Rollback Plan**

### **Zero-Disruption Deployment**
- All changes are additive to existing functionality
- Current playlist listing continues to work
- No breaking changes to existing APIs
- Feature flags for gradual rollout

### **Rollback Strategy**
- Each phase can be independently disabled
- Database changes are backwards compatible
- UI components can fallback to current behavior
- API versioning prevents breaking changes

---

## 📚 **Documentation Updates**

### **User Guide Updates**
- [ ] "How to create and use playlists" tutorial
- [ ] "Continuous watching" feature explanation
- [ ] Keyboard shortcuts reference

### **Developer Documentation**
- [ ] Updated component usage examples
- [ ] Playlist player integration guide
- [ ] API endpoint documentation refresh

---

## 🎉 **Future Considerations (Post-Phase 3)**

### **Potential Enhancements**
- **Social Features**: Playlist sharing with friends
- **Mobile Optimization**: Touch-friendly playlist controls
- **Offline Support**: Download playlists for offline viewing
- **Integration**: Import/export with other media systems

### **Technical Debt & Maintenance**
- Regular performance monitoring
- User feedback collection
- Security audits for playlist data
- Accessibility improvements

---

*This plan prioritizes user value and technical simplicity while building on the solid foundation already established. Each phase delivers tangible user benefits and can be shipped independently.*
