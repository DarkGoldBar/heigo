<script setup>
import { computed } from "vue";
import { useI18n } from "../../i18n";

const { t } = useI18n();

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
const gameType = computed(() => props.roomState.roomInfo?.gameType || "uno");
const gameTitle = computed(() => t(gameType.value === "gem_merchant" ? "lobby.gemTitle" : "lobby.unoTitle"));
const rulesText = computed(() => (
  gameType.value === "gem_merchant"
    ? t("lobby.gemRules")
    : t("lobby.unoRules")
));
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

function displayName(entry) {
  return entry.username || String(entry.userId).slice(-8);
}
</script>

<template>
  <section class="room-lobby card">
    <header class="lobby-head">
      <div>
        <p class="eyebrow">{{ t("lobby.room") }}</p>
        <h2>{{ gameTitle }}</h2>
        <p class="room-id">{{ t("lobby.roomId", { id: roomId }) }}</p>
      </div>
      <el-tag :type="connected ? 'success' : 'danger'">{{ connected ? t("common.live") : t("common.offline") }}</el-tag>
    </header>

    <div class="rules card-lite">
      <h3>{{ t("lobby.rules") }}</h3>
      <p>{{ rulesText }}</p>
    </div>

    <div class="seat-list card-lite">
      <h3>{{ t("common.players") }}</h3>
      <ul>
        <li v-for="entry in users" :key="entry.userId" class="seat-item">
          <span class="avatar" :style="{ backgroundColor: entry.avatar?.color || '#7c8ea3' }">
            {{ entry.avatar?.emoji || "🎮" }}
          </span>
          <span class="name">{{ displayName(entry) }}</span>
          <el-tag size="small" :type="entry.status === 'online' ? 'success' : 'info'">
            {{ t(`common.${entry.status === "online" ? "online" : "offline"}`) }}
          </el-tag>
          <el-tag size="small" :type="entry.ready ? 'warning' : 'info'">
            {{ entry.ready ? t("common.ready") : t("common.notReady") }}
          </el-tag>
          <el-tag v-if="entry.userId === roomState.roomInfo?.hostUserId" size="small" type="danger">{{ t("common.host") }}</el-tag>
        </li>
      </ul>
    </div>

    <footer class="lobby-actions">
      <el-button @click="copyInvite">{{ t("lobby.copyInvite") }}</el-button>
      <el-button
        v-if="!me?.ready"
        type="primary"
        :disabled="!connected"
        @click="emit('ready')"
      >
        {{ t("common.ready") }}
      </el-button>
      <el-button
        v-if="isHost"
        type="warning"
        :disabled="!allOnlineReady || onlineUsers.length < 2 || !connected"
        @click="emit('start')"
      >
        {{ t("lobby.startGame") }}
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
