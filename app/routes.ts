import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("add-videos", "routes/add-videos.tsx"),
  route("player/:id", "routes/player.$id.tsx"),
  route("api/stream/:id", "routes/api.stream.$id.ts"),
  route("api/thumbnail/:id", "routes/api.thumbnail.$id.ts"),
  route("api/thumbnail-preview/:filename", "routes/api.thumbnail-preview.$filename.ts"),
  route("api/hls/:id", "routes/api.hls.$id.ts"),
  route("api/segment/:id/:file", "routes/api.segment.$id.$file.ts"),
  route("api/hls-check/:id", "routes/api.hls-check.$id.ts"),
  route("api/scan-incoming", "routes/api.scan-incoming.ts"),
  route("api/add-to-library", "routes/api.add-to-library.ts"),
] satisfies RouteConfig;
