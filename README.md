# Heigo

Heigo 是一个基于 Vue 3 和 Cloudflare Durable Object 的实时多人房间游戏平台。目前支持 UNO 和 Gem Merchant 房间对战，包含房间创建、玩家加入、聊天、准备和游戏操作。

## 目录

- [Heigo](#heigo)
  - [目录](#目录)
  - [核心功能](#核心功能)
  - [架构概览](#架构概览)
  - [快速启动](#快速启动)
    - [生产构建](#生产构建)
    - [预览 / 发布](#预览--发布)
  - [接口说明](#接口说明)
    - [创建房间](#创建房间)
    - [WebSocket 连接](#websocket-连接)
  - [客户端 WebSocket 事件](#客户端-websocket-事件)
    - [客户端发送的消息类型](#客户端发送的消息类型)
    - [服务端推送的消息类型](#服务端推送的消息类型)
  - [代码结构](#代码结构)
  - [说明](#说明)

## 核心功能

- 房间创建与加入
- 实时房间状态同步
- 房间聊天系统
- 玩家准备与房主开始游戏
- UNO 对局状态管理
- Gem Merchant 宝石收集、卡牌购买、预留和终局结算

## 架构概览

前端部分：
- `Vue 3` + `Vite`
- `vue-router` 管理页面路由
- `Element Plus` 做基础 UI 组件
- 页面入口：`src/views/HomeView.vue`、`src/views/RoomView.vue`
- 客户端 WebSocket 连接逻辑：`src/composables/useWebSocket.js`

后端部分：
- Cloudflare Worker 入口：`server/index.js`
- Durable Object 用户、消息、房间状态存储：`server/room.js`
- 房间创建接口：`POST /api/rooms`
- 房间实时通信：`GET /api/rooms/:roomId/ws`

数据流：
1. 用户在首页创建或输入房间ID。
2. 前端调用 `POST /api/rooms` 创建房间。
3. 前端通过 WebSocket 连接 `GET /api/rooms/:roomId/ws?userId=...`。
4. Durable Object 管理房间内玩家、聊天和游戏状态，并广播事件。

## 快速启动

```sh
npm install
npm run dev
```

### 生产构建

```sh
npm run build
```

### 预览 / 发布

```sh
npm run preview
npm run deploy
```

## 接口说明

### 创建房间

- 方法：`POST /api/rooms`
- 请求头：`Content-Type: application/json`
- 请求 body：
  - `gameType`：字符串，支持 `uno`、`gem_merchant`
- 响应：
  - `201 Created`
  - 返回 JSON：`{ roomId, gameType }`

示例：

```json
POST /api/rooms
{
  "gameType": "uno"
}
```

```json
POST /api/rooms
{
  "gameType": "gem_merchant"
}
```

### WebSocket 连接

- 方法：`GET /api/rooms/:roomId/ws?userId=...`
- 说明：建立 WebSocket 连接后，客户端与 Durable Object 进行实时消息交换。
- 参数：
  - `roomId`：路径参数，房间 ID
  - `userId`：查询参数，可用于恢复用户会话；若不指定，后端会生成随机 ID

## 客户端 WebSocket 事件

### 客户端发送的消息类型

- `join`
  - payload: `{ user }`
  - 作用：进入房间并注册用户信息
- `chat`
  - payload: `{ content }`
  - 作用：发送聊天消息
- `ready`
  - payload: `{} 或 空`
  - 作用：将当前玩家标记为已准备
- `start`
  - payload: `{} 或 空`
  - 作用：房主启动游戏
- `game_action`
  - payload: `{ action }`
  - 作用：提交游戏操作（UNO 出牌、抽牌等）

### 服务端推送的消息类型

- `room_state`
  - payload: `{ roomInfo, users, messages }`
  - 作用：房间初始状态或全量状态同步
- `player_joined`
  - payload: `{ user }`
  - 作用：玩家加入通知
- `player_left`
  - payload: `{ userId }`
  - 作用：玩家离开通知
- `player_ready`
  - payload: `{ userId, ready }`
  - 作用：玩家准备状态更新
- `host_changed`
  - payload: `{ newHostUserId }`
  - 作用：房主转移通知
- `message`
  - payload: 消息对象
  - 作用：新聊天消息广播
- `game_started`
  - payload: `{ gameState }`
  - 作用：游戏开始通知
- `game_state`
  - payload: `{ gameState }`
  - 作用：游戏状态更新
- `game_ended`
  - payload: `{ winner }`
  - 作用：游戏结束通知
- `error`
  - payload: `{ message }`
  - 作用：错误信息反馈

## 代码结构

- `index.html` - 应用入口 HTML
- `vite.config.js` - Vite 配置
- `package.json` - 依赖与脚本
- `src/main.js` - Vue 应用挂载
- `src/App.vue` - 应用框架与导航
- `src/router/index.js` - 路由配置
- `src/views/HomeView.vue` - 首页房间创建/加入
- `src/views/RoomView.vue` - 房间大厅与游戏页面
- `src/composables/useWebSocket.js` - WebSocket 通信与事件处理
- `server/index.js` - API 路由与房间 Durable Object 调用
- `server/room.js` - 房间生命周期、消息广播、游戏逻辑入口

## 说明

当前版本支持 UNO 与 Gem Merchant 房间玩法，后续可以扩展更多游戏类型、房间规则和匹配机制。
