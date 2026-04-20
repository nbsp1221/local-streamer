# Playlist Add-To-Playlist Notes

Status: Draft follow-up note
Last reviewed: 2026-04-19

## Purpose

Capture the current reality and possible next steps for adding library videos into playlists.

This file is intentionally narrow. It is not the source of truth for overall playlist architecture or refactor status.

## Current Implementation Reality

- backend playlist item mutation exists through:
  - `POST /api/playlists/:id/items`
  - `DELETE /api/playlists/:id/items/:videoId`
- playlist list and detail pages exist in the active route tree
- the current home library uses `useHomeLibraryView`, not `useLibraryView`
- there is no active `AddToPlaylistDialog` implementation in the current UI surface
- the current playlist detail surface still contains TODO placeholders for play-all, single-video playback within a playlist, and edit actions

## Suggested Next Steps

- add a library-owned entry point for “Add to playlist” from video cards or the quick-view dialog
- decide whether playlist detail actions should launch the existing player route or a playlist-aware player flow
- add UI-level tests once an add-to-playlist surface exists so playlist item mutations are covered end-to-end from the browser-facing layer

## Non-Goals For This Note

- changing playlist persistence away from JSON
- reopening migration ownership decisions
- redefining playlist permissions or auth semantics
