import { inject, ref } from "vue";

const I18N_KEY = Symbol("heigo-duel-i18n");
const STORAGE_KEY = "heigo_duel_locale";

const messages = {
  en: {
    app: {
      name: "Heigo Duel",
      editName: "Edit Name",
      randomSignIn: "Sign In (Random)",
      signOut: "Sign Out",
      editDisplayName: "Edit Display Name",
      namePlaceholder: "Input a name",
      cancel: "Cancel",
      save: "Save",
      language: "Language",
    },
    routes: { home: "Home", room: "Room" },
    home: {
      subtitle: "A real-time room based game platform. Start with UNO and grow later.",
      roomIdPlaceholder: "Input Room ID",
      quickJoin: "Quick Join",
      gameLobby: "Game Lobby",
      availableNow: "Available now",
      unoDescription: "Classic color matching card game for 2+ players.",
      gemMerchant: "Gem Merchant",
      gemDescription: "Collect gems, buy developments, and race to 15 points.",
      createRoom: "Create Room",
      createRoomError: "Failed to create room",
    },
    common: {
      live: "Live",
      connected: "Connected",
      offline: "Offline",
      online: "online",
      ready: "Ready",
      notReady: "Not ready",
      host: "Host",
      players: "Players",
      waiting: "Waiting",
      yourTurn: "Your turn",
      gameEnded: "Game Ended",
      backToLobby: "Back to Lobby",
      winner: "Winner: {name}",
      none: "None",
      unknown: "unknown",
      points: "{count} VP",
    },
    lobby: {
      room: "Room",
      roomId: "ID: {id}",
      unoTitle: "UNO Lobby",
      gemTitle: "Gem Merchant Lobby",
      rules: "Rules",
      unoRules: "Classic UNO. Match by color or value. Wild cards pick color. First empty hand wins.",
      gemRules: "Collect gems, buy development cards, reserve cards for gold, and trigger the final round at 15 points.",
      copyInvite: "Copy Invite Link",
      startGame: "Start Game",
    },
    chat: {
      title: "Room Chat",
      placeholder: "Send a message",
      send: "Send",
    },
    uno: {
      title: "UNO Match",
      discardTop: "Discard Top",
      currentColor: "Current Color",
      deck: "Deck: {count}",
      pendingDraw: "Pending Draw: {count}",
      drawCard: "Draw Card",
      cards: "Cards: {count}",
      pickColor: "Pick Color",
      winner: "The winner is {name}",
      cardsMap: { skip: "Skip", reverse: "Reverse", wild: "Wild" },
      colorNames: { red: "Red", yellow: "Yellow", green: "Green", blue: "Blue" },
    },
    colors: {
      white: "white",
      blue: "blue",
      green: "green",
      red: "red",
      black: "black",
      gold: "gold",
      yellow: "yellow",
    },
    gem: {
      title: "Gem Merchant",
      playerTurn: "{name}'s turn",
      actNow: "Act now",
      finalRound: "Final Round",
      discardCount: "Discard {count}",
      bank: "Bank",
      turnEnd: "Turn End",
      discardGems: "Discard Gems",
      discard: "Discard",
      market: "Market",
      tier: "Tier {tier}",
      deck: "Deck ({count})",
      emptyDeck: "No cards left in this deck.",
      reserve: "Reserve",
      buy: "Buy",
      nobles: "Nobles",
      playerSummary: "Reserved: {reserved} / Nobles: {nobles}",
      reservedCards: "Your Reserved Cards",
      noReservedCards: "No reserved cards.",
    },
  },
  zh: {
    app: {
      name: "Heigo Duel",
      editName: "修改名称",
      randomSignIn: "随机身份登录",
      signOut: "退出登录",
      editDisplayName: "修改显示名称",
      namePlaceholder: "请输入名称",
      cancel: "取消",
      save: "保存",
      language: "语言",
    },
    routes: { home: "首页", room: "房间" },
    home: {
      subtitle: "一个基于房间的实时游戏平台，从 UNO 开始，更多游戏敬请期待。",
      roomIdPlaceholder: "请输入房间 ID",
      quickJoin: "快速加入",
      gameLobby: "游戏大厅",
      availableNow: "当前可玩",
      unoDescription: "适合 2 人及以上的经典颜色匹配卡牌游戏。",
      gemMerchant: "宝石商人",
      gemDescription: "收集宝石、购买发展卡，率先获得 15 分。",
      createRoom: "创建房间",
      createRoomError: "创建房间失败",
    },
    common: {
      live: "在线",
      connected: "已连接",
      offline: "离线",
      online: "在线",
      ready: "已准备",
      notReady: "未准备",
      host: "房主",
      players: "玩家",
      waiting: "等待中",
      yourTurn: "轮到你了",
      gameEnded: "游戏结束",
      backToLobby: "返回大厅",
      winner: "获胜者：{name}",
      none: "无",
      unknown: "未知",
      points: "{count} 分",
    },
    lobby: {
      room: "房间",
      roomId: "房间 ID：{id}",
      unoTitle: "UNO 大厅",
      gemTitle: "宝石商人大厅",
      rules: "规则",
      unoRules: "经典 UNO：按颜色或牌面出牌，万能牌可指定颜色，最先出完手牌者获胜。",
      gemRules: "收集宝石、购买发展卡，也可预留卡牌并获得黄金；达到 15 分后触发最终回合。",
      copyInvite: "复制邀请链接",
      startGame: "开始游戏",
    },
    chat: {
      title: "房间聊天",
      placeholder: "发送消息",
      send: "发送",
    },
    uno: {
      title: "UNO 对局",
      discardTop: "弃牌堆顶",
      currentColor: "当前颜色",
      deck: "牌库：{count}",
      pendingDraw: "待摸牌数：{count}",
      drawCard: "摸牌",
      cards: "手牌：{count}",
      pickColor: "选择颜色",
      winner: "获胜者是 {name}",
      cardsMap: { skip: "跳过", reverse: "反转", wild: "万能" },
      colorNames: { red: "红色", yellow: "黄色", green: "绿色", blue: "蓝色" },
    },
    colors: {
      white: "白色",
      blue: "蓝色",
      green: "绿色",
      red: "红色",
      black: "黑色",
      gold: "黄金",
      yellow: "黄色",
    },
    gem: {
      title: "宝石商人",
      playerTurn: "轮到 {name}",
      actNow: "请行动",
      finalRound: "最终回合",
      discardCount: "需弃掉 {count} 枚",
      bank: "宝石银行",
      turnEnd: "结束回合",
      discardGems: "弃掉宝石",
      discard: "确认弃掉",
      market: "市场",
      tier: "等级 {tier}",
      deck: "牌库（{count}）",
      emptyDeck: "此牌库已没有卡牌。",
      reserve: "预留",
      buy: "购买",
      nobles: "贵族",
      playerSummary: "预留：{reserved} / 贵族：{nobles}",
      reservedCards: "你预留的卡牌",
      noReservedCards: "暂无预留卡牌。",
    },
  },
};

function initialLocale() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "en" || stored === "zh") {
    return stored;
  }
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function lookup(locale, key) {
  return key.split(".").reduce((value, part) => value?.[part], messages[locale]);
}

function interpolate(message, params) {
  return message.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

export function createI18n() {
  const locale = ref(initialLocale());

  function setLocale(nextLocale) {
    if (nextLocale !== "en" && nextLocale !== "zh") {
      return;
    }
    locale.value = nextLocale;
    localStorage.setItem(STORAGE_KEY, nextLocale);
    document.documentElement.lang = nextLocale === "zh" ? "zh-CN" : "en";
  }

  function t(key, params = {}) {
    const value = lookup(locale.value, key) ?? lookup("en", key) ?? key;
    return typeof value === "string" ? interpolate(value, params) : key;
  }

  setLocale(locale.value);
  const api = { locale, setLocale, t };

  return {
    install(app) {
      app.provide(I18N_KEY, api);
    },
  };
}

export function useI18n() {
  const i18n = inject(I18N_KEY);
  if (!i18n) {
    throw new Error("i18n plugin is not installed");
  }
  return i18n;
}
