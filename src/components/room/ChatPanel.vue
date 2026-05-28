<script setup>
import { nextTick, ref, watch } from "vue";

const props = defineProps({
  messages: {
    type: Array,
    default: () => [],
  },
  connected: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["send"]);
const draft = ref("");
const scroller = ref();

function send() {
  const content = draft.value.trim();
  if (!content) {
    return;
  }
  emit("send", content);
  draft.value = "";
}

watch(
  () => props.messages.length,
  async () => {
    await nextTick();
    const wrap = scroller.value?.wrapRef;
    if (wrap) {
      wrap.scrollTop = wrap.scrollHeight;
    }
  }
);
</script>

<template>
  <section class="chat-panel card">
    <header class="chat-head">
      <h3>Room Chat</h3>
      <el-tag :type="connected ? 'success' : 'danger'" effect="dark">
        {{ connected ? "Connected" : "Offline" }}
      </el-tag>
    </header>

    <el-scrollbar ref="scroller" class="chat-list">
      <article
        v-for="item in messages"
        :key="item.id || `${item.createdAt}-${item.content}`"
        class="chat-item"
        :class="`type-${item.msgType || 'chat'}`"
      >
        <div class="chat-meta">
          <span>{{ item.username }}</span>
          <time>{{ new Date(item.createdAt || Date.now()).toLocaleTimeString() }}</time>
        </div>
        <p>{{ item.content }}</p>
      </article>
    </el-scrollbar>

    <footer class="chat-input-row">
      <el-input v-model="draft" placeholder="Send a message" @keyup.enter="send" />
      <el-button type="primary" @click="send">Send</el-button>
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

.chat-panel {
  padding: 14px;
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 10px;
  min-height: 580px;
}

.chat-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-list {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 8px;
  min-height: 260px;
}

.chat-item {
  padding: 8px;
  border-radius: 10px;
}

.chat-item + .chat-item {
  margin-top: 6px;
}

.chat-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.8rem;
  color: #64748b;
}

.type-system {
  background: #eef6ff;
}

.type-game {
  background: #fff7e6;
}

.chat-input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

@media (max-width: 760px) {
  .chat-panel {
    min-height: 420px;
  }

  .chat-input-row {
    grid-template-columns: 1fr;
  }
}
</style>
