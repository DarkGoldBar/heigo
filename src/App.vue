<script setup>
import { computed, ref, watchEffect } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import en from "element-plus/es/locale/lang/en";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import { useUser } from "./composables/useUser";
import { useI18n } from "./i18n";

const route = useRoute();
const { user, updateUsername, reloginAsRandomUser, logout } = useUser();
const { locale, setLocale, t } = useI18n();

const showNameDialog = ref(false);
const pendingName = ref(user.value.username);

const title = computed(() => t(route.meta?.titleKey || "app.name"));
const elementLocale = computed(() => (locale.value === "zh" ? zhCn : en));

watchEffect(() => {
  document.title = title.value === t("app.name") ? t("app.name") : `${title.value} · ${t("app.name")}`;
});

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
  <el-config-provider :locale="elementLocale">
    <div class="app-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/">
        <span class="brand-mark">H</span>
        <span class="brand-name">Heigo Duel</span>
      </RouterLink>

      <h1 class="page-title">{{ title }}</h1>

      <label class="language-picker">
        <span class="sr-only">{{ t("app.language") }}</span>
        <select :value="locale" :aria-label="t('app.language')" @change="setLocale($event.target.value)">
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      </label>

      <el-dropdown trigger="click" class="user-menu">
        <button class="avatar-button" type="button">
          <span class="avatar-chip" :style="{ backgroundColor: user.avatar.color }">
            {{ user.avatar.emoji }}
          </span>
          <span class="username">{{ user.username }}</span>
        </button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item @click="openNameDialog">{{ t("app.editName") }}</el-dropdown-item>
            <el-dropdown-item @click="reloginAsRandomUser">{{ t("app.randomSignIn") }}</el-dropdown-item>
            <el-dropdown-item divided @click="logout">{{ t("app.signOut") }}</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </header>

    <main class="page-content">
      <RouterView />
    </main>

    <el-dialog v-model="showNameDialog" :title="t('app.editDisplayName')" width="420px">
      <el-input v-model="pendingName" maxlength="30" show-word-limit :placeholder="t('app.namePlaceholder')" />
      <template #footer>
        <el-button @click="showNameDialog = false">{{ t("app.cancel") }}</el-button>
        <el-button type="primary" @click="saveName">{{ t("app.save") }}</el-button>
      </template>
    </el-dialog>
    </div>
  </el-config-provider>
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
  grid-template-columns: auto 1fr auto auto;
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

.language-picker select {
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 999px;
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.12);
  color: #f3f9ff;
  cursor: pointer;
}

.language-picker option {
  color: #1f2937;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.avatar-button {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(255, 255, 255, 0.32);
  border-radius: 999px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.8);
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
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      "brand language user"
      "title title title";
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

  .language-picker {
    grid-area: language;
    justify-self: end;
  }

  .username {
    display: none;
  }
}
</style>
