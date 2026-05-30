下面这份可以直接作为给 Copilot Agent 的“游戏逻辑理解说明”。我会尽量按代码实现需要来梳理，而不是只讲桌游规则。

---

# 新游戏：宝石商人 / 璀璨宝石 游戏运行逻辑说明

本项目当前已有 UNO 的房间、玩家、准备、开始游戏、`game_action`、`game_state` 推送机制。新增“宝石商人”时，可以沿用现有房间架构，只需要在 `gameType` 和 `gameState` 层面新增一套游戏逻辑。

建议内部 gameType 使用：

```js
"gem_merchant"
```

---

# 一、游戏核心概念

“宝石商人”是一个回合制资源收集与卡牌购买游戏。

玩家通过拿取宝石，购买发展卡。发展卡会提供永久宝石折扣和分数。玩家积累足够的卡牌资源后，还可以获得贵族奖励。游戏目标是率先达到指定分数，通常是 15 分。达到条件后，本轮继续到最后一名玩家行动结束，然后比较分数决定胜者。

---

# 二、基本组件

游戏中主要有以下资源：

## 1. 宝石 Token

共有 6 种：

```js
const GEM_TYPES = ["white", "blue", "green", "red", "black", "gold"];
```

其中：

```js
gold
```

是万能宝石，可以替代任意颜色支付。

五种普通宝石：

```js
white
blue
green
red
black
```

分别对应五种卡牌颜色。

## 2. 发展卡 Development Card

每张发展卡包含：

```js
{
  id: string,
  tier: 1 | 2 | 3,
  color: "white" | "blue" | "green" | "red" | "black",
  points: number,
  cost: {
    white: number,
    blue: number,
    green: number,
    red: number,
    black: number
  }
}
```

发展卡有三个等级：

```js
tier 1 // 低级卡
tier 2 // 中级卡
tier 3 // 高级卡
```

游戏开始时，每个等级各自洗牌，并在桌面公开 4 张。

## 3. 贵族 Noble

贵族相当于额外奖励。玩家拥有足够数量的永久发展卡后，可以获得贵族。

贵族结构：

```js
{
  id: string,
  points: 3,
  requirement: {
    white: number,
    blue: number,
    green: number,
    red: number,
    black: number
  }
}
```

例如：

```js
{
  id: "noble_1",
  points: 3,
  requirement: {
    white: 4,
    blue: 4,
    green: 0,
    red: 0,
    black: 0
  }
}
```

表示玩家只要拥有 4 张白色发展卡和 4 张蓝色发展卡，就可以获得该贵族。

## 4. 玩家状态 Player State

每个玩家在游戏中的状态可以设计为：

```js
{
  userId: string,
  name: string,

  gems: {
    white: number,
    blue: number,
    green: number,
    red: number,
    black: number,
    gold: number
  },

  cards: {
    white: DevelopmentCard[],
    blue: DevelopmentCard[],
    green: DevelopmentCard[],
    red: DevelopmentCard[],
    black: DevelopmentCard[]
  },

  reservedCards: DevelopmentCard[],

  nobles: Noble[],

  score: number
}
```

其中：

```js
score = 发展卡分数总和 + 贵族分数总和
```

也可以每次行动后动态计算，不一定要长期存储。

---

# 三、游戏人数与初始宝石数量

根据玩家数量，桌面宝石数量不同。

建议规则：

```js
2人游戏：每种普通宝石 4 个，黄金 5 个
3人游戏：每种普通宝石 5 个，黄金 5 个
4人游戏：每种普通宝石 7 个，黄金 5 个
```

初始化函数可以根据玩家数生成：

```js
function getInitialBankGems(playerCount) {
  const normalGemCount =
    playerCount === 2 ? 4 :
    playerCount === 3 ? 5 :
    7;

  return {
    white: normalGemCount,
    blue: normalGemCount,
    green: normalGemCount,
    red: normalGemCount,
    black: normalGemCount,
    gold: 5
  };
}
```

---

# 四、游戏初始化流程

房主发送：

```js
{
  type: "start"
}
```

服务端判断：

1. 房间人数是否在 2 到 4 人之间。
2. 所有玩家是否已准备。
3. 当前房间是否已经在游戏中。

然后初始化 `gameState`。

建议结构：

```js
{
  gameType: "gem_merchant",
  status: "playing",

  players: [
    {
      userId,
      name,
      gems,
      cards,
      reservedCards,
      nobles,
      score
    }
  ],

  currentPlayerIndex: 0,

  bankGems: {
    white: number,
    blue: number,
    green: number,
    red: number,
    black: number,
    gold: number
  },

  decks: {
    tier1: DevelopmentCard[],
    tier2: DevelopmentCard[],
    tier3: DevelopmentCard[]
  },

  market: {
    tier1: DevelopmentCard[],
    tier2: DevelopmentCard[],
    tier3: DevelopmentCard[]
  },

  nobles: Noble[],

  finalRoundTriggered: false,
  finalRoundTriggerUserId: null,
  finalRoundLastPlayerIndex: null,

  winnerUserIds: []
}
```

初始化时需要：

1. 洗牌三个等级的发展卡牌堆。
2. 每个等级翻开 4 张到市场。
3. 根据人数抽取贵族。通常是玩家人数 + 1 个贵族。
4. 初始化每个玩家的宝石、发展卡、预留卡、贵族、分数。
5. 设置当前玩家为第一个玩家。
6. 广播 `game_started` 或 `game_state`。

---

# 五、玩家每回合可以做的动作

每个玩家的回合只能执行以下动作之一：

1. 拿 3 个不同颜色的普通宝石。
2. 拿 2 个相同颜色的普通宝石。
3. 购买一张公开发展卡。
4. 购买一张自己预留的发展卡。
5. 预留一张公开发展卡。
6. 预留一张牌堆顶端的隐藏发展卡。

执行完动作后：

1. 检查玩家宝石总数是否超过 10。
2. 如果超过 10，需要弃宝石到 10 个。
3. 检查是否获得贵族。
4. 检查是否触发终局。
5. 切换到下一位玩家。
6. 广播新的 `game_state`。

为了简化前后端交互，建议每个动作都通过现有 `game_action` 发送。

---

# 六、动作一：拿 3 个不同颜色宝石

客户端发送：

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "take_gems",
      gems: {
        white: 1,
        blue: 1,
        green: 1
      }
    }
  }
}
```

合法性判断：

1. 当前用户必须是当前回合玩家。
2. 只能拿普通宝石，不能拿 `gold`。
3. 必须正好拿 3 个。
4. 三个宝石颜色必须不同。
5. 银行中对应颜色宝石数量必须足够。

合法后：

```js
player.gems[color] += count;
bankGems[color] -= count;
```

---

# 七、动作二：拿 2 个相同颜色宝石

客户端发送：

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "take_gems",
      gems: {
        red: 2
      }
    }
  }
}
```

合法性判断：

1. 当前用户必须是当前回合玩家。
2. 只能拿普通宝石，不能拿 `gold`。
3. 必须正好拿 2 个。
4. 两个宝石必须是同一种颜色。
5. 银行中该颜色宝石在拿取前必须至少有 4 个。

注意：这里不是“银行里有 2 个就能拿”，而是该颜色宝石剩余数量必须大于等于 4，才允许拿两个。

---

# 八、动作三：购买公开发展卡

客户端发送：

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "buy_card",
      source: "market",
      tier: 1,
      cardId: "tier1_card_12",
      payment: {
        white: 0,
        blue: 1,
        green: 0,
        red: 2,
        black: 0,
        gold: 1
      }
    }
  }
}
```

## 购买成本计算

玩家已经购买的发展卡会提供永久折扣。

例如玩家已有：

```js
cards.white.length = 2
cards.blue.length = 1
```

则所有购买成本中：

```js
white cost - 2
blue cost - 1
```

最低不能低于 0。

计算函数可以类似：

```js
function getDiscount(player) {
  return {
    white: player.cards.white.length,
    blue: player.cards.blue.length,
    green: player.cards.green.length,
    red: player.cards.red.length,
    black: player.cards.black.length
  };
}
```

实际成本：

```js
actualCost[color] = Math.max(0, card.cost[color] - discount[color]);
```

如果普通宝石不够，可以用 `gold` 补足。

合法性判断：

1. 当前用户必须是当前回合玩家。
2. 卡牌必须存在于对应市场。
3. 玩家支付的普通宝石和黄金必须足够覆盖实际成本。
4. 玩家不能支付自己没有的宝石。
5. 支付总额必须等于实际成本，不能多付。
6. 购买后卡牌加入玩家对应颜色的发展卡区。
7. 银行收回支付的宝石。
8. 市场空位从对应等级牌堆补一张。如果牌堆为空，则市场少于 4 张也可以。

购买成功后：

```js
player.cards[card.color].push(card);
```

然后从 `market[tier]` 移除该卡。

再从 `decks[tier]` 补一张：

```js
if (deck.length > 0) {
  market[tier].push(deck.shift());
}
```

---

# 九、动作四：购买预留发展卡

玩家最多可以预留 3 张卡。预留卡不会公开给其他玩家，也可以简化为只隐藏正面信息，取决于前端设计。

购买预留卡时：

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "buy_card",
      source: "reserved",
      cardId: "tier2_card_05",
      payment: {
        white: 2,
        blue: 0,
        green: 1,
        red: 0,
        black: 0,
        gold: 2
      }
    }
  }
}
```

合法性判断：

1. 当前用户必须是当前回合玩家。
2. 卡牌必须存在于当前玩家的 `reservedCards` 中。
3. 按照与购买公开卡相同的方式检查费用。
4. 购买成功后，从 `reservedCards` 移除，加入玩家发展卡区。

购买预留卡时不需要补市场，因为它不是从市场买走的。

---

# 十、动作五：预留公开发展卡

客户端发送：

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "reserve_card",
      source: "market",
      tier: 2,
      cardId: "tier2_card_09"
    }
  }
}
```

合法性判断：

1. 当前用户必须是当前回合玩家。
2. 玩家当前预留卡数量必须小于 3。
3. 指定卡牌必须存在于市场。
4. 将该卡从市场移到玩家 `reservedCards`。
5. 如果银行还有黄金宝石，则玩家获得 1 个 `gold`。
6. 对应等级市场从牌堆补一张。

注意：即使银行没有黄金，也可以预留卡，只是拿不到黄金。

---

# 十一、动作六：预留隐藏发展卡

玩家也可以从某个等级的牌堆顶部预留一张隐藏卡。

客户端发送：

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "reserve_card",
      source: "deck",
      tier: 3
    }
  }
}
```

合法性判断：

1. 当前用户必须是当前回合玩家。
2. 玩家预留卡数量必须小于 3。
3. 对应等级牌堆必须还有卡。
4. 从牌堆顶部取一张放入玩家 `reservedCards`。
5. 如果银行有黄金，玩家获得 1 个黄金。

这个动作不影响市场公开卡。

---

# 十二、宝石上限规则

玩家回合结束时，宝石总数不能超过 10。

宝石总数包括：

```js
white + blue + green + red + black + gold
```

如果行动后超过 10，需要弃掉多余宝石。

实现上有两种方式。

## 方案 A：严格规则

如果行动后宝石超过 10，则服务端返回一个状态：

```js
pendingDiscard
```

例如：

```js
{
  pendingDiscard: {
    userId: "u1",
    needDiscardCount: 2
  }
}
```

此时该玩家必须发送：

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "discard_gems",
      gems: {
        white: 1,
        gold: 1
      }
    }
  }
}
```

服务端检查弃牌合法后，再进入下一位玩家回合。

## 方案 B：简化规则

前端在玩家选择拿宝石时就限制不能超过 10。这样实现简单，但不完全符合桌游体验。

建议采用方案 A，因为逻辑更完整，也适合多人实时状态同步。

---

# 十三、贵族获得规则

每个玩家回合结束后，检查玩家是否满足贵族要求。

判断依据不是宝石数量，而是玩家已经购买的发展卡数量。

例如：

```js
noble.requirement = {
  white: 3,
  blue: 3,
  green: 3,
  red: 0,
  black: 0
}
```

玩家如果拥有：

```js
player.cards.white.length >= 3
player.cards.blue.length >= 3
player.cards.green.length >= 3
```

则满足条件。

玩家获得贵族后：

1. 从公共贵族区移除该贵族。
2. 加入玩家 `nobles`。
3. 玩家获得贵族分数，一般是 3 分。

如果一个玩家同时满足多个贵族条件，正式规则通常是本回合只能获得一个贵族。可以让玩家选择，也可以自动给一个。

为了降低实现复杂度，建议第一版自动获得第一个满足条件的贵族：

```js
const availableNoble = nobles.find(noble => canTakeNoble(player, noble));
```

然后：

```js
player.nobles.push(availableNoble);
remove noble from gameState.nobles;
```

后续如果要完善，可以加入 `pendingChooseNoble` 状态，让玩家从多个满足条件的贵族中选择一个。

---

# 十四、分数计算

玩家分数来自两部分：

1. 已购买发展卡的 `points`
2. 已获得贵族的 `points`

建议写成函数，不要依赖手动维护：

```js
function calculateScore(player) {
  const cardPoints = Object.values(player.cards)
    .flat()
    .reduce((sum, card) => sum + card.points, 0);

  const noblePoints = player.nobles
    .reduce((sum, noble) => sum + noble.points, 0);

  return cardPoints + noblePoints;
}
```

每次广播 `game_state` 前，可以重新计算每个玩家的 `score`。

---

# 十五、终局触发与胜负判定

当某个玩家的分数达到或超过 15 分时，触发终局。

但是游戏不是立刻结束，而是继续进行到当前轮最后一名玩家行动结束，保证所有玩家行动次数相同。

例如 4 人游戏：

```js
players = [A, B, C, D]
```

如果 B 达到 15 分：

1. 设置 `finalRoundTriggered = true`
2. 设置 `finalRoundTriggerUserId = B`
3. 本轮继续
4. C 行动
5. D 行动
6. D 行动结束后游戏结束

如果 D 达到 15 分，则 D 是本轮最后一名玩家，D 行动结束后可以立即结算。

可以保存：

```js
finalRoundLastPlayerIndex = players.length - 1
```

当 `currentPlayerIndex` 行动结束并且它是最后一个玩家时，进入结算。

胜者判断：

1. 分数最高者获胜。
2. 如果分数相同，购买发展卡数量更少者获胜。
3. 如果仍然相同，可以并列获胜。

判断逻辑：

```js
function determineWinners(players) {
  const maxScore = Math.max(...players.map(calculateScore));
  const candidates = players.filter(p => calculateScore(p) === maxScore);

  const minCardCount = Math.min(...candidates.map(getPurchasedCardCount));
  return candidates.filter(p => getPurchasedCardCount(p) === minCardCount);
}
```

游戏结束后：

```js
gameState.status = "ended";
gameState.winnerUserIds = winners.map(p => p.userId);
```

然后广播：

```js
{
  type: "game_ended",
  payload: {
    winners,
    gameState
  }
}
```

---

# 十六、回合切换逻辑

每次完整行动结束后调用：

```js
function advanceTurn(gameState) {
  gameState.currentPlayerIndex =
    (gameState.currentPlayerIndex + 1) % gameState.players.length;
}
```

但是如果存在 `pendingDiscard` 或 `pendingChooseNoble`，不能切换回合。

建议流程：

```js
handleAction(action) {
  validateCurrentPlayer();

  switch(action.type) {
    case "take_gems":
      handleTakeGems();
      break;

    case "buy_card":
      handleBuyCard();
      break;

    case "reserve_card":
      handleReserveCard();
      break;

    case "discard_gems":
      handleDiscardGems();
      break;

    case "choose_noble":
      handleChooseNoble();
      break;
  }

  if (hasPendingStep(gameState)) {
    broadcastGameState();
    return;
  }

  resolveNobleIfNeeded();

  if (hasPendingStep(gameState)) {
    broadcastGameState();
    return;
  }

  checkFinalRoundOrEndGame();

  if (gameState.status !== "ended") {
    advanceTurn();
  }

  broadcastGameState();
}
```

第一版如果不做贵族选择，可以省略 `choose_noble`。

---

# 十七、推荐的客户端动作类型

建议新增以下 action types：

```js
"take_gems"
"buy_card"
"reserve_card"
"discard_gems"
"choose_noble"
```

完整示例：

## 拿宝石

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "take_gems",
      gems: {
        white: 1,
        blue: 1,
        green: 1
      }
    }
  }
}
```

## 购买市场卡

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "buy_card",
      source: "market",
      tier: 1,
      cardId: "card_001",
      payment: {
        white: 1,
        blue: 0,
        green: 0,
        red: 2,
        black: 0,
        gold: 1
      }
    }
  }
}
```

## 购买预留卡

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "buy_card",
      source: "reserved",
      cardId: "card_045",
      payment: {
        white: 0,
        blue: 2,
        green: 1,
        red: 0,
        black: 0,
        gold: 0
      }
    }
  }
}
```

## 预留市场卡

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "reserve_card",
      source: "market",
      tier: 2,
      cardId: "card_087"
    }
  }
}
```

## 预留牌堆顶卡

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "reserve_card",
      source: "deck",
      tier: 3
    }
  }
}
```

## 弃宝石

```js
{
  type: "game_action",
  payload: {
    action: {
      type: "discard_gems",
      gems: {
        red: 1,
        gold: 1
      }
    }
  }
}
```

---

# 十八、服务端需要重点校验的规则

因为这是多人实时游戏，不能相信客户端。服务端必须校验：

1. 是否是当前玩家行动。
2. 游戏是否处于 `playing` 状态。
3. 玩家是否处于 `pendingDiscard` 等特殊状态。
4. 宝石拿取是否合法。
5. 购买卡牌时卡是否存在。
6. 玩家支付是否足够。
7. 玩家是否试图支付不存在的宝石。
8. 玩家预留卡是否超过 3 张。
9. 银行宝石数量不能为负数。
10. 玩家宝石数量不能为负数。
11. 市场补牌不能从空牌堆取牌。
12. 贵族不能被重复获得。
13. 游戏结束后不能继续行动。

---

# 十九、前端 UI 需要显示的内容

在 `RoomView.vue` 或独立的 `GemMerchantGame.vue` 中，建议显示：

## 公共区域

1. 银行宝石数量。
2. 三个等级的公开市场卡，每个等级最多 4 张。
3. 公共贵族列表。
4. 当前回合玩家。
5. 是否进入终局轮。

## 玩家区域

每个玩家显示：

1. 玩家名称。
2. 当前分数。
3. 当前宝石数量。
4. 已购买发展卡数量，按颜色显示。
5. 贵族数量或贵族列表。
6. 预留卡数量。

当前用户自己的区域额外显示：

1. 预留卡详情。
2. 可执行操作按钮。
3. 支付选择器。
4. 弃宝石选择器。

---

# 二十、建议的服务端文件组织

当前 README 中提到游戏逻辑入口在：

```txt
server/room.js
```

如果 UNO 逻辑已经写在 `server/room.js` 中，新增游戏时建议不要继续把所有逻辑塞进去。

可以考虑新增：

```txt
server/games/uno.js
server/games/gemMerchant.js
server/games/index.js
```

`server/games/index.js`：

```js
import * as uno from "./uno.js";
import * as gemMerchant from "./gemMerchant.js";

export function createInitialGameState(gameType, users) {
  if (gameType === "uno") {
    return uno.createInitialGameState(users);
  }

  if (gameType === "gem_merchant") {
    return gemMerchant.createInitialGameState(users);
  }

  throw new Error(`Unsupported game type: ${gameType}`);
}

export function handleGameAction(gameState, userId, action) {
  if (gameState.gameType === "uno") {
    return uno.handleGameAction(gameState, userId, action);
  }

  if (gameState.gameType === "gem_merchant") {
    return gemMerchant.handleGameAction(gameState, userId, action);
  }

  throw new Error(`Unsupported game type: ${gameState.gameType}`);
}
```

这样以后继续加游戏会比较清晰。

---

# 二十一、第一版实现范围建议

为了让 Copilot Agent 不要一次写得太复杂，第一版可以实现以下规则：

必须实现：

1. 2 到 4 人开始游戏。
2. 三个等级卡牌市场。
3. 宝石银行。
4. 拿 3 个不同宝石。
5. 拿 2 个相同宝石。
6. 购买公开卡。
7. 预留公开卡。
8. 购买预留卡。
9. 宝石上限 10。
10. 贵族自动获得。
11. 15 分终局。
12. 胜者判定。

可以暂时简化：

1. 贵族多选时自动拿第一个。
2. 不做复杂动画。
3. 不做 AI 玩家。
4. 不做断线后隐藏信息保护。
5. 不做完整官方卡池，可以先写一组测试卡池。

---

# 二十二、给 Copilot Agent 的简短任务描述

你可以把下面这一段直接贴给 Copilot Agent：

```txt
请在当前 Heigo 项目中新增一个游戏类型 gem_merchant，也就是宝石商人/璀璨宝石类的回合制游戏。不要破坏现有 UNO 逻辑。

游戏沿用现有房间、ready、start、game_action、game_state WebSocket 架构。新增游戏逻辑应支持 2-4 人。

核心状态包括：players、currentPlayerIndex、bankGems、decks、market、nobles、finalRoundTriggered、winnerUserIds。

资源包括 white、blue、green、red、black 五种普通宝石，以及 gold 万能宝石。发展卡有 tier 1/2/3，每张卡有 color、points、cost。玩家购买的发展卡提供对应颜色的永久折扣。贵族根据玩家已购买卡牌颜色数量自动获得，每个贵族 3 分。

玩家每回合只能执行一个主要动作：
1. take_gems：拿 3 个不同普通宝石，或在银行该颜色至少有 4 个时拿 2 个相同普通宝石。
2. buy_card：购买市场卡或自己的预留卡。费用需要扣除玩家已有发展卡折扣，gold 可以补任意颜色。
3. reserve_card：预留市场卡或某等级牌堆顶卡。玩家最多预留 3 张。预留时如果银行还有 gold，则获得 1 个 gold。
4. discard_gems：如果行动后宝石总数超过 10，需要弃到 10 个后才能结束回合。

每个动作必须由服务端校验合法性，不能信任客户端。行动完成后检查宝石上限、贵族获得、15 分终局、切换回合并广播 game_state。

终局规则：玩家达到 15 分后触发 final round，继续到本轮最后一名玩家行动结束。结算时分数最高者获胜；若同分，购买发展卡数量更少者获胜；仍相同则并列获胜。

请尽量把 gem_merchant 的游戏逻辑单独放在 server/games/gemMerchant.js 中，并通过统一入口根据 gameType 分发，不要把所有逻辑都塞进 room.js。
```

---

# 二十三、实现时最容易出错的地方

重点提醒 Copilot Agent 注意这些边界：

1. `gold` 不能被主动拿取，只能通过预留卡获得。
2. 拿两个同色宝石时，银行该颜色必须至少有 4 个。
3. 购买卡时，玩家的发展卡提供的是永久折扣，不是一次性消耗。
4. 贵族判断看的是已购买发展卡数量，不是当前宝石数量。
5. 玩家最多只能预留 3 张卡，预留达到 3 张则禁止使用预留功能。
6. 玩家行动结束后宝石不能超过 10，在行动结束阶段超过 10 个宝石时，选择并丢弃宝石直到 10 个。
7. 市场补牌时，牌堆为空不能报错，将市场为留空不补牌即可。 
8. 触发 15 分后不是立刻结束，而是继续到本轮最后一个玩家。
9. 服务端必须检查是不是当前玩家在行动。

以上就是“宝石商人”的完整运行逻辑。
