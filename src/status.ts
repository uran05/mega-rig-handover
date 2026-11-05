import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/readNight.js';
import { lastBeat, type Beat } from './heartbeat.js';

// Job-level counts for one night: how many jobs ended the night ok / retry / fail.
export type NightCounts = { ok: number; retry: number; fail: number };

// counts is null when the night's file vanished mid-read; the view shows '—'.
export type NightSummary = { night: string; counts: NightCounts | null };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Counts count JOBS (one row per job), by the job's last status of the night.
async function summarizeNight(runsDir: string, night: string): Promise<NightSummary> {
  const digest = await readNight(runsDir, night);
  if (digest === null) return { night, counts: null };
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const row of digest.rows) counts[row.lastStatus] += 1;
  return { night, counts };
}

export async function readStatus(config: RigConfig): Promise<Status> {
  const nights = await Promise.all(
    nightsOnDisk(config.runsDir).map((night) => summarizeNight(config.runsDir, night)),
  );
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
  };
}
