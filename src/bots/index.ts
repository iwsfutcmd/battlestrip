// Bots (§6.1): players whose calls the app makes. They see only
// viewFor(state, theirId) and the legal calls, never another fleet.
export { BOT_KINDS, chooseCall, chooseFleet, isBotKind, type BotKind, type FleetPolicy } from './choose.ts';
export { boardDensity, type PieceFilter } from './density-bot.ts';
export { callSeed, playBotGame, type BotGame } from './play.ts';
