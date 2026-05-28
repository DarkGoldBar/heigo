# Plan: Heigo 桌面游戏平台

## Overview
基于 Cloudflare Workers + Vue 3 + Element Plus 构建以聊天室为模型的桌面游戏平台，首款游戏 UNO。后端用 Durable Objects（WebSocket + SQLite 合一），前端不刷新页面切换游戏场景。

---

## Phase 1: 项目基础设施

### 1.1 Durable Objects 配置
- **wrangler.jsonc**: 添加 `durable_objects.bindings`（name: "ROOM", class_name: "RoomDurableObject"）和 `migrations`（new_sqlite_classes: ["RoomDurableObject"]）

### 1.2 服务端重构
- **server/room.js** (新建): `RoomDurableObject` 类
  - 构造函数中用 `this.ctx.storage.sql.exec()` 初始化 3 张表（roomInfo、messages、users）
  - `fetch()` 方法：WebSocket upgrade 或 REST
  - `webSocketMessage(ws, data)` 处理各类消息
  - `webSocketClose(ws, code, reason)` 处理断开
  - `alarm()` 处理 7 天 TTL 清理（`this.ctx.storage.deleteAll()`）
- **server/index.js** (重写):
  - export `RoomDurableObject` from `./room.js`
  - `POST /api/rooms` → 创建房间（初始化 DO，返回 roomId）
  - `GET /api/rooms/:roomId/ws` → 升级 WebSocket（转发至 DO）
  - 其余请求返回 404（静态资源由 Cloudflare Assets 处理）

### 1.3 SQLite Schema（每个 DO 实例独立）
```sql
-- roomInfo: 房间配置 key-value（含盘面）
CREATE TABLE IF NOT EXISTS roomInfo (key TEXT PRIMARY KEY, value TEXT);
-- 字段 keys:
--   roomId, gameType, hostUserId, rules(JSON), state(waiting/playing/ended)
--   annonce(JSON, 最新盘面内容，直接覆盖更新)

-- messages: 聊天+系统消息
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  msg_type TEXT NOT NULL DEFAULT 'chat', -- 'chat'|'system'|'game'
  created_at INTEGER NOT NULL
);

-- users: 房间用户信息与状态（用于断线重连）
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT NOT NULL,        -- JSON: {emoji, color}
  status TEXT NOT NULL DEFAULT 'online', -- 'online'|'offline'
  ready INTEGER NOT NULL DEFAULT 0,      -- 0=未准备 1=已准备
  joined_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
```

**annonce 读写方式**: `INSERT OR REPLACE INTO roomInfo (key, value) VALUES ('annonce', <JSON>)`，读取时 `SELECT value FROM roomInfo WHERE key = 'annonce'`。

### 1.4 前端基础
- **src/main.js**: 引入 Element Plus（`app.use(ElementPlus)`），引入 Element Plus 样式
- **src/App.vue**: 重写为 Topbar + `<router-view>` 布局
  - Topbar: 左-小 Logo（RouterLink to="/"）, 中-当前页面标题（provide/inject 或 route.meta.title）, 右-用户 Avatar 下拉菜单（登入/登出、编辑用户名）
- **src/composables/useUser.js** (新建):
  - localStorage key: `heigo_user`
  - 格式: `{ userid: uuidv4(), username: '玩家xxx', avatar: { emoji, color } }`
  - emoji 从 30 个预设游戏 emoji 随机选，color 从 12 个预设颜色随机选
  - 提供 `user`, `updateUsername(name)` 方法
  - UUID 生成用 `crypto.randomUUID()`

---

## Phase 2: 主页

- **src/views/HomeView.vue** (重写):
  - 大 Logo 区域（应用名 + 副标题）
  - 快速加入区：`el-input` 输入房间 ID + `el-button` 跳转 `/room/:id`
  - 游戏分类卡片区：`el-card` 网格，点击 → POST `/api/rooms` 创建房间 → 跳转 `/room/:roomId`
  - 当前阶段只有 UNO 一张卡片
- **src/router/index.js**: 添加 `{ path: '/room/:roomId', name: 'room', component: RoomView }`；删除 /about 路由；设置各路由 meta.title

---

## Phase 3: 房间页面 + WebSocket

### 3.1 WebSocket 客户端封装
- **src/composables/useWebSocket.js** (新建):
  - 连接 `wss://.../api/rooms/:roomId/ws?userId=...`
  - 重连逻辑：指数退避，最多 5 次
  - 暴露: `connected`, `roomState`, `messages`, `gameState`, `send(msg)`
  - 收到 `room_state` → 初始化完整状态
  - 收到 `game_started` → 触发场景切换事件

### 3.2 房间视图
- **src/views/RoomView.vue** (新建):
  - `scene` ref: `'lobby'` | `'game'`
  - `v-if="scene === 'lobby'"` → `<RoomLobby>`
  - `v-if="scene === 'game'"` → `<UnoGame>`（第一阶段只有 UNO）
  - 监听 WebSocket `game_started` 事件切换场景
  - onMounted: 连接 WebSocket，发送 `{ type: 'join', user }`
  - onUnmounted: 关闭 WebSocket

### 3.3 大厅组件
- **src/components/room/RoomLobby.vue** (新建):
  - 游戏名称标题
  - 规则/选项展示区（UNO 无特殊规则选项，占位即可）
  - 坐席列表（`el-avatar` + 用户名 + 准备状态标识）
  - 分享按钮（复制当前 URL）
  - 准备按钮（非房主，发送 `{ type: 'ready' }`）
  - 开始按钮（房主且所有人准备后，发送 `{ type: 'start' }`）
- **src/components/room/ChatPanel.vue** (新建):
  - 消息列表（`el-scrollbar`，新消息自动滚底）
  - 输入框 + 发送按钮（发送 `{ type: 'chat', content }`）
  - system/game 类型消息用不同样式

### 3.4 服务端 WebSocket 消息处理（在 room.js 中）
客户端 → 服务端:
- `join`: upsert 到 users 表（status='online'），若 roomInfo 无 hostUserId 则设为本用户；广播 `player_joined`，单播 `room_state`（全量，含 users 表所有行）
- `chat`: 写入 messages 表，重置 alarm 为 7 天后，广播 `message`
- `ready`: 更新 users 表中玩家 ready 字段，广播 `player_ready`
- `start`: 校验是房主 + 所有在线用户已准备 → 初始化游戏，写 roomInfo.annonce，广播 `game_started`
- **断线处理**（`webSocketClose`）: 更新 users 表 status='offline', last_seen=now；若离线用户是 hostUserId，则查询 users 表中第一个 status='online' 的用户，更新 roomInfo.hostUserId，广播 `host_changed`

---

## Phase 4: UNO 游戏

### 4.1 服务端游戏逻辑
- **server/games/uno.js** (新建):
  - `createDeck()`: 108 张标准牌（4色×数字0-9×各1/2张 + 跳过×8 + 反转×8 + +2×8 + 野牌×4 + 野+4×4）
  - `shuffle(deck)`: Fisher-Yates
  - `dealCards(players, deck)`: 每人发 7 张，翻开第一张
  - `isValidPlay(card, topCard, currentColor)`: 验证出牌合法性
  - `applyAction(gameState, playerId, action)`: 状态转换，返回新 gameState
  - `getPlayerView(gameState, playerId)`: 隐藏其他玩家手牌（只留数量）

- **gameState JSON 结构**（存入 roomInfo 的 annonce 字段）:
  ```json
  {
    "deck": [...],          // 剩余牌堆（只服务端维护）
    "discardTop": {...},    // 弃牌堆顶
    "currentColor": "red",
    "currentTurn": "userId",
    "direction": 1,         // 1=顺时针 -1=逆时针
    "pendingDraw": 0,       // +2/+4 累积
    "hands": { "userId": [...cards] },
    "finished": [],         // 已出完牌的玩家顺序
    "status": "playing"|"ended",
    "winner": null
  }
  ```

- **server/room.js** 中新增 `game_action` 处理:
  - 验证是当前玩家轮次
  - 调用 `applyAction()`
  - 写 roomInfo.annonce（`INSERT OR REPLACE` key='annonce'）
  - 向每个连接用 `getPlayerView()` 发送各自视角的 `game_state`
  - 若游戏结束，广播 `game_ended`，更新 roomInfo.state = 'ended'

### 4.2 UNO 游戏前端
- **src/components/games/UnoGame.vue** (新建):
  - 中央弃牌堆（显示顶牌）+ 颜色指示
  - 对手区域：环绕布局，显示 avatar + 牌背 × 手牌数量 + 轮次高亮
  - 自己手牌：底部横排，可点击出牌（合法牌高亮）
  - 摸牌按钮
  - 野牌选色对话框（`el-dialog` + 4 色按钮）
  - 游戏结束弹窗（显示获胜者，返回大厅按钮）
  - 右侧折叠聊天面板（复用 ChatPanel.vue）

---

## WebSocket 协议完整定义

客户端 → 服务端（所有消息带 userId）:
| type | payload |
|------|---------|
| join | `{ user: {userid, username, avatar} }` |
| chat | `{ content: string }` |
| ready | — |
| start | — |
| game_action | `{ action: {type:'play',card:{...},chosenColor?} \| {type:'draw'} }` |

服务端 → 客户端:
| type | payload | 发送范围 |
|------|---------|---------|
| room_state | `{ roomInfo, users, messages(last 50) }` | 单播（join 时） |
| player_joined | `{ user }` | 广播 |
| player_left | `{ userId }` | 广播 |
| player_ready | `{ userId, ready }` | 广播 |
| host_changed | `{ newHostUserId }` | 广播 |
| message | `{ id, userId, username, content, msgType, createdAt }` | 广播 |
| game_started | `{ gameState(player view) }` | 各自单播 |
| game_state | `{ gameState(player view) }` | 各自单播 |
| game_ended | `{ winner }` | 广播 |

---

## 文件变更清单

**修改:**
- `wrangler.jsonc` — 添加 DO binding + migration
- `server/index.js` — 重写：路由 + export DO
- `src/main.js` — 添加 Element Plus
- `src/App.vue` — 重写：Topbar 布局
- `src/router/index.js` — 添加 room 路由，移除 about
- `src/views/HomeView.vue` — 重写：主页内容

**新建:**
- `server/room.js` — RoomDurableObject
- `server/games/uno.js` — UNO 游戏逻辑
- `src/composables/useUser.js`
- `src/composables/useWebSocket.js`
- `src/views/RoomView.vue`
- `src/components/room/RoomLobby.vue`
- `src/components/room/ChatPanel.vue`
- `src/components/games/UnoGame.vue`

**删除:**
- `src/components/HelloWorld.vue`, `TheWelcome.vue`, `WelcomeItem.vue`, `icons/*`
- `src/views/AboutView.vue`

---

## Decisions
- 首期只做 UNO，游戏卡片页只有一个
- Avatar = emoji + 背景色，不存图片，仅随机生成存 localStorage
- 房主 = 第一个 join 的 userId；hostUserId 存在 roomInfo 表；断线时自动移交给 users 表中第一个在线用户
- annonce 作为 roomInfo 表的一个 key，存完整 gameState JSON，直接覆盖
- users 表持久化所有曾进入房间的用户，status 字段区分在线/离线，支持断线重连恢复状态
- 消息历史只保留最近 50 条用于初始化同步（messages 表本身完整）
- 不实现登录/账号系统，userId 存 localStorage 即为身份
- 右上角"登入/登出"在最小实现里等同于"新建随机用户" / 清除 localStorage

---

## 本轮完成内容（2026-05-28）

### 已完成

1. 项目基础设施（Phase 1）
- 已在 wrangler.jsonc 中添加 Durable Objects 绑定与 SQLite migration：
  - durable_objects.bindings: ROOM -> RoomDurableObject
  - migrations.new_sqlite_classes: ["RoomDurableObject"]
- 已重写 server/index.js：
  - POST /api/rooms 创建房间并初始化 DO
  - GET /api/rooms/:roomId/ws 转发 WebSocket 升级到 DO
  - 导出 RoomDurableObject

2. Room Durable Object 与房间协议（Phase 1 + Phase 3.4）
- 已新建 server/room.js，并实现 RoomDurableObject：
  - 初始化 3 张表：roomInfo / messages / users
  - fetch() 支持 /init REST 和 WebSocket upgrade
  - webSocketMessage() 处理 join/chat/ready/start/game_action
  - webSocketClose() 处理离线、广播 player_left、host 自动移交
  - alarm() 执行 this.ctx.storage.deleteAll()（7 天 TTL 清理）
- 已实现 roomInfo 的 annonce 读写（INSERT OR REPLACE）
- 已实现 room_state / player_joined / player_ready / host_changed / message / game_started / game_state / game_ended 消息流

3. UNO 后端逻辑（Phase 4.1）
- 已新建 server/games/uno.js，实现：
  - createDeck()（108 张）
  - shuffle()（Fisher-Yates）
  - dealCards()（每人 7 张 + 首张弃牌）
  - isValidPlay()
  - applyAction()（play/draw、方向、skip/reverse/+2/+4/wild、胜负）
  - getPlayerView()（隐藏其他玩家手牌，仅保留数量）
- game_action 已接入 room.js，并写回 roomInfo.annonce

4. 前端骨架与主页（Phase 1.4 + Phase 2）
- src/main.js 已接入 Element Plus 与样式
- src/App.vue 已重写为 Topbar + router-view
  - 左侧 Logo 跳转首页
  - 中间 route.meta.title 标题
  - 右侧用户头像下拉（改名/随机登入/登出）
- src/composables/useUser.js 已实现：
  - localStorage key: heigo_user
  - userid 使用 crypto.randomUUID()
  - 30 个 emoji + 12 个颜色随机头像
  - updateUsername(name)
- src/views/HomeView.vue 已重写：
  - 大 Logo 区域 + 快速加入
  - UNO 卡片创建房间并跳转
- src/router/index.js 已新增 /room/:roomId 并移除 /about

5. 房间页 + WebSocket 客户端（Phase 3）
- src/composables/useWebSocket.js 已实现：
  - 连接 /api/rooms/:roomId/ws?userId=...
  - 指数退避重连（最多 5 次）
  - 暴露 connected/roomState/messages/gameState/send
  - 处理 room_state 与 game_started/game_state
- src/views/RoomView.vue 已实现：
  - scene: lobby/game
  - lobby 渲染 RoomLobby + ChatPanel
  - game 渲染 UnoGame
  - mounted 自动连接并发送 join
  - unmounted 自动关闭连接

6. UNO 前端（Phase 4.2）
- src/components/games/UnoGame.vue 已实现：
  - 中央弃牌堆 + 当前颜色指示
  - 对手区（头像 + 手牌数量 + 当前回合高亮）
  - 自己手牌可点击出牌（合法性高亮）
  - 摸牌按钮
  - 野牌选色对话框
  - 结束弹窗（返回大厅）
  - 右侧复用 ChatPanel

7. 组件与模板清理
- 已新增：
  - src/components/room/RoomLobby.vue
  - src/components/room/ChatPanel.vue
  - src/views/RoomView.vue
  - src/composables/useWebSocket.js
  - src/composables/useUser.js
  - server/room.js
  - server/games/uno.js
- 已删除模板遗留文件：
  - src/components/HelloWorld.vue
  - src/components/TheWelcome.vue
  - src/components/WelcomeItem.vue
  - src/components/icons/*
  - src/views/AboutView.vue

### 验证结果
- 已执行 npm run build，两次构建均通过。
- 当前存在非阻断告警：
  - 前端产物 chunk 体积较大
  - 依赖库 pure annotation 提示（不影响构建成功）

### 与计划的差异说明
- 本轮将 Phase 1~4 的主干能力一次性打通到可运行状态，未严格按阶段逐步提交。
- 当前实现已满足首期 UNO 房间对战闭环；后续可继续做规则扩展、系统消息样式细化和打包体积优化。
