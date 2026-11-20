/**
 * Disk-backed leaderboard used by `run_cmd --export-leaderboard` and by the
 * Vite dev API. The browser GUI writes through /api/leaderboard; this module
 * is the Node side of the same JSON file.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { insertEntry, normaliseEntry, readBoard } from '../dist/sim.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const boardPath = join(root, 'data', 'leaderboard.json');

export function readBoardFile() {
  if (!existsSync(boardPath)) return { entries: [] };
  try {
    return readBoard(JSON.parse(readFileSync(boardPath, 'utf8')));
  } catch {
    // A corrupt local board must never prevent the game from starting.
    return { entries: [] };
  }
}

export function writeBoardFile(board) {
  mkdirSync(dirname(boardPath), { recursive: true });
  writeFileSync(boardPath, `${JSON.stringify(readBoard(board), null, 2)}\n`, 'utf8');
}

export function addBoardEntry(value) {
  const entry = normaliseEntry(value);
  if (!entry) throw new Error('invalid leaderboard entry');
  const board = { entries: insertEntry(readBoardFile().entries, entry) };
  writeBoardFile(board);
  return board;
}

export function exportLeaderboard(out) {
  if (!out) throw new Error('missing leaderboard output path');
  const board = readBoardFile();
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(out, `${JSON.stringify(board, null, 2)}\n`, 'utf8');
  return board;
}
