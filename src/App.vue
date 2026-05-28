<script setup>
import { computed, ref } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useUser } from "./composables/useUser";

const route = useRoute();
const { user, updateUsername, reloginAsRandomUser, logout } = useUser();

const showNameDialog = ref(false);
const pendingName = ref(user.value.username);

const title = computed(() => route.meta?.title || "Heigo");

function openNameDialog() {
  pendingName.value = user.value.username;
  showNameDialog.value = true;
}

function saveName() {
  updateUsername(pendingName.value);
  showNameDialog.value = false;
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">H</span>
        <span class="brand-name">Heigo</span>
      </RouterLink>

      <h1 class="page-title">{{ title }}</h1>

      <el-dropdown trigger="click" class="user-menu">
        <button class="avatar-button" type="button">
          <span class="avatar-chip" :style="{ backgroundColor: user.avatar.color }">
            {{ user.avatar.emoji }}
          </span>
          <span class="username">{{ user.username }}</span>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="openNameDialog">Edit Name</el-dropdown-item>
            <el-dropdown-item @click="reloginAsRandomUser">Sign In (Random)</el-dropdown-item>
            <el-dropdown-item divided @click="logout">Sign Out</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </header>

    <main class="page-content">
      <RouterView />
    </main>

    <el-dialog v-model="showNameDialog" title="Edit Display Name" width="420px">
      <el-input v-model="pendingName" maxlength="30" show-word-limit placeholder="Input a name" />
      <template #footer>
        <el-button @click="showNameDialog = false">Cancel</el-button>
        <el-button type="primary" @click="saveName">Save</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  background: linear-gradient(120deg, #122038, #1c2f52 52%, #375d7f);
  color: #f3f9ff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(5px);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: inherit;
}

.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-weight: 700;
  background: linear-gradient(140deg, #f7c85d, #ff8f5a);
  color: #1f2937;
}

.brand-name {
  font-weight: 700;
  letter-spacing: 0.03em;
}

.page-title {
  font-size: 1.1rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu {
  justify-self: end;
}

.avatar-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.1);
  color: inherit;
  cursor: pointer;
}

.avatar-chip {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 17px;
}

.username {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-content {
  padding: 16px;
}

@media (max-width: 760px) {
  .topbar {
    grid-template-columns: auto auto;
    grid-template-areas:
      "brand user"
      "title title";
    row-gap: 10px;
  }

  .brand {
    grid-area: brand;
  }

  .page-title {
    grid-area: title;
    font-size: 1rem;
  }

  .user-menu {
    grid-area: user;
  }

  .username {
    display: none;
  }
}
</style>
