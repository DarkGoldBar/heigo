import { computed, ref } from "vue";

const STORAGE_KEY = "heigo_user";

const EMOJIS = [
  "🎮",
  "🎲",
  "🃏",
  "🕹️",
  "🚀",
  "🧩",
  "🎯",
  "🏆",
  "🐯",
  "🦊",
  "🐼",
  "🐨",
  "🐸",
  "🐧",
  "🦄",
  "🌟",
  "🔥",
  "⚡",
  "🌈",
  "🍀",
  "🍕",
  "🍩",
  "🍎",
  "🍓",
  "🎈",
  "🎵",
  "📚",
  "🛡️",
  "🔮",
  "🪐",
];

const COLORS = [
  "#e76f51",
  "#f4a261",
  "#e9c46a",
  "#2a9d8f",
  "#264653",
  "#457b9d",
  "#1d3557",
  "#ff6b6b",
  "#06d6a0",
  "#118ab2",
  "#ef476f",
  "#ffd166",
];

const userState = ref(loadOrCreateUser());

function randomOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createRandomUser() {
  return {
    userid: crypto.randomUUID(),
    username: `Player-${Math.floor(Math.random() * 900 + 100)}`,
    avatar: {
      emoji: randomOf(EMOJIS),
      color: randomOf(COLORS),
    },
  };
}

function saveUser(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

function loadOrCreateUser() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.userid === "string" &&
        typeof parsed.username === "string" &&
        parsed.avatar &&
        typeof parsed.avatar.emoji === "string" &&
        typeof parsed.avatar.color === "string"
      ) {
        return parsed;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  const user = createRandomUser();
  saveUser(user);
  return user;
}

export function useUser() {
  const user = computed(() => userState.value);

  function updateUsername(name) {
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      return;
    }
    userState.value = {
      ...userState.value,
      username: trimmed.slice(0, 30),
    };
    saveUser(userState.value);
  }

  function reloginAsRandomUser() {
    userState.value = createRandomUser();
    saveUser(userState.value);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    userState.value = createRandomUser();
    saveUser(userState.value);
  }

  return {
    user,
    updateUsername,
    reloginAsRandomUser,
    logout,
  };
}
