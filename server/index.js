import { RoomDurableObject } from "./room.js";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
};

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init.headers || {}),
    },
  });
}

function notFound() {
  return json({ error: "Not found" }, { status: 404 });
}

function badRequest(message) {
  return json({ error: message }, { status: 400 });
}

function getRoomIdFromPath(pathname) {
  const match = pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/rooms") {
      let gameType = "uno";

      try {
        if (request.headers.get("content-type")?.includes("application/json")) {
          const payload = await request.json();
          if (typeof payload?.gameType === "string" && payload.gameType.trim()) {
            gameType = payload.gameType.trim().toLowerCase();
          }
        }
      } catch {
        return badRequest("Invalid JSON body");
      }

      if (gameType !== "uno") {
        return badRequest("Only gameType=uno is supported right now");
      }

      const roomId = crypto.randomUUID();
      const roomStub = env.ROOM.get(env.ROOM.idFromName(roomId));

      await roomStub.fetch("https://room.internal/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId, gameType }),
      });

      return json({ roomId, gameType }, { status: 201 });
    }

    if (request.method === "GET") {
      const roomId = getRoomIdFromPath(url.pathname);
      if (roomId) {
        const roomStub = env.ROOM.get(env.ROOM.idFromName(roomId));
        return roomStub.fetch(request);
      }
    }

    return notFound();
  },
};

export { RoomDurableObject };
