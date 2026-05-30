const NORMAL_GEMS = ["white", "blue", "green", "red", "black"];
const ALL_GEMS = [...NORMAL_GEMS, "gold"];
const TARGET_SCORE = 15;
const MAX_GEMS = 10;
const MAX_RESERVED = 3;

function emptyGems(includeGold = true) {
  const gems = {
    white: 0,
    blue: 0,
    green: 0,
    red: 0,
    black: 0,
  };
  if (includeGold) {
    gems.gold = 0;
  }
  return gems;
}

function normalizeGemMap(input = {}, includeGold = true) {
  const result = emptyGems(includeGold);
  for (const color of Object.keys(result)) {
    result[color] = Math.max(0, Number(input[color] || 0));
  }
  return result;
}

function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function createCard(tier, index, color, points, cost) {
  return {
    id: `gm_t${tier}_${index}`,
    tier,
    color,
    points,
    cost: normalizeGemMap(cost, false),
  };
}

function createDeck(tier) {
  const patterns = {
    1: [
      { points: 0, cost: [1, 1, 1, 1, 0] },
      { points: 0, cost: [2, 1, 0, 0, 1] },
      { points: 0, cost: [0, 2, 2, 0, 1] },
      { points: 1, cost: [0, 0, 4, 0, 0] },
      { points: 1, cost: [0, 0, 0, 4, 0] },
      { points: 1, cost: [3, 0, 0, 0, 2] },
    ],
    2: [
      { points: 1, cost: [2, 2, 3, 0, 0] },
      { points: 2, cost: [0, 0, 5, 0, 0] },
      { points: 2, cost: [0, 3, 0, 0, 5] },
      { points: 3, cost: [0, 0, 0, 6, 0] },
      { points: 1, cost: [3, 0, 2, 3, 0] },
      { points: 2, cost: [0, 4, 2, 0, 1] },
    ],
    3: [
      { points: 3, cost: [3, 3, 5, 3, 0] },
      { points: 4, cost: [0, 0, 0, 7, 0] },
      { points: 4, cost: [0, 7, 0, 0, 0] },
      { points: 5, cost: [0, 0, 0, 7, 3] },
      { points: 3, cost: [5, 3, 0, 3, 3] },
      { points: 4, cost: [3, 0, 0, 3, 6] },
    ],
  };

  const deck = [];
  let index = 1;
  for (const color of NORMAL_GEMS) {
    for (const pattern of patterns[tier]) {
      const cost = {};
      NORMAL_GEMS.forEach((gem, offset) => {
        cost[gem] = pattern.cost[(offset + index) % NORMAL_GEMS.length];
      });
      deck.push(createCard(tier, index, color, pattern.points, cost));
      index += 1;
    }
  }
  return shuffle(deck);
}

function createNobles() {
  const requirements = [
    { white: 4, blue: 4 },
    { blue: 4, green: 4 },
    { green: 4, red: 4 },
    { red: 4, black: 4 },
    { black: 4, white: 4 },
    { white: 3, blue: 3, green: 3 },
    { blue: 3, green: 3, red: 3 },
    { green: 3, red: 3, black: 3 },
    { red: 3, black: 3, white: 3 },
    { black: 3, white: 3, blue: 3 },
  ];

  return shuffle(requirements.map((requirement, index) => ({
    id: `gm_noble_${index + 1}`,
    points: 3,
    requirement: normalizeGemMap(requirement, false),
  })));
}

function getInitialBankGems(playerCount) {
  const normalGemCount = playerCount === 2 ? 4 : playerCount === 3 ? 5 : 7;
  return {
    white: normalGemCount,
    blue: normalGemCount,
    green: normalGemCount,
    red: normalGemCount,
    black: normalGemCount,
    gold: 5,
  };
}

function createPlayer(user) {
  const userId = user.userId || user.user_id || user;
  return {
    userId,
    name: user.username || user.name || "Player",
    gems: emptyGems(),
    cards: {
      white: [],
      blue: [],
      green: [],
      red: [],
      black: [],
    },
    reservedCards: [],
    nobles: [],
    score: 0,
  };
}

function marketKey(tier) {
  return `tier${Number(tier)}`;
}

function drawToMarket(gameState, tier) {
  const key = marketKey(tier);
  if (gameState.decks[key].length > 0) {
    gameState.market[key].push(gameState.decks[key].shift());
  }
}

function sumGems(gems) {
  return ALL_GEMS.reduce((sum, color) => sum + Number(gems[color] || 0), 0);
}

function getDiscount(player) {
  const discount = {};
  for (const color of NORMAL_GEMS) {
    discount[color] = player.cards[color].length;
  }
  return discount;
}

function getActualCost(player, card) {
  const discount = getDiscount(player);
  const cost = {};
  for (const color of NORMAL_GEMS) {
    cost[color] = Math.max(0, Number(card.cost[color] || 0) - discount[color]);
  }
  return cost;
}

function calculateScore(player) {
  const cardPoints = NORMAL_GEMS
    .flatMap((color) => player.cards[color])
    .reduce((sum, card) => sum + Number(card.points || 0), 0);
  const noblePoints = player.nobles.reduce((sum, noble) => sum + Number(noble.points || 0), 0);
  return cardPoints + noblePoints;
}

function getPurchasedCardCount(player) {
  return NORMAL_GEMS.reduce((sum, color) => sum + player.cards[color].length, 0);
}

function refreshScores(gameState) {
  for (const player of gameState.players) {
    player.score = calculateScore(player);
  }
}

function findPlayer(gameState, userId) {
  const player = gameState.players.find((entry) => entry.userId === userId);
  if (!player) {
    throw new Error("Player is not in this game");
  }
  return player;
}

function currentPlayer(gameState) {
  return gameState.players[gameState.currentPlayerIndex];
}

function assertCurrentPlayer(gameState, userId) {
  if (currentPlayer(gameState)?.userId !== userId) {
    throw new Error("Not your turn");
  }
}

function canTakeNoble(player, noble) {
  return NORMAL_GEMS.every((color) => player.cards[color].length >= Number(noble.requirement[color] || 0));
}

function resolveNoble(gameState, player) {
  const nobleIndex = gameState.nobles.findIndex((noble) => canTakeNoble(player, noble));
  if (nobleIndex < 0) {
    return;
  }
  const [noble] = gameState.nobles.splice(nobleIndex, 1);
  player.nobles.push(noble);
}

function determineWinners(players) {
  const maxScore = Math.max(...players.map(calculateScore));
  const candidates = players.filter((player) => calculateScore(player) === maxScore);
  const minCards = Math.min(...candidates.map(getPurchasedCardCount));
  return candidates.filter((player) => getPurchasedCardCount(player) === minCards);
}

function endGame(gameState) {
  refreshScores(gameState);
  const winners = determineWinners(gameState.players);
  gameState.status = "ended";
  gameState.winnerUserIds = winners.map((player) => player.userId);
  gameState.winner = gameState.winnerUserIds[0] || null;
}

function completeTurn(gameState, player) {
  resolveNoble(gameState, player);
  refreshScores(gameState);

  if (!gameState.finalRoundTriggered && player.score >= TARGET_SCORE) {
    gameState.finalRoundTriggered = true;
    gameState.finalRoundTriggerUserId = player.userId;
    gameState.finalRoundLastPlayerIndex = gameState.players.length - 1;
  }

  if (
    gameState.finalRoundTriggered &&
    gameState.currentPlayerIndex === gameState.finalRoundLastPlayerIndex
  ) {
    endGame(gameState);
    return;
  }

  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
}

function finishMainAction(gameState, player) {
  if (sumGems(player.gems) > MAX_GEMS) {
    gameState.pendingDiscard = {
      userId: player.userId,
      needDiscardCount: sumGems(player.gems) - MAX_GEMS,
    };
    return;
  }
  completeTurn(gameState, player);
}

function handleTakeGems(gameState, player, action) {
  const gems = normalizeGemMap(action.gems, true);
  if (gems.gold > 0) {
    throw new Error("Gold can only be gained by reserving cards");
  }

  const pickedColors = NORMAL_GEMS.filter((color) => gems[color] > 0);
  const pickedTotal = pickedColors.reduce((sum, color) => sum + gems[color], 0);

  if (pickedTotal === 3) {
    if (pickedColors.length !== 3 || pickedColors.some((color) => gems[color] !== 1)) {
      throw new Error("Taking 3 gems requires three different colors");
    }
  } else if (pickedTotal === 2) {
    if (pickedColors.length !== 1 || gems[pickedColors[0]] !== 2) {
      throw new Error("Taking 2 gems requires one color");
    }
    if (gameState.bankGems[pickedColors[0]] < 4) {
      throw new Error("The bank needs at least 4 gems of that color");
    }
  } else {
    throw new Error("Take exactly 2 same-color gems or 3 different gems");
  }

  for (const color of pickedColors) {
    if (gameState.bankGems[color] < gems[color]) {
      throw new Error("Not enough gems in bank");
    }
    gameState.bankGems[color] -= gems[color];
    player.gems[color] += gems[color];
  }
}

function validatePayment(gameState, player, card, paymentInput) {
  const payment = normalizeGemMap(paymentInput, true);
  const actualCost = getActualCost(player, card);
  let costTotal = 0;
  let normalPaid = 0;

  for (const color of ALL_GEMS) {
    if (payment[color] > player.gems[color]) {
      throw new Error("Payment includes gems the player does not have");
    }
  }

  for (const color of NORMAL_GEMS) {
    costTotal += actualCost[color];
    normalPaid += payment[color];
    if (payment[color] > actualCost[color]) {
      throw new Error("Payment overpays a color");
    }
  }

  if (normalPaid + payment.gold !== costTotal) {
    throw new Error("Payment must exactly match the card cost");
  }

  return payment;
}

function handleBuyCard(gameState, player, action) {
  let card = null;

  if (action.source === "market") {
    const key = marketKey(action.tier);
    const cardIndex = gameState.market[key]?.findIndex((entry) => entry.id === action.cardId) ?? -1;
    if (cardIndex < 0) {
      throw new Error("Card is not in the market");
    }
    card = gameState.market[key][cardIndex];
    const payment = validatePayment(gameState, player, card, action.payment);
    gameState.market[key].splice(cardIndex, 1);
    for (const color of ALL_GEMS) {
      player.gems[color] -= payment[color];
      gameState.bankGems[color] += payment[color];
    }
    player.cards[card.color].push(card);
    drawToMarket(gameState, action.tier);
    return;
  }

  if (action.source === "reserved") {
    const cardIndex = player.reservedCards.findIndex((entry) => entry.id === action.cardId);
    if (cardIndex < 0) {
      throw new Error("Card is not reserved by this player");
    }
    card = player.reservedCards[cardIndex];
    const payment = validatePayment(gameState, player, card, action.payment);
    player.reservedCards.splice(cardIndex, 1);
    for (const color of ALL_GEMS) {
      player.gems[color] -= payment[color];
      gameState.bankGems[color] += payment[color];
    }
    player.cards[card.color].push(card);
    return;
  }

  throw new Error("Unknown buy source");
}

function grantGoldIfAvailable(gameState, player) {
  if (gameState.bankGems.gold > 0) {
    gameState.bankGems.gold -= 1;
    player.gems.gold += 1;
  }
}

function handleReserveCard(gameState, player, action) {
  if (player.reservedCards.length >= MAX_RESERVED) {
    throw new Error("A player can reserve at most 3 cards");
  }

  if (action.source === "market") {
    const key = marketKey(action.tier);
    const cardIndex = gameState.market[key]?.findIndex((entry) => entry.id === action.cardId) ?? -1;
    if (cardIndex < 0) {
      throw new Error("Card is not in the market");
    }
    const [card] = gameState.market[key].splice(cardIndex, 1);
    player.reservedCards.push(card);
    grantGoldIfAvailable(gameState, player);
    drawToMarket(gameState, action.tier);
    return;
  }

  if (action.source === "deck") {
    const key = marketKey(action.tier);
    const card = gameState.decks[key]?.shift();
    if (!card) {
      throw new Error("No card remains in that deck");
    }
    player.reservedCards.push(card);
    grantGoldIfAvailable(gameState, player);
    return;
  }

  throw new Error("Unknown reserve source");
}

function handleDiscardGems(gameState, player, action) {
  const pending = gameState.pendingDiscard;
  if (!pending || pending.userId !== player.userId) {
    throw new Error("No discard is pending for this player");
  }

  const gems = normalizeGemMap(action.gems, true);
  const discardTotal = sumGems(gems);
  if (discardTotal !== pending.needDiscardCount) {
    throw new Error(`Discard exactly ${pending.needDiscardCount} gems`);
  }

  for (const color of ALL_GEMS) {
    if (gems[color] > player.gems[color]) {
      throw new Error("Cannot discard gems the player does not have");
    }
    player.gems[color] -= gems[color];
    gameState.bankGems[color] += gems[color];
  }

  gameState.pendingDiscard = null;
  completeTurn(gameState, player);
}

export function createInitialGameState(users) {
  if (users.length < 2 || users.length > 4) {
    throw new Error("Gem Merchant supports 2 to 4 players");
  }

  const decks = {
    tier1: createDeck(1),
    tier2: createDeck(2),
    tier3: createDeck(3),
  };
  const gameState = {
    gameType: "gem_merchant",
    status: "playing",
    players: users.map(createPlayer),
    currentPlayerIndex: 0,
    bankGems: getInitialBankGems(users.length),
    decks,
    market: {
      tier1: [],
      tier2: [],
      tier3: [],
    },
    nobles: createNobles().slice(0, users.length + 1),
    finalRoundTriggered: false,
    finalRoundTriggerUserId: null,
    finalRoundLastPlayerIndex: null,
    pendingDiscard: null,
    winnerUserIds: [],
    winner: null,
  };

  for (const tier of [1, 2, 3]) {
    for (let i = 0; i < 4; i += 1) {
      drawToMarket(gameState, tier);
    }
  }

  refreshScores(gameState);
  return gameState;
}

export function applyAction(gameStateInput, userId, action) {
  const gameState = structuredClone(gameStateInput);

  if (gameState.status !== "playing") {
    throw new Error("Game has ended");
  }

  if (!action || typeof action.type !== "string") {
    throw new Error("Invalid action");
  }

  const player = findPlayer(gameState, userId);

  if (action.type === "discard_gems") {
    handleDiscardGems(gameState, player, action);
    refreshScores(gameState);
    return gameState;
  }

  if (gameState.pendingDiscard) {
    throw new Error("A player must discard gems before the game can continue");
  }

  assertCurrentPlayer(gameState, userId);

  if (action.type === "take_gems") {
    handleTakeGems(gameState, player, action);
  } else if (action.type === "buy_card") {
    handleBuyCard(gameState, player, action);
  } else if (action.type === "reserve_card") {
    handleReserveCard(gameState, player, action);
  } else {
    throw new Error("Unknown action type");
  }

  finishMainAction(gameState, player);
  refreshScores(gameState);
  return gameState;
}

export function getPlayerView(gameStateInput, userId) {
  const gameState = structuredClone(gameStateInput);

  gameState.deckCounts = {
    tier1: gameStateInput.decks.tier1.length,
    tier2: gameStateInput.decks.tier2.length,
    tier3: gameStateInput.decks.tier3.length,
  };
  delete gameState.decks;

  for (const player of gameState.players) {
    player.reservedCount = player.reservedCards.length;
    if (player.userId !== userId) {
      player.reservedCards = [];
    }
  }

  return gameState;
}
