const COLORS = ["red", "yellow", "green", "blue"];

function createCard(color, value, type) {
  return {
    id: crypto.randomUUID(),
    color,
    value,
    type,
  };
}

export function createDeck() {
  const deck = [];

  for (const color of COLORS) {
    deck.push(createCard(color, "0", "number"));

    for (let number = 1; number <= 9; number += 1) {
      deck.push(createCard(color, String(number), "number"));
      deck.push(createCard(color, String(number), "number"));
    }

    const actionValues = ["skip", "reverse", "draw_two"];
    for (const value of actionValues) {
      deck.push(createCard(color, value, "action"));
      deck.push(createCard(color, value, "action"));
    }
  }

  for (let i = 0; i < 4; i += 1) {
    deck.push(createCard(null, "wild", "wild"));
    deck.push(createCard(null, "wild_draw_four", "wild"));
  }

  return deck;
}

export function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function drawCards(gameState, playerId, count) {
  for (let i = 0; i < count; i += 1) {
    if (gameState.deck.length === 0) {
      if (gameState.discardPile.length <= 1) {
        break;
      }

      const top = gameState.discardPile.pop();
      gameState.deck = shuffle(gameState.discardPile);
      gameState.discardPile = [top];
      gameState.discardTop = top;
    }

    const card = gameState.deck.pop();
    if (!card) {
      break;
    }
    gameState.hands[playerId].push(card);
  }
}

function nextAliveIndex(gameState, startIndex) {
  const size = gameState.playerOrder.length;
  if (size === 0) {
    return -1;
  }

  let idx = startIndex;
  for (let i = 0; i < size; i += 1) {
    idx = (idx + gameState.direction + size) % size;
    const playerId = gameState.playerOrder[idx];
    if (!gameState.finished.includes(playerId)) {
      return idx;
    }
  }

  return -1;
}

function advanceTurn(gameState, steps = 1) {
  let currentIndex = gameState.playerOrder.indexOf(gameState.currentTurn);
  if (currentIndex < 0) {
    currentIndex = 0;
  }

  for (let i = 0; i < steps; i += 1) {
    const nextIndex = nextAliveIndex(gameState, currentIndex);
    if (nextIndex < 0) {
      return;
    }
    currentIndex = nextIndex;
  }

  gameState.currentTurn = gameState.playerOrder[currentIndex];
}

function takeFirstDiscard(deck) {
  let card = deck.pop();
  while (card && card.type === "wild" && deck.length > 0) {
    deck.unshift(card);
    card = deck.pop();
  }

  if (!card) {
    throw new Error("Deck is empty");
  }

  return card;
}

export function dealCards(playerIds, deck) {
  const hands = {};
  for (const playerId of playerIds) {
    hands[playerId] = [];
  }

  for (let i = 0; i < 7; i += 1) {
    for (const playerId of playerIds) {
      const card = deck.pop();
      if (card) {
        hands[playerId].push(card);
      }
    }
  }

  const discardTop = takeFirstDiscard(deck);

  return {
    hands,
    discardTop,
  };
}

export function isValidPlay(card, topCard, currentColor, pendingDraw = 0) {
  if (!card || !topCard) {
    return false;
  }

  if (pendingDraw > 0) {
    return card.value === "draw_two" || card.value === "wild_draw_four";
  }

  if (card.type === "wild") {
    return true;
  }

  if (card.color === currentColor) {
    return true;
  }

  return card.value === topCard.value;
}

export function createInitialGameState(playerIds) {
  const deck = shuffle(createDeck());
  const { hands, discardTop } = dealCards(playerIds, deck);

  return {
    deck,
    discardPile: [discardTop],
    discardTop,
    currentColor: discardTop.color || COLORS[Math.floor(Math.random() * COLORS.length)],
    currentTurn: playerIds[0],
    direction: 1,
    pendingDraw: 0,
    hands,
    playerOrder: [...playerIds],
    finished: [],
    status: "playing",
    winner: null,
  };
}

export function applyAction(gameStateInput, playerId, action) {
  const gameState = structuredClone(gameStateInput);

  if (gameState.status !== "playing") {
    throw new Error("Game has ended");
  }

  if (gameState.currentTurn !== playerId) {
    throw new Error("Not your turn");
  }

  if (!action || typeof action.type !== "string") {
    throw new Error("Invalid action");
  }

  if (action.type === "draw") {
    const drawCount = gameState.pendingDraw > 0 ? gameState.pendingDraw : 1;
    drawCards(gameState, playerId, drawCount);
    gameState.pendingDraw = 0;
    advanceTurn(gameState, 1);
    return gameState;
  }

  if (action.type !== "play") {
    throw new Error("Unknown action type");
  }

  const hand = gameState.hands[playerId] || [];
  const cardIndex = hand.findIndex((card) => card.id === action.card?.id);
  if (cardIndex < 0) {
    throw new Error("Card not in hand");
  }

  const card = hand[cardIndex];
  if (!isValidPlay(card, gameState.discardTop, gameState.currentColor, gameState.pendingDraw)) {
    throw new Error("Invalid card play");
  }

  hand.splice(cardIndex, 1);
  gameState.discardPile.push(card);
  gameState.discardTop = card;

  if (card.type === "wild") {
    if (!COLORS.includes(action.chosenColor)) {
      throw new Error("Wild card requires chosenColor");
    }
    gameState.currentColor = action.chosenColor;
  } else {
    gameState.currentColor = card.color;
  }

  if (card.value === "draw_two") {
    gameState.pendingDraw += 2;
    advanceTurn(gameState, 1);
  } else if (card.value === "wild_draw_four") {
    gameState.pendingDraw += 4;
    advanceTurn(gameState, 1);
  } else if (card.value === "skip") {
    advanceTurn(gameState, 2);
  } else if (card.value === "reverse") {
    const alivePlayers = gameState.playerOrder.filter((id) => !gameState.finished.includes(id));
    if (alivePlayers.length <= 2) {
      advanceTurn(gameState, 2);
    } else {
      gameState.direction *= -1;
      advanceTurn(gameState, 1);
    }
  } else {
    advanceTurn(gameState, 1);
  }

  if (hand.length === 0 && !gameState.finished.includes(playerId)) {
    gameState.finished.push(playerId);
    gameState.winner = playerId;
    gameState.status = "ended";
  }

  return gameState;
}

export function getPlayerView(gameStateInput, playerId) {
  const gameState = structuredClone(gameStateInput);
  const handCounts = {};

  for (const id of gameState.playerOrder) {
    const cards = gameState.hands[id] || [];
    handCounts[id] = cards.length;
    if (id !== playerId) {
      gameState.hands[id] = [];
    }
  }

  delete gameState.deck;
  delete gameState.discardPile;

  return {
    ...gameState,
    handCounts,
    deckCount: gameStateInput.deck.length,
  };
}
