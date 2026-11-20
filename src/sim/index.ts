/**
 * Node-side entry point for tooling (soak test, leaderboard export).
 * The GUI and headless runner import the individual modules directly;
 * this barrel only exists so esbuild can produce `dist/sim.mjs`.
 */
export { FUEL_MAX_UNITS, FUEL_UNITS_PER_POINT, NIGHTS, TICKS_PER_SECOND, TUNING } from './config';
export { InputFormatError, InputTrack, parseInputs } from './inputs';
export { endLine, eventLine, snapshotLine } from './output';
export { step } from './step';
export type {
  GameEvent,
  InputFrame,
  InputState,
  Lantern,
  ScenarioFile,
  Shade,
  World,
} from './types';
export { createWorld } from './world';
export {
  insertEntry,
  isValidName,
  LEADERBOARD_KEY,
  LEADERBOARD_LIMIT,
  normaliseEntry,
  readBoard,
  sortEntries,
} from '../leaderboard';
export type { Leaderboard, LeaderboardEntry } from '../leaderboard';
