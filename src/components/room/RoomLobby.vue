<script setup>
import { computed } from "vue";

const props = defineProps({
  roomId: {
    type: String,
    required: true,
  },
  roomState: {
    type: Object,
    required: true,
  },
  connected: {
    type: Boolean,
    default: false,
  },
  user: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["ready", "start"]);

const users = computed(() => props.roomState.users || []);
const onlineUsers = computed(() => users.value.filter((entry) => entry.status === "online"));
const isHost = computed(() => props.roomState.roomInfo?.hostUserId === props.user.userid);
const me = computed(() => users.value.find((entry) => entry.userId === props.user.userid));
const allOnlineReady = computed(() => {
  if (!onlineUsers.value.length) {
    return false;
  }
  return onlineUsers.value.every((entry) => entry.ready);
});

async function copyInvite() {
  await navigator.clipboard.writeText(window.location.href);
}
</script>

<template>
  <section class="room-lobby card">
    <header class="lobby-head">
      <div>
        <p class="eyebrow">Room</p>
        <h2>UNO Lobby</h2>
        <p class="room-id">ID: {{ roomId }}</p>
      </div>
      <el-tag :type="connected ? 'success' : 'danger'">{{ connected ? "Live" : "Offline" }}</el-tag>
    </header>

    <div class="rules card-lite">
      <h3>Rules</h3>
      <p>Classic UNO. Match by color or value. Wild cards pick color. First empty hand wins.</p>
    </div>

    <div class="seat-list card-lite">
      <h3>Players</h3>
      <ul>
        <li v-for="entry in users" :key="entry.userId" class="seat-item">
          <span class="avatar" :style="{ backgroundColor: entry.avatar?.color || '#7c8ea3' }">
            {{ entry.avatar?.emoji || "🎮" }}
          </span>
          <span class="name">{{ entry.username }}</span>
          <el-tag size="small" :type="entry.status === 'online' ? 'success' : 'info'">
            {{ entry.status }}
          </el-tag>
          <el-tag size="small" :type="entry.ready ? 'warning' : 'info'">
            {{ entry.ready ? "Ready" : "Not ready" }}
          </el-tag>
          <el-tag v-if="entry.userId === roomState.roomInfo?.hostUserId" size="small" type="danger">Host</el-tag>
        </li>
      </ul>
    </div>

    <footer class="lobby-actions">
      <el-button @click="copyInvite">Copy Invite Link</el-button>
      <el-button
        v-if="!me?.ready"
        type="primary"
        :disabled="!connected"
        @click="emit('ready')"
      >
        Ready
      </el-button>
      <el-button
        v-if="isHost"
        type="warning"
        :disabled="!allOnlineReady || onlineUsers.length < 2 || !connected"
        @click="emit('start')"
      >
        Start Game
      </el-button>
    </footer>
  </section>
</template>

<style scoped>
.card {
  border: 1px solid #d3dce8;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.card-lite {
  border: 1px solid #e4ebf4;
  border-radius: 14px;
  padding: 12px;
  background: #f9fbfe;
}

.room-lobby {
  padding: 16px;
  display: grid;
  gap: 12px;
}

.lobby-head {
  display: flex;
  justify-content: space-between;
  align-items: start;
}

.eyebrow {
  color: #64748b;
  font-size: 0.84rem;
}

.room-id {
  color: #475569;
}

.seat-list ul {
  list-style: none;
  display: grid;
  gap: 8px;
  padding: 0;
  margin: 10px 0 0;
}

.seat-item {
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #e4ebf4;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  display: grid;
  place-items: center;
}

.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lobby-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 760px) {
  .seat-item {
    grid-template-columns: auto 1fr auto;
  }
}
</style>
