import * as gemMerchant from "./gemMerchant.js";
import * as uno from "./uno.js";

export function createInitialGameState(gameType, users) {
  if (gameType === "uno") {
    const playerIds = users.map((user) => user.userId || user.user_id || user);
    return {
      gameType: "uno",
      ...uno.createInitialGameState(playerIds),
    };
  }

  if (gameType === "gem_merchant") {
    return gemMerchant.createInitialGameState(users);
  }

  throw new Error(`Unsupported game type: ${gameType}`);
}

export function applyAction(gameState, userId, action) {
  if (gameState.gameType === "gem_merchant") {
    return gemMerchant.applyAction(gameState, userId, action);
  }

  return {
    gameType: "uno",
    ...uno.applyAction(gameState, userId, action),
  };
}

export function getPlayerView(gameState, userId) {
  if (gameState.gameType === "gem_merchant") {
    return gemMerchant.getPlayerView(gameState, userId);
  }

  return {
    gameType: "uno",
    ...uno.getPlayerView(gameState, userId),
  };
}
