<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import UnoGame from "../components/games/UnoGame.vue";
import ChatPanel from "../components/room/ChatPanel.vue";
import RoomLobby from "../components/room/RoomLobby.vue";
import { useUser } from "../composables/useUser";
import { useWebSocket } from "../composables/useWebSocket";

const route = useRoute();
const roomId = computed(() => String(route.params.roomId || ""));
const scene = ref("lobby");

const { user } = useUser();
const { connected, roomState, messages, gameState, lastEvent, connect, close, send } = useWebSocket();

function joinRoom() {
  connect(roomId.value, user.value.userid, () => {
    send({
      type: "join",
      payload: { user: user.value },
    });
  });
}

function sendChat(content) {
  send({ type: "chat", payload: { content } });
}

function startGame() {
  send({ type: "start" });
}

function readyUp() {
  send({ type: "ready" });
}

function sendGameAction(action) {
  send({ type: "game_action", payload: { action } });
}

watch(
  () => roomId.value,
  () => {
    close();
    scene.value = "lobby";
    joinRoom();
  }
);

watch(
  () => lastEvent.value,
  (event) => {
    if (!event) {
      return;
    }

    if (event.type === "game_started") {
      scene.value = "game";
    }
  }
);

watch(
  () => gameState.value,
  (state) => {
    if (state?.status === "playing") {
      scene.value = "game";
    }
  },
  { deep: true }
);

onMounted(joinRoom);
onUnmounted(close);
</script>

<template>
  <section class="room-page">
    <div v-if="scene === 'lobby'" class="scene-grid">
      <RoomLobby
        :room-id="roomId"
        :room-state="roomState"
        :connected="connected"
        :user="user"
        @ready="readyUp"
        @start="startGame"
      />
      <ChatPanel :messages="messages" :connected="connected" @send="sendChat" />
    </div>

    <UnoGame
      v-else
      :room-state="roomState"
      :game-state="gameState"
      :messages="messages"
      :connected="connected"
      :user="user"
      @chat="sendChat"
      @action="sendGameAction"
      @back-to-lobby="scene = 'lobby'"
    />
  </section>
</template>

<style scoped>
.room-page {
  min-height: calc(100vh - 110px);
}

.scene-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
}

@media (max-width: 980px) {
  .scene-grid {
    grid-template-columns: 1fr;
  }
}
</style>
