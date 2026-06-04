<script setup>
import { computed, reactive } from "vue";
import ChatPanel from "../room/ChatPanel.vue";

const GEM_COLORS = ["white", "blue", "green", "red", "black"];
const ALL_GEMS = [...GEM_COLORS, "gold"];

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

const selectedGems = reactive({ white: 0, blue: 0, green: 0, red: 0, black: 0 });
const discardGems = reactive({ white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 });

const myId = computed(() => props.user.userid);
const players = computed(() => props.gameState?.players || []);
const roomUsers = computed(() => props.roomState?.users || []);
const usernameById = computed(() => {
  const map = new Map();
  for (const roomUser of roomUsers.value) {
    if (roomUser?.userId) {
      map.set(roomUser.userId, roomUser.username || "");
    }
  }
  return map;
});
const currentPlayer = computed(() => players.value[props.gameState?.currentPlayerIndex] || null);
const me = computed(() => players.value.find((player) => player.userId === myId.value) || null);
const myTurn = computed(() => currentPlayer.value?.userId === myId.value);
const pendingDiscard = computed(() => props.gameState?.pendingDiscard || null);
const mustDiscard = computed(() => pendingDiscard.value?.userId === myId.value);
const bankGems = computed(() => props.gameState?.bankGems || {});
const winnerNames = computed(() => {
  const winnerIds = props.gameState?.winnerUserIds || [];
  return players.value
    .filter((player) => winnerIds.includes(player.userId))
    .map((player) => displayName(player.userId))
    .join(", ");
});

function shortUserId(userId) {
  if (!userId) {
    return "unknown";
  }
  return String(userId).slice(-8);
}

function displayName(userId) {
  const username = usernameById.value.get(userId);
  if (username) {
    return username;
  }
  return shortUserId(userId);
}

function gemTotal(gems = {}) {
  return ALL_GEMS.reduce((sum, color) => sum + Number(gems[color] || 0), 0);
}

function cardCount(player, color) {
  return player?.cards?.[color]?.length || 0;
}

function marketCards(tier) {
  return props.gameState?.market?.[`tier${tier}`] || [];
}

function deckCount(tier) {
  return props.gameState?.deckCounts?.[`tier${tier}`] || 0;
}

function gemClass(color) {
  return `gem-${color}`;
}

function resetSelectedGems() {
  for (const color of GEM_COLORS) {
    selectedGems[color] = 0;
  }
}

function resetDiscardGems() {
  for (const color of ALL_GEMS) {
    discardGems[color] = 0;
  }
}

function toggleGem(color) {
  if (!myTurn.value || mustDiscard.value || bankGems.value[color] <= 0) {
    return;
  }

  const pickedColors = GEM_COLORS.filter((entry) => selectedGems[entry] > 0);
  if (selectedGems[color] > 0) {
    selectedGems[color] = 0;
    return;
  }

  if (pickedColors.length >= 3) {
    return;
  }
  selectedGems[color] = 1;
}

function takeSelectedGems() {
  emit("action", {
    type: "take_gems",
    gems: { ...selectedGems },
  });
  resetSelectedGems();
}

function takeTwo(color) {
  emit("action", {
    type: "take_gems",
    gems: { [color]: 2 },
  });
}

function actualCost(player, card) {
  const cost = {};
  for (const color of GEM_COLORS) {
    cost[color] = Math.max(0, Number(card.cost?.[color] || 0) - cardCount(player, color));
  }
  return cost;
}

function makePayment(player, card) {
  if (!player || !card) {
    return null;
  }

  const cost = actualCost(player, card);
  const payment = { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 };
  let goldNeeded = 0;

  for (const color of GEM_COLORS) {
    const paid = Math.min(Number(player.gems?.[color] || 0), cost[color]);
    payment[color] = paid;
    goldNeeded += cost[color] - paid;
  }

  if (goldNeeded > Number(player.gems?.gold || 0)) {
    return null;
  }

  payment.gold = goldNeeded;
  return payment;
}

function canBuy(card) {
  return Boolean(makePayment(me.value, card));
}

function buyMarketCard(tier, card) {
  const payment = makePayment(me.value, card);
  if (!payment) {
    return;
  }
  emit("action", {
    type: "buy_card",
    source: "market",
    tier,
    cardId: card.id,
    payment,
  });
}

function buyReservedCard(card) {
  const payment = makePayment(me.value, card);
  if (!payment) {
    return;
  }
  emit("action", {
    type: "buy_card",
    source: "reserved",
    cardId: card.id,
    payment,
  });
}

function reserveMarketCard(tier, card) {
  emit("action", {
    type: "reserve_card",
    source: "market",
    tier,
    cardId: card.id,
  });
}

function reserveDeckCard(tier) {
  emit("action", {
    type: "reserve_card",
    source: "deck",
    tier,
  });
}

function discardSelectedGems() {
  emit("action", {
    type: "discard_gems",
    gems: { ...discardGems },
  });
  resetDiscardGems();
}
</script>

<template>
  <section class="gem-layout">
    <div class="game-column">
      <header class="game-head panel">
        <div>
          <p class="eyebrow">Gem Merchant</p>
          <h2>{{ myTurn ? "Your turn" : `${displayName(currentPlayer?.userId)}'s turn` }}</h2>
        </div>
        <div class="head-tags">
          <el-tag :type="myTurn ? 'success' : 'info'">{{ myTurn ? "Act now" : "Waiting" }}</el-tag>
          <el-tag v-if="gameState?.finalRoundTriggered" type="danger">Final Round</el-tag>
          <el-tag v-if="mustDiscard" type="warning">Discard {{ pendingDiscard.needDiscardCount }}</el-tag>
        </div>
      </header>

      <section class="bank panel">
        <div class="section-head">
          <h3>Bank</h3>
          <el-button
            size="small"
            type="primary"
            :disabled="!myTurn || mustDiscard || GEM_COLORS.filter((color) => selectedGems[color] > 0).length !== 3"
            @click="takeSelectedGems"
          >
            Take 3
          </el-button>
        </div>
        <div class="gem-row">
          <button
            v-for="color in ALL_GEMS"
            :key="color"
            type="button"
            class="gem-token"
            :class="[gemClass(color), { selected: selectedGems[color] > 0 }]"
            :disabled="color === 'gold' || bankGems[color] <= 0 || !myTurn || mustDiscard"
            @click="toggleGem(color)"
          >
            <span>{{ color }}</span>
            <strong>{{ bankGems[color] || 0 }}</strong>
          </button>
        </div>
        <div class="take-two">
          <el-button
            v-for="color in GEM_COLORS"
            :key="color"
            size="small"
            :disabled="!myTurn || mustDiscard || bankGems[color] < 4"
            @click="takeTwo(color)"
          >
            Take 2 {{ color }}
          </el-button>
        </div>
      </section>

      <section v-if="mustDiscard" class="panel discard-panel">
        <div class="section-head">
          <h3>Discard Gems</h3>
          <el-button
            type="warning"
            :disabled="gemTotal(discardGems) !== pendingDiscard.needDiscardCount"
            @click="discardSelectedGems"
          >
            Discard
          </el-button>
        </div>
        <div class="discard-grid">
          <label v-for="color in ALL_GEMS" :key="color">
            <span>{{ color }} ({{ me?.gems?.[color] || 0 }})</span>
            <el-input-number v-model="discardGems[color]" :min="0" :max="me?.gems?.[color] || 0" size="small" />
          </label>
        </div>
      </section>

      <section class="market panel">
        <div class="section-head">
          <h3>Market</h3>
        </div>
        <div v-for="tier in [3, 2, 1]" :key="tier" class="tier-row">
          <div class="tier-label">
            <strong>Tier {{ tier }}</strong>
            <el-button
              size="small"
              :disabled="!myTurn || mustDiscard || !deckCount(tier) || (me?.reservedCards?.length || 0) >= 3"
              @click="reserveDeckCard(tier)"
            >
              Reserve deck ({{ deckCount(tier) }})
            </el-button>
          </div>
          <article v-for="card in marketCards(tier)" :key="card.id" class="dev-card" :class="gemClass(card.color)">
            <header>
              <strong>{{ card.points }} VP</strong>
              <span>{{ card.color }}</span>
            </header>
            <div class="cost-list">
              <div v-for="color in GEM_COLORS" :key="color" class="gem-count" :class="gemClass(color)" v-show="card.cost[color]">
                <span>{{ card.cost[color] }}</span>
              </div>
            </div>
            <footer>
              <el-button size="small" type="primary" :disabled="!myTurn || mustDiscard || !canBuy(card)" @click="buyMarketCard(tier, card)">
                Buy
              </el-button>
              <el-button size="small" :disabled="!myTurn || mustDiscard || (me?.reservedCards?.length || 0) >= 3" @click="reserveMarketCard(tier, card)">
                Reserve
              </el-button>
            </footer>
          </article>
        </div>
      </section>

      <section class="nobles panel">
        <div class="section-head">
          <h3>Nobles</h3>
        </div>
        <article v-for="noble in gameState?.nobles || []" :key="noble.id" class="noble-card">
          <strong>{{ noble.points }} VP</strong>
          <div class="noble-req">
            <div v-for="color in GEM_COLORS" :key="color" class="gem-count" :class="gemClass(color)" v-show="noble.requirement[color]">
              <span>{{ noble.requirement[color] }}</span>
            </div>
          </div>
        </article>
      </section>
    </div>

    <aside class="side-column">
      <section class="panel players">
        <h3>Players</h3>
        <article v-for="player in players" :key="player.userId" class="player-card" :class="{ active: player.userId === currentPlayer?.userId }">
          <header>
            <strong>{{ displayName(player.userId) }}</strong>
            <el-tag size="small">{{ player.score }} VP</el-tag>
          </header>
          <div class="mini-gems">
            <div v-for="color in ALL_GEMS" :key="color" class="gem-count" :class="gemClass(color)">
              <span>{{ player.gems[color] || 0 }}</span>
            </div>
          </div>
          <div class="discounts">
            <div v-for="color in GEM_COLORS" :key="color" class="gem-count" :class="gemClass(color)">
              <span>{{ cardCount(player, color) }}</span>
            </div>
          </div>
          <p class="muted">Reserved: {{ player.reservedCount ?? player.reservedCards?.length ?? 0 }} · Nobles: {{ player.nobles?.length || 0 }}</p>
        </article>
      </section>

      <section class="panel reserved">
        <h3>Your Reserved Cards</h3>
        <article v-for="card in me?.reservedCards || []" :key="card.id" class="dev-card compact" :class="gemClass(card.color)">
          <header>
            <strong>{{ card.points }} VP</strong>
            <span>{{ card.color }}</span>
          </header>
          <div class="cost-list">
            <div v-for="color in GEM_COLORS" :key="color" class="gem-count" :class="gemClass(color)" v-show="card.cost[color]">
              <span>{{ card.cost[color] }}</span>
            </div>
          </div>
          <el-button size="small" type="primary" :disabled="!myTurn || mustDiscard || !canBuy(card)" @click="buyReservedCard(card)">
            Buy
          </el-button>
        </article>
        <p v-if="!me?.reservedCards?.length" class="muted">No reserved cards.</p>
      </section>

      <ChatPanel :messages="messages" :connected="connected" @send="(text) => emit('chat', text)" />
    </aside>

    <el-dialog :model-value="gameState?.status === 'ended'" title="Game Ended" width="380px" :show-close="false">
      <p>Winner: {{ winnerNames || "None" }}</p>
      <template #footer>
        <el-button type="primary" @click="emit('back-to-lobby')">Back to Lobby</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.gem-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: 16px;
}

.game-column,
.side-column {
  display: grid;
  gap: 12px;
  align-content: start;
}

.panel {
  border: 1px solid #d7e0ea;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.07);
  padding: 14px;
}

.game-head,
.section-head,
.dev-card header,
.player-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.eyebrow,
.muted {
  color: #64748b;
  font-size: 0.86rem;
}

.head-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: end;
}

.gem-row,
.take-two,
.mini-gems,
.discounts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.gem-token {
  aspect-ratio: 1;
  min-width: 78px;
  border: 1px solid #cbd5e1;
  border-radius: 50%;
  padding: 8px;
  display: grid;
  gap: 4px;
  cursor: pointer;
}

.gem-token strong {
  font-size: 1.2rem;
}

.gem-token.selected {
  outline: 3px solid #2563eb;
}

.tier-row {
  display: grid;
  grid-template-columns: 140px repeat(4, minmax(130px, 1fr));
  gap: 10px;
  margin-top: 10px;
  align-items: stretch;
}

.tier-label {
  display: grid;
  gap: 8px;
  align-content: start;
  color: #334155;
}

.dev-card,
.noble-card,
.player-card {
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  padding: 10px;
  background: #f8fafc;
}

.player-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dev-card {
  min-height: 132px;
  display: grid;
  gap: 8px;
}

.dev-card footer {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.compact {
  min-height: auto;
  margin-top: 8px;
}

.cost-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.noble-req {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.nobles {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.nobles .section-head {
  width: 100%;
}

.noble-card {
  min-width: 150px;
  display: grid;
  gap: 4px;
}

.players {
  display: grid;
  gap: 8px;
}

.player-card.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.gem-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.9em;
  height: 1.9em;
  border-radius: 50%;
  border: 1px solid #111827;
  box-sizing: border-box;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1;
}

.gem-count span {
  display: block;
}

.mini-gems .gem-count {
  font-size: 0.86rem;
}

.discounts .gem-count {
  font-size: 0.86rem;
  border-radius: 15%;
}

.cost-list .gem-count,
.noble-req .gem-count {
  font-size: 0.9rem;
}

.discard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.discard-grid label {
  display: grid;
  gap: 4px;
}

.gem-white {
  background: #f8fafc;
  color: #334155;
}

.gem-blue {
  background: #2563eb;
  color: #fff;
}

.gem-green {
  background: #16a34a;
  color: #fff;
}

.gem-red {
  background: #dc2626;
  color: #fff;
}

.gem-black {
  background: #1f2937;
  color: #fff;
}

.gem-count.gem-black {
  border-color: #fff;
}

.gem-gold {
  background: #f59e0b;
  color: #1f2937;
}

@media (max-width: 1180px) {
  .gem-layout {
    grid-template-columns: 1fr;
  }

  .tier-row {
    grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  }
}
</style>
