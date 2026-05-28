import { computed, onUnmounted, ref } from "vue";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePayload(message) {
  return message?.payload ?? message;
}

export function useWebSocket() {
  const connected = ref(false);
  const roomState = ref({ roomInfo: {}, users: [], messages: [] });
  const messages = ref([]);
  const gameState = ref(null);
  const lastEvent = ref(null);

  let socket = null;
  let closingManually = false;
  let reconnectAttempts = 0;
  let roomIdRef = null;
  let userIdRef = null;
  let onConnectedRef = null;

  function buildWsUrl(roomId, userId) {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${location.host}/api/rooms/${encodeURIComponent(roomId)}/ws?userId=${encodeURIComponent(userId)}`;
  }

  function updateUserState(userId, patch) {
    roomState.value = {
      ...roomState.value,
      users: roomState.value.users.map((user) =>
        user.userId === userId ? { ...user, ...patch } : user
      ),
    };
  }

  function mergeOrInsertUser(newUser) {
    const users = [...roomState.value.users];
    const idx = users.findIndex((entry) => entry.userId === newUser.userId);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...newUser };
    } else {
      users.push(newUser);
    }
    roomState.value = {
      ...roomState.value,
      users,
    };
  }

  function removeUser(userId) {
    roomState.value = {
      ...roomState.value,
      users: roomState.value.users.map((user) =>
        user.userId === userId ? { ...user, status: "offline" } : user
      ),
    };
  }

  function handleMessage(event) {
    const message = JSON.parse(event.data);
    const payload = normalizePayload(message);
    lastEvent.value = { type: message.type, payload };

    if (message.type === "room_state") {
      roomState.value = {
        roomInfo: payload.roomInfo || {},
        users: payload.users || [],
        messages: payload.messages || [],
      };
      messages.value = payload.messages || [];
      return;
    }

    if (message.type === "player_joined") {
      mergeOrInsertUser(payload.user);
      return;
    }

    if (message.type === "player_left") {
      removeUser(payload.userId);
      return;
    }

    if (message.type === "player_ready") {
      updateUserState(payload.userId, { ready: Boolean(payload.ready) });
      return;
    }

    if (message.type === "host_changed") {
      roomState.value = {
        ...roomState.value,
        roomInfo: {
          ...roomState.value.roomInfo,
          hostUserId: payload.newHostUserId,
        },
      };
      return;
    }

    if (message.type === "message") {
      messages.value = [...messages.value, payload];
      roomState.value = {
        ...roomState.value,
        messages: messages.value,
      };
      return;
    }

    if (message.type === "game_started" || message.type === "game_state") {
      gameState.value = payload.gameState;
      return;
    }

    if (message.type === "game_ended") {
      roomState.value = {
        ...roomState.value,
        roomInfo: {
          ...roomState.value.roomInfo,
          state: "ended",
        },
      };
    }
  }

  async function tryReconnect() {
    if (closingManually || reconnectAttempts >= 5 || !roomIdRef || !userIdRef) {
      return;
    }

    reconnectAttempts += 1;
    const delay = Math.min(16000, 500 * 2 ** reconnectAttempts);
    await wait(delay);

    if (!closingManually) {
      connect(roomIdRef, userIdRef, onConnectedRef);
    }
  }

  function connect(roomId, userId, onConnected) {
    closingManually = false;
    roomIdRef = roomId;
    userIdRef = userId;
    onConnectedRef = onConnected;

    if (socket) {
      closingManually = true;
      socket.close();
      socket = null;
      closingManually = false;
    }

    socket = new WebSocket(buildWsUrl(roomId, userId));

    socket.addEventListener("open", () => {
      connected.value = true;
      reconnectAttempts = 0;
      if (typeof onConnected === "function") {
        onConnected();
      }
    });

    socket.addEventListener("message", handleMessage);

    socket.addEventListener("close", () => {
      connected.value = false;
      socket = null;
      if (!closingManually) {
        void tryReconnect();
      }
    });

    socket.addEventListener("error", () => {
      connected.value = false;
    });
  }

  function send(data) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(JSON.stringify(data));
    return true;
  }

  function close() {
    closingManually = true;
    if (socket) {
      socket.close();
      socket = null;
    }
    connected.value = false;
  }

  onUnmounted(close);

  return {
    connected: computed(() => connected.value),
    roomState,
    messages,
    gameState,
    lastEvent,
    connect,
    close,
    send,
  };
}
