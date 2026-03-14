# Library Infrastructure

This directory is reserved for future library-owned infrastructure.

In the Phase 3 pre-step, legacy JSON-backed reads stay in the server composition
boundary (`app/composition/server/library-legacy-video-source.ts`) so the
`app/modules/library` slice can keep a clean public contract while the project
finishes the compatibility migration.
