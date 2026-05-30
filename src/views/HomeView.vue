<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const roomInput = ref("");
const creating = ref(false);

async function createRoom(gameType = "uno") {
  creating.value = true;
  try {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameType }),
    });
    if (!res.ok) {
      throw new Error("Failed to create room");
    }
    const data = await res.json();
    router.push(`/room/${data.roomId}`);
  } finally {
    creating.value = false;
  }
}

function joinRoom() {
  const roomId = roomInput.value.trim();
  if (!roomId) {
    return;
  }
  router.push(`/room/${encodeURIComponent(roomId)}`);
}
</script>

<template>
  <section class="home-grid">
    <div class="hero panel">
      <h2>Heigo</h2>
      <p class="subtitle">A real-time room based game platform. Start with UNO and grow later.</p>

      <div class="quick-join">
        <el-input v-model="roomInput" size="large" placeholder="Input Room ID" @keyup.enter="joinRoom" />
        <el-button type="primary" size="large" @click="joinRoom">Quick Join</el-button>
      </div>
    </div>

    <div class="games panel">
      <div class="games-head">
        <h3>Game Lobby</h3>
        <p>Available now</p>
      </div>

      <div class="game-card" @click="createRoom('uno')">
        <div>
          <p class="game-label">UNO</p>
          <p class="game-desc">Classic color matching card game for 2+ players.</p>
        </div>
        <el-button :loading="creating" type="warning">Create Room</el-button>
      </div>

      <div class="game-card" @click="createRoom('gem_merchant')">
        <div>
          <p class="game-label">Gem Merchant</p>
          <p class="game-desc">Collect gems, buy developments, and race to 15 points.</p>
        </div>
        <el-button :loading="creating" type="primary">Create Room</el-button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 18px;
}

.panel {
  border-radius: 22px;
  border: 1px solid #d8e2ec;
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.9), rgba(241, 246, 252, 0.92));
  box-shadow: 0 20px 40px rgba(10, 28, 45, 0.1);
  padding: 24px;
}

.hero {
  background:
    radial-gradient(circle at 18% 18%, rgba(66, 153, 225, 0.2), transparent 35%),
    radial-gradient(circle at 85% 30%, rgba(244, 162, 97, 0.24), transparent 38%),
    linear-gradient(145deg, #ffffff, #eef4fc);
}

.tag {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
  font-size: 0.85rem;
}

.hero h2 {
  margin-top: 12px;
  font-size: clamp(2rem, 4vw, 3rem);
}

.subtitle {
  max-width: 50ch;
  color: #38506b;
}

.quick-join {
  margin-top: 24px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.games-head {
  margin-bottom: 16px;
}

.games-head p {
  color: #6b7e95;
}

.game-card {
  border: 1px solid #d0dae5;
  border-radius: 16px;
  padding: 16px;
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 12px;
  background: #fff;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.game-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 20px rgba(31, 41, 55, 0.1);
}

.game-label {
  font-size: 1.2rem;
  font-weight: 700;
}

.game-desc {
  color: #5f748d;
}

@media (max-width: 960px) {
  .home-grid {
    grid-template-columns: 1fr;
  }

  .quick-join {
    grid-template-columns: 1fr;
  }

  .game-card {
    grid-template-columns: 1fr;
  }
}
</style>
