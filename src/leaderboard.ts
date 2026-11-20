/**
 * Pure leaderboard rules shared by the browser GUI and the Node export tool.
 * No DOM or fs here — storage lives in the Vite API / localStorage layers.
 */

export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
}

export const LEADERBOARD_KEY = 'dao-den-long-leaderboard';
export const LEADERBOARD_LIMIT = 10;

/** 3–12 ASCII chars; Vietnamese accents are accepted as a bonus. */
export function isValidName(name: string): boolean {
  if (name.length < 3 || name.length > 12) return false;
  return /^[\p{L}\p{N}_]+$/u.test(name);
}

export function normaliseEntry(value: unknown): LeaderboardEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const entry = value as Partial<LeaderboardEntry>;
  if (typeof entry.name !== 'string' || !isValidName(entry.name)) return null;
  if (typeof entry.score !== 'number' || !Number.isFinite(entry.score)) return null;
  if (typeof entry.nights_won !== 'number' || entry.nights_won < 0 || entry.nights_won > 3) return null;
  if (typeof entry.achieved_at !== 'string' || Number.isNaN(Date.parse(entry.achieved_at))) return null;
  if (typeof entry.seed !== 'number' || !Number.isFinite(entry.seed)) return null;
  return {
    name: entry.name,
    score: Math.round(entry.score),
    nights_won: Math.round(entry.nights_won),
    achieved_at: entry.achieved_at,
    seed: Math.round(entry.seed),
  };
}

export function sortEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Date.parse(a.achieved_at) - Date.parse(b.achieved_at);
  });
}

/** Insert one result and keep the top 10; earlier equal scores rank higher. */
export function insertEntry(
  entries: LeaderboardEntry[],
  candidate: LeaderboardEntry,
): LeaderboardEntry[] {
  return sortEntries([...entries, candidate]).slice(0, LEADERBOARD_LIMIT);
}

export function readBoard(value: unknown): Leaderboard {
  const raw = typeof value === 'object' && value !== null ? (value as Leaderboard).entries : [];
  const entries = Array.isArray(raw)
    ? raw.map(normaliseEntry).filter((entry): entry is LeaderboardEntry => entry !== null)
    : [];
  return { entries: sortEntries(entries).slice(0, LEADERBOARD_LIMIT) };
}
