# AGENTS

## Scope
This file defines agent coding conventions for this repository.

## Game Module Contracts
- `server/games/index.js` is the only module-level router for game engines.
- Every game module under `server/games/` must expose:
  - `createInitialGameState(userIds)`
  - `applyAction(gameState, userId, action)`
  - `getPlayerView(gameState, userId)`
- `userIds` are ordered by room join order and define turn order unless a game specifies otherwise.

## Player Data Rules
- In-game state must only persist stable identity keys (`userId`) for players.
- Do not store display-only profile data (for example `playerName`, avatar labels) inside game state.
- UI-facing names must be resolved from room user lists on the frontend.
- If a username cannot be resolved, frontend must display the last 8 characters of `userId`.

## Frontend Rules
- Game UI components should treat `gameState` as authoritative for gameplay only.
- Display metadata should come from `roomState.users` and be mapped by `userId`.
- Keep fallback rendering deterministic and side-effect free.

