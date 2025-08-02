import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("player/:id", "routes/player.$id.tsx"),
  route("api/stream/:id", "routes/api.stream.$id.ts"),
  route("api/hls/:id", "routes/api.hls.$id.ts"),
  route("api/segment/:id/:file", "routes/api.segment.$id.$file.ts"),
  route("api/hls-check/:id", "routes/api.hls-check.$id.ts"),
] satisfies RouteConfig;
