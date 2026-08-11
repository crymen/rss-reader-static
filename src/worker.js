import { onRequestGet as getRss } from "../functions/api/rss.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/rss") {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "GET" },
        });
      }

      return getRss({ request, env });
    }

    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "接口不存在" }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
