import { applyAction, createInitialGameState, getPlayerView } from "./games/uno.js";

const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function now() {
  return Date.now();
}

function safeJsonParse(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function normalizeUserRow(row) {
  return {
    userId: row.user_id,
    username: row.username,
    avatar: safeJsonParse(row.avatar, { emoji: "🎮", color: "#5f6caf" }),
    status: row.status,
    ready: Boolean(row.ready),
    joinedAt: row.joined_at,
    lastSeen: row.last_seen,
  };
}

function normalizeMessageRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    content: row.content,
    msgType: row.msg_type,
    createdAt: row.created_at,
  };
}

export class RoomDurableObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.initialized = this.ensureSchema();
  }

  async ensureSchema() {
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS roomInfo (key TEXT PRIMARY KEY, value TEXT)"
    );
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, username TEXT NOT NULL, content TEXT NOT NULL, msg_type TEXT NOT NULL DEFAULT 'chat', created_at INTEGER NOT NULL)"
    );
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS users (user_id TEXT PRIMARY KEY, username TEXT NOT NULL, avatar TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'online', ready INTEGER NOT NULL DEFAULT 0, joined_at INTEGER NOT NULL, last_seen INTEGER NOT NULL)"
    );
  }

  async fetch(request) {
    await this.initialized;

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/init") {
      const payload = await request.json();
      const roomId = payload?.roomId;
      const gameType = payload?.gameType || "uno";

      if (!roomId) {
        return jsonResponse({ error: "Missing roomId" }, 400);
      }

      await this.setRoomInfo("roomId", roomId);
      await this.setRoomInfo("gameType", gameType);
      await this.setRoomInfo("hostUserId", null);
      await this.setRoomInfo("rules", {});
      await this.setRoomInfo("state", "waiting");
      await this.setRoomInfo("annonce", null);
      await this.touchTTL();

      return jsonResponse({ ok: true });
    }

    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return jsonResponse({ error: "Expected WebSocket upgrade" }, 426);
    }

    const userId = new URL(request.url).searchParams.get("userId") || crypto.randomUUID();
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.serializeAttachment({ userId });
    this.ctx.acceptWebSocket(server);
    await this.touchTTL();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws, rawData) {
    await this.initialized;

    const message = safeJsonParse(String(rawData), {});
    if (!message || typeof message.type !== "string") {
      this.sendToSocket(ws, { type: "error", payload: { message: "Invalid message" } });
      return;
    }

    try {
      if (message.type === "join") {
        await this.handleJoin(ws, message);
        return;
      }

      if (message.type === "chat") {
        await this.handleChat(ws, message);
        return;
      }

      if (message.type === "ready") {
        await this.handleReady(ws);
        return;
      }

      if (message.type === "start") {
        await this.handleStart(ws);
        return;
      }

      if (message.type === "game_action") {
        await this.handleGameAction(ws, message);
        return;
      }

      this.sendToSocket(ws, { type: "error", payload: { message: "Unknown message type" } });
    } catch (error) {
      this.sendToSocket(ws, {
        type: "error",
        payload: { message: error instanceof Error ? error.message : "Unknown error" },
      });
    }
  }

  async webSocketClose(ws) {
    const attachment = ws.deserializeAttachment() || {};
    const userId = attachment.userId;
    if (!userId) {
      return;
    }

    this.ctx.storage.sql.exec(
      "UPDATE users SET status = 'offline', last_seen = ? WHERE user_id = ?",
      now(),
      userId
    );

    this.broadcast({ type: "player_left", payload: { userId } });

    const hostUserId = await this.getRoomInfo("hostUserId");
    if (hostUserId === userId) {
      const onlineRows = [
        ...this.ctx.storage.sql.exec(
          "SELECT user_id FROM users WHERE status = 'online' ORDER BY joined_at ASC LIMIT 1"
        ),
      ];

      const nextHostUserId = onlineRows[0]?.user_id || null;
      await this.setRoomInfo("hostUserId", nextHostUserId);

      this.broadcast({
        type: "host_changed",
        payload: { newHostUserId: nextHostUserId },
      });
    }
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }

  getSocketUserId(ws) {
    const attachment = ws.deserializeAttachment() || {};
    return attachment.userId || null;
  }

  sendToSocket(ws, data) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      // Ignore send failures from stale sockets.
    }
  }

  broadcast(data) {
    const payload = JSON.stringify(data);
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        // Ignore send failures from stale sockets.
      }
    }
  }

  async touchTTL() {
    await this.ctx.storage.setAlarm(now() + ROOM_TTL_MS);
  }

  async setRoomInfo(key, value) {
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO roomInfo (key, value) VALUES (?, ?)",
      key,
      JSON.stringify(value)
    );
  }

  async getRoomInfo(key, fallback = null) {
    const rows = [...this.ctx.storage.sql.exec("SELECT value FROM roomInfo WHERE key = ?", key)];
    if (rows.length === 0) {
      return fallback;
    }
    return safeJsonParse(rows[0].value, fallback);
  }

  async getRoomInfoMap() {
    const rows = [...this.ctx.storage.sql.exec("SELECT key, value FROM roomInfo")];
    const map = {};
    for (const row of rows) {
      map[row.key] = safeJsonParse(row.value, null);
    }
    return map;
  }

  async getAllUsers() {
    const rows = [
      ...this.ctx.storage.sql.exec("SELECT * FROM users ORDER BY joined_at ASC"),
    ];
    return rows.map(normalizeUserRow);
  }

  async getLastMessages(limit = 50) {
    const rows = [
      ...this.ctx.storage.sql.exec(
        "SELECT * FROM messages ORDER BY id DESC LIMIT ?",
        limit
      ),
    ]
      .reverse()
      .map(normalizeMessageRow);

    return rows;
  }

  async handleJoin(ws, message) {
    const attachedUserId = this.getSocketUserId(ws);
    const payloadUser = message?.payload?.user || message?.user || {};
    const userId = payloadUser.userid || attachedUserId || crypto.randomUUID();
    const username = (payloadUser.username || "Player").slice(0, 30);
    const avatar = payloadUser.avatar || { emoji: "🎲", color: "#345995" };

    ws.serializeAttachment({ userId });

    const existing = [
      ...this.ctx.storage.sql.exec("SELECT joined_at, ready FROM users WHERE user_id = ?", userId),
    ][0];

    this.ctx.storage.sql.exec(
      "INSERT INTO users (user_id, username, avatar, status, ready, joined_at, last_seen) VALUES (?, ?, ?, 'online', ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, status = 'online', last_seen = excluded.last_seen",
      userId,
      username,
      JSON.stringify(avatar),
      existing?.ready ?? 0,
      existing?.joined_at ?? now(),
      now()
    );

    const hostUserId = await this.getRoomInfo("hostUserId");
    if (!hostUserId) {
      await this.setRoomInfo("hostUserId", userId);
    }

    await this.touchTTL();

    this.broadcast({
      type: "player_joined",
      payload: {
        user: {
          userId,
          username,
          avatar,
          ready: Boolean(existing?.ready ?? 0),
          status: "online",
        },
      },
    });

    const roomInfo = await this.getRoomInfoMap();
    const users = await this.getAllUsers();
    const messages = await this.getLastMessages(50);

    this.sendToSocket(ws, {
      type: "room_state",
      payload: { roomInfo, users, messages },
    });

    const annonce = roomInfo.annonce;
    if (annonce && annonce.status === "playing") {
      this.sendToSocket(ws, {
        type: "game_state",
        payload: { gameState: getPlayerView(annonce, userId) },
      });
    }
  }

  async handleChat(ws, message) {
    const userId = this.getSocketUserId(ws);
    if (!userId) {
      throw new Error("Join first");
    }

    const content = String(message?.payload?.content || message?.content || "").trim();
    if (!content) {
      return;
    }

    const userRow = [
      ...this.ctx.storage.sql.exec("SELECT username FROM users WHERE user_id = ?", userId),
    ][0];

    const username = userRow?.username || "Player";

    this.ctx.storage.sql.exec(
      "INSERT INTO messages (user_id, username, content, msg_type, created_at) VALUES (?, ?, ?, 'chat', ?)",
      userId,
      username,
      content,
      now()
    );

    const inserted = [
      ...this.ctx.storage.sql.exec("SELECT * FROM messages ORDER BY id DESC LIMIT 1"),
    ][0];

    await this.touchTTL();

    this.broadcast({
      type: "message",
      payload: normalizeMessageRow(inserted),
    });
  }

  async handleReady(ws) {
    const userId = this.getSocketUserId(ws);
    if (!userId) {
      throw new Error("Join first");
    }

    this.ctx.storage.sql.exec(
      "UPDATE users SET ready = 1, status = 'online', last_seen = ? WHERE user_id = ?",
      now(),
      userId
    );

    await this.touchTTL();

    this.broadcast({
      type: "player_ready",
      payload: { userId, ready: true },
    });
  }

  async handleStart(ws) {
    const userId = this.getSocketUserId(ws);
    if (!userId) {
      throw new Error("Join first");
    }

    const hostUserId = await this.getRoomInfo("hostUserId");
    if (hostUserId !== userId) {
      throw new Error("Only host can start");
    }

    const onlineUsers = [
      ...this.ctx.storage.sql.exec("SELECT user_id, ready FROM users WHERE status = 'online' ORDER BY joined_at ASC"),
    ];

    if (onlineUsers.length < 2) {
      throw new Error("At least 2 online players are required");
    }

    const allReady = onlineUsers.every((row) => Number(row.ready) === 1);
    if (!allReady) {
      throw new Error("All online players must be ready");
    }

    const playerIds = onlineUsers.map((row) => row.user_id);
    const gameState = createInitialGameState(playerIds);

    await this.setRoomInfo("annonce", gameState);
    await this.setRoomInfo("state", "playing");
    await this.touchTTL();

    for (const socket of this.ctx.getWebSockets()) {
      const socketUserId = this.getSocketUserId(socket);
      if (!socketUserId) {
        continue;
      }

      this.sendToSocket(socket, {
        type: "game_started",
        payload: { gameState: getPlayerView(gameState, socketUserId) },
      });
    }
  }

  async handleGameAction(ws, message) {
    const userId = this.getSocketUserId(ws);
    if (!userId) {
      throw new Error("Join first");
    }

    const gameState = await this.getRoomInfo("annonce");
    if (!gameState) {
      throw new Error("Game has not started");
    }

    const action = message?.payload?.action || message?.action;
    const nextState = applyAction(gameState, userId, action);

    await this.setRoomInfo("annonce", nextState);
    if (nextState.status === "ended") {
      await this.setRoomInfo("state", "ended");
    }
    await this.touchTTL();

    for (const socket of this.ctx.getWebSockets()) {
      const socketUserId = this.getSocketUserId(socket);
      if (!socketUserId) {
        continue;
      }

      this.sendToSocket(socket, {
        type: "game_state",
        payload: { gameState: getPlayerView(nextState, socketUserId) },
      });
    }

    if (nextState.status === "ended") {
      this.broadcast({
        type: "game_ended",
        payload: { winner: nextState.winner },
      });
    }
  }
}
