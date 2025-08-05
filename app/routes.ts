import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("add-videos", "routes/add-videos.tsx"),
  route("player/:id", "routes/player.$id.tsx"),
  route("setup", "routes/setup.tsx"),
  route("login", "routes/login.tsx"),
  route("api/stream/:id", "routes/api/stream.$id.ts"),
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
] satisfies RouteConfig;
