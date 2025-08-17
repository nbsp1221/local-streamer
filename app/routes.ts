import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("add-videos", "routes/add-videos.tsx"),
  route("player/:id", "routes/player.$id.tsx"),
  route("setup", "routes/setup.tsx"),
  route("login", "routes/login.tsx"),
  route("api/thumbnail/:id", "routes/api/thumbnail.$id.ts"),
  route("api/thumbnail-preview/:filename", "routes/api/thumbnail-preview.$filename.ts"),
  route("api/scan-incoming", "routes/api/scan-incoming.ts"),
  route("api/add-to-library", "routes/api/add-to-library.ts"),
  route("api/delete/:id", "routes/api/delete.$id.ts"),
  route("api/update/:id", "routes/api/update.$id.ts"),
  route("api/auth/setup", "routes/api/auth/setup.ts"),
  route("api/auth/login", "routes/api/auth/login.ts"),
  route("api/auth/logout", "routes/api/auth/logout.ts"),
  route("api/auth/me", "routes/api/auth/me.ts"),
  // RESTful video resource routes
  route("videos/:videoId/token", "routes/videos.$videoId.token.ts"),
  route("videos/:videoId/clearkey", "routes/videos.$videoId.clearkey.ts"),
  route("videos/:videoId/video/:filename", "routes/videos.$videoId.video.$filename.ts"),
  route("videos/:videoId/audio/:filename", "routes/videos.$videoId.audio.$filename.ts"),
  route("videos/:videoId/manifest.mpd", "routes/videos.$videoId.manifest.ts"),
] satisfies RouteConfig;
