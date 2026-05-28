<script setup>
import { computed, ref } from "vue";
import ChatPanel from "../room/ChatPanel.vue";

const props = defineProps({
  roomState: {
    type: Object,
    required: true,
  },
  gameState: {
    type: Object,
    required: true,
  },
  messages: {
    type: Array,
    default: () => [],
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

const emit = defineEmits(["action", "chat", "back-to-lobby"]);

const chooseColorDialog = ref(false);
const pendingWild = ref(null);

const myId = computed(() => props.user.userid);
const myCards = computed(() => props.gameState?.hands?.[myId.value] || []);
const topCard = computed(() => props.gameState?.discardTop || null);
const currentColor = computed(() => props.gameState?.currentColor || "none");
const currentTurn = computed(() => props.gameState?.currentTurn);
const users = computed(() => props.roomState.users || []);
const meTurn = computed(() => currentTurn.value === myId.value);
const winner = computed(() => props.gameState?.winner || null);

const opponents = computed(() => {
  return users.value
    .filter((entry) => entry.userId !== myId.value)
    .map((entry) => ({
      ...entry,
      handCount: Number(props.gameState?.handCounts?.[entry.userId] || 0),
      active: entry.userId === currentTurn.value,
    }));
});

function canPlay(card) {
  if (!topCard.value) {
    return false;
  }

  const pendingDraw = Number(props.gameState?.pendingDraw || 0);
  if (pendingDraw > 0) {
    return card.value === "draw_two" || card.value === "wild_draw_four";
  }

  if (card.type === "wild") {
    return true;
  }

  if (card.color === currentColor.value) {
    return true;
  }

  return card.value === topCard.value.value;
}

function playCard(card) {
  if (!meTurn.value || !canPlay(card)) {
    return;
  }

  if (card.type === "wild") {
    pendingWild.value = card;
    chooseColorDialog.value = true;
    return;
  }

  emit("action", { type: "play", card });
}

function chooseColor(color) {
  if (!pendingWild.value) {
    return;
  }

  emit("action", {
    type: "play",
    card: pendingWild.value,
    chosenColor: color,
  });
  pendingWild.value = null;
  chooseColorDialog.value = false;
}

function draw() {
  if (!meTurn.value) {
    return;
  }
  emit("action", { type: "draw" });
}

function cardLabel(card) {
  if (!card) {
    return "-";
  }
  const map = {
    skip: "Skip",
    reverse: "Reverse",
    draw_two: "+2",
    wild: "Wild",
    wild_draw_four: "+4",
  };
  return map[card.value] || card.value;
}
</script>

<template>
  <section class="uno-layout">
    <div class="table-wrap card">
      <header class="table-head">
        <h3>UNO Match</h3>
        <el-tag :type="meTurn ? 'success' : 'info'">{{ meTurn ? "Your turn" : "Waiting" }}</el-tag>
      </header>

      <div class="table-center">
        <div class="pile">
          <p class="pile-label">Discard Top</p>
          <div class="card-face" :class="`color-${topCard?.color || 'wild'}`">
            {{ cardLabel(topCard) }}
          </div>
        </div>

        <div class="status-block">
          <p>Current Color</p>
          <span class="color-dot" :class="`dot-${currentColor}`"></span>
          <p>Deck: {{ gameState?.deckCount || 0 }}</p>
          <p>Pending Draw: {{ gameState?.pendingDraw || 0 }}</p>
        </div>

        <el-button type="warning" :disabled="!meTurn" @click="draw">Draw Card</el-button>
      </div>

      <div class="opponents">
        <article
          v-for="enemy in opponents"
          :key="enemy.userId"
          class="enemy"
          :class="{ active: enemy.active }"
        >
          <span class="enemy-avatar" :style="{ backgroundColor: enemy.avatar?.color || '#64748b' }">
            {{ enemy.avatar?.emoji || "🎮" }}
          </span>
          <div>
            <p>{{ enemy.username }}</p>
            <p class="hand-count">Cards: {{ enemy.handCount }}</p>
          </div>
        </article>
      </div>

      <div class="my-hand">
        <button
          v-for="card in myCards"
          :key="card.id"
          type="button"
          class="hand-card"
          :class="[`color-${card.color || 'wild'}`, { playable: canPlay(card), disabled: !meTurn || !canPlay(card) }]"
          @click="playCard(card)"
        >
          {{ cardLabel(card) }}
        </button>
      </div>
    </div>

    <div class="chat-column">
      <ChatPanel :messages="messages" :connected="connected" @send="(text) => emit('chat', text)" />
    </div>

    <el-dialog v-model="chooseColorDialog" title="Pick Color" width="360px">
      <div class="wild-colors">
        <button class="color-btn red" @click="chooseColor('red')">Red</button>
        <button class="color-btn yellow" @click="chooseColor('yellow')">Yellow</button>
        <button class="color-btn green" @click="chooseColor('green')">Green</button>
        <button class="color-btn blue" @click="chooseColor('blue')">Blue</button>
      </div>
    </el-dialog>

    <el-dialog :model-value="Boolean(winner)" title="Game Ended" width="380px" :show-close="false">
      <p>The winner is {{ winner }}</p>
      <template #footer>
        <el-button type="primary" @click="emit('back-to-lobby')">Back to Lobby</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.uno-layout {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 16px;
}

.card {
  border: 1px solid #d3dce8;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.table-wrap {
  padding: 14px;
  display: grid;
  gap: 12px;
}

.table-head {
  display: flex;
  justify-content: space-between;
}

.table-center {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px dashed #c8d5e6;
  border-radius: 14px;
  padding: 12px;
}

.pile {
  text-align: center;
}

.pile-label {
  color: #64748b;
  margin-bottom: 6px;
}

.card-face {
  width: 74px;
  height: 104px;
  border-radius: 14px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #fff;
}

.status-block {
  display: grid;
  gap: 2px;
}

.color-dot {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.25);
}

.opponents {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.enemy {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 8px;
}

.enemy.active {
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
}

.enemy-avatar {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  display: grid;
  place-items: center;
}

.hand-count {
  color: #64748b;
  font-size: 0.85rem;
}

.my-hand {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.hand-card {
  width: 78px;
  height: 110px;
  border-radius: 12px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.hand-card.playable:hover {
  transform: translateY(-4px);
}

.hand-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-column {
  min-width: 0;
}

.wild-colors {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.color-btn {
  border: 0;
  border-radius: 10px;
  color: #fff;
  padding: 10px;
  cursor: pointer;
}

.color-red,
.red,
.dot-red {
  background: #e63946;
}

.color-yellow,
.yellow,
.dot-yellow {
  background: #e9c46a;
  color: #1f2937;
}

.color-green,
.green,
.dot-green {
  background: #2a9d8f;
}

.color-blue,
.blue,
.dot-blue {
  background: #1d4ed8;
}

.color-wild {
  background: linear-gradient(135deg, #e63946 25%, #e9c46a 25%, #e9c46a 50%, #2a9d8f 50%, #2a9d8f 75%, #1d4ed8 75%);
}

.dot-none {
  background: #94a3b8;
}

@media (max-width: 1080px) {
  .uno-layout {
    grid-template-columns: 1fr;
  }
}
</style>
