import * as gemMerchant from "./gemMerchant.js";
import * as uno from "./uno.js";

export function createInitialGameState(gameType, userIds) {
  if (gameType === "uno") {
    return uno.createInitialGameState(userIds);
  }

  if (gameType === "gem_merchant") {
    return gemMerchant.createInitialGameState(userIds);
  }

  throw new Error(`Unsupported game type: ${gameType}`);
}

export function applyAction(gameState, userId, action) {
  if (gameState.gameType === "gem_merchant") {
    return gemMerchant.applyAction(gameState, userId, action);
  }

  return uno.applyAction(gameState, userId, action);
}

export function getPlayerView(gameState, userId) {
  if (gameState.gameType === "gem_merchant") {
    return gemMerchant.getPlayerView(gameState, userId);
  }

  return uno.getPlayerView(gameState, userId);
}
