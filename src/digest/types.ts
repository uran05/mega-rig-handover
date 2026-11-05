// Types for the morning digest (plan.md § 1). Section 2 renders these as-is:
// missing data (owner, lastError) is null here and renders as '—' in the view.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One parsed line of runs/<night>.jsonl.
export type RunLine = {
  at: string; // ISO time with the log's own offset — never converted
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job, aggregated over the night.
export type DigestRow = {
  job: string;
  owner: string | null; // owner of the job's last line; null stays null
  runs: number; // lines for this job
  retries: number; // lines with status 'retry'
  lastStatus: RunStatus;
  lastError: string | null; // error of the job's last line, else null
  firstAt: string; // time of the first line, offset preserved
  lastAt: string; // time of the last line, offset preserved
};

// What readNight returns. rows are sorted by job (ascending, code-unit order),
// badLines counts lines that did not parse — they are never thrown.
export type DigestNight = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// Contract: readNight(runsDir, night) reads `${runsDir}/${night}.jsonl`.
// A missing file yields null (routes 404 on it); anything else never throws.
export type ReadNight = (runsDir: string, night: string) => Promise<DigestNight | null>;
