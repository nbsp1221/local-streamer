import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("player/:id", "routes/player.$id.tsx"),
] satisfies RouteConfig;
