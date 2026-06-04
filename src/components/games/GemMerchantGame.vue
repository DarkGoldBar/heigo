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
const hasTakenGemThisTurn = computed(() => gemTotal(me.value?.takenGems || {}) > 0);
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
  return props.gameState?.deckSorted?.[`tier${tier}`]?.length || 0;
}

function deckCards(tier) {
  return props.gameState?.deckSorted?.[`tier${tier}`] || [];
}

function gemClass(color) {
  return `gem-${color}`;
}

function gemTint(color) {
  const palette = {
    white: "rgba(248, 250, 252, 0.55)",
    blue: "rgba(37, 99, 235, 0.50)",
    green: "rgba(22, 163, 74, 0.50)",
    red: "rgba(220, 38, 38, 0.50)",
    black: "rgba(15, 23, 42, 0.55)",
    gold: "rgba(245, 158, 11, 0.50)",
  };

  return palette[color] || "rgba(148, 163, 184, 0.35)";
}

function cardCostSummary(card) {
  return GEM_COLORS.map((color) => Number(card?.cost?.[color] || 0)).join(", ");
}

function resetDiscardGems() {
  for (const color of ALL_GEMS) {
    discardGems[color] = 0;
  }
}

function canTakeGem(color) {
  if (!myTurn.value || mustDiscard.value || bankGems.value[color] <= 0) {
    return false;
  }

  const takenGems = me.value?.takenGems || {};
  const takenCount = gemTotal(takenGems);
  const takenColors = GEM_COLORS.filter((entry) => Number(takenGems[entry] || 0) > 0);

  if (Number(takenGems[color] || 0) >= 2) {
    return false;
  }

  if (takenCount >= 2 && takenColors.length >= 2 && Number(takenGems[color] || 0) > 0) {
    return false;
  }

  if (Number(takenGems[color] || 0) > 0 && bankGems.value[color] < 3) {
    return false;
  }

  return true;
}

function takeGem(color) {
  if (!canTakeGem(color)) {
    return;
  }

  emit("action", {
    type: "take_gems",
    gems: { [color]: 1 },
  });
}

function endTurn() {
  emit("action", { type: "end_turn" });
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
          <el-button size="small" type="primary" :disabled="!myTurn || mustDiscard" @click="endTurn">
            Turn End
          </el-button>
        </div>
        <div class="gem-row">
          <button
            v-for="color in ALL_GEMS"
            :key="color"
            type="button"
            class="gem-token"
            :class="gemClass(color)"
            :disabled="color === 'gold' || !canTakeGem(color)"
            @click="takeGem(color)"
          >
            <span>{{ color }}</span>
            <strong>{{ bankGems[color] || 0 }}</strong>
          </button>
        </div>
        <p class="muted">Click a gem pile to take 1 gem. Each click sends a Take Gem action immediately.</p>
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

      <section class="market panel" :class="{ 'disabled-panel': hasTakenGemThisTurn }">
        <div class="section-head">
          <h3>Market</h3>
        </div>
        <div v-for="tier in [3, 2, 1]" :key="tier" class="tier-row">
          <div class="tier-label">
            <strong>Tier {{ tier }}</strong>
            <el-popover
              placement="bottom-start"
              trigger="click"
              width="240"
              :disabled="deckCount(tier) === 0"
            >
              <template #reference>
                <el-button size="small" type="info" plain :disabled="deckCount(tier) === 0">
                  Deck ({{ deckCount(tier) }})
                </el-button>
              </template>
              <div class="deck-popover-list">
                <p v-if="!deckCards(tier).length" class="muted">No cards left in this deck.</p>
                <article v-for="card in deckCards(tier)" :key="card.id" class="deck-popover-card">
                  <div class="deck-card-line">
                    <span class="deck-vp-badge" :style="{ backgroundColor: gemTint(card.color) }">{{ card.points }} VP</span>
                    <span v-for="color in GEM_COLORS" :key="color" class="deck-cost-chip gem-count" :class="gemClass(color)">
                      {{ card.cost?.[color] || 0 }}
                    </span>
                  </div>
                </article>
              </div>
            </el-popover>
            <el-button
              style="margin-left: 0;"
              size="small"
              :disabled="!myTurn || mustDiscard || hasTakenGemThisTurn || !deckCount(tier) || (me?.reservedCards?.length || 0) >= 3"
              @click="reserveDeckCard(tier)"
            >
              Reserve
            </el-button>
          </div>
          <article
            v-for="card in marketCards(tier)"
            :key="card.id"
            class="dev-card"
            :class="[gemClass(card.color), { 'unaffordable-card': !canBuy(card) }]"
          >
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
              <el-button size="small" type="primary" :disabled="!myTurn || mustDiscard || hasTakenGemThisTurn || !canBuy(card)" @click="buyMarketCard(tier, card)">
                Buy
              </el-button>
              <el-button size="small" :disabled="!myTurn || mustDiscard || hasTakenGemThisTurn || (me?.reservedCards?.length || 0) >= 3" @click="reserveMarketCard(tier, card)">
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

      <section class="panel reserved" :class="{ 'disabled-panel': hasTakenGemThisTurn }">
        <h3>Your Reserved Cards</h3>
        <div class="reserved-cards">
          <article
            v-for="card in me?.reservedCards || []"
            :key="card.id"
            class="dev-card compact"
            :class="[gemClass(card.color), { 'unaffordable-card': !canBuy(card) }]"
          >
            <header>
              <strong>{{ card.points }} VP</strong>
              <span>{{ card.color }}</span>
            </header>
            <div class="cost-list">
              <div v-for="color in GEM_COLORS" :key="color" class="gem-count" :class="gemClass(color)" v-show="card.cost[color]">
                <span>{{ card.cost[color] }}</span>
              </div>
            </div>
            <el-button size="small" type="primary" :disabled="!myTurn || mustDiscard || hasTakenGemThisTurn || !canBuy(card)" @click="buyReservedCard(card)">
              Buy
            </el-button>
          </article>
        </div>
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
.mini-gems,
.discounts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
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
  transition: transform 120ms ease, box-shadow 120ms ease, opacity 160ms ease;
}

.gem-token:hover:not(:disabled) {
  transform: translateY(-1px) scale(1.03);
  box-shadow:
    0 0 0 3px rgba(37, 99, 235, 0.18),
    0 0 0 6px rgba(56, 189, 248, 0.10),
    0 14px 24px rgba(148, 163, 184, 0.24);
  background-image:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.35), transparent 22%),
    linear-gradient(135deg, rgba(147, 197, 253, 0.18), rgba(244, 114, 182, 0.16));
}

.gem-token:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  filter: saturate(0.7);
}

.gem-token strong {
  font-size: 1.2rem;
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

.unaffordable-card {
  position: relative;
  overflow: hidden;
  opacity: 0.88;
  filter: saturate(0.78);
  background-color: var(--gem-bg-color, #f8fafc);
  background-image: repeating-linear-gradient(135deg, rgb(209 207 187 / 47%) 0 10px, rgb(255 255 255 / 80%) 10px 20px);
  background-blend-mode: multiply, normal;
}

.unaffordable-card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 8px;
  pointer-events: none;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), transparent 35%);

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

.disabled-panel {
  position: relative;
  overflow: hidden;
  opacity: 0.72;
  pointer-events: none;
}

.disabled-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(148, 163, 184, 0.08), rgba(226, 232, 240, 0.18));
  border-radius: 8px;
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
  border: 1px solid lightgray;
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
  --gem-bg-color: #f8fafc;
  background-color: var(--gem-bg-color);
  color: #334155;
}

.gem-blue {
  --gem-bg-color: #2563eb;
  background-color: var(--gem-bg-color);
  color: #fff;
}

.gem-green {
  --gem-bg-color: #16a34a;
  background-color: var(--gem-bg-color);
  color: #fff;
}

.gem-red {
  --gem-bg-color: #dc2626;
  background-color: var(--gem-bg-color);
  color: #fff;
}

.gem-black {
  --gem-bg-color: #1f2937;
  background-color: var(--gem-bg-color);
  color: #fff;
}

.gem-count.gem-black {
  border-color: #fff;
}

.gem-gold {
  --gem-bg-color: #f59e0b;
  background-color: var(--gem-bg-color);
  color: #1f2937;
}

.deck-popover-list {
  display: grid;
  gap: 8px;
}

.deck-popover-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  display: grid;
  gap: 6px;
}

.deck-card-line,
.deck-cost-line,
.deck-meta-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.deck-meta-line {
  color: #334155;
  font-size: 0.86rem;
}

.deck-vp-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.7);
}

.deck-card-color,
.deck-card-id {
  color: #475569;
  font-size: 0.85rem;
}

.deck-cost-chip {
  width: 1.75em;
  height: 1.75em;
  border-radius: 999px;
  font-size: 0.78rem;
  border: 1px solid rgba(255, 255, 255, 0.6);
}

.reserved-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
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
