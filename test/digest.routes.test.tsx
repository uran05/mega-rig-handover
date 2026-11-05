import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { DigestNight } from '../src/digest/types.js';

// Route tests for /digest/:night and /api/digest/:night (plan.md § 2d).
// runs/ is read-only, so every night here lives in a temp runs dir.

let dir: string;
let config: RigConfig;

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'digest-routes-'));
  config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir };
  // Jobs written out of order; 3 retries and a fail to trigger the warn marks.
  await writeFile(
    join(dir, '2026-11-01.jsonl'),
    [
      line('2026-11-01T23:00:00+01:00', 'z/backup', 'retry', 'rook', 'upstream 503'),
      line('2026-11-01T23:05:00+01:00', 'z/backup', 'retry', 'rook', 'upstream 503'),
      line('2026-11-01T23:10:00+01:00', 'z/backup', 'retry', 'rook', 'upstream 503'),
      line('2026-11-01T23:15:00+01:00', 'z/backup', 'fail', 'rook', 'quota exceeded'),
      line('2026-11-02T01:00:00+01:00', 'a/sync', 'ok', null),
    ].join('\n'),
  );
  await writeFile(join(dir, '2026-11-02.jsonl'), '');
  await writeFile(
    join(dir, '2026-11-03.jsonl'),
    ['not json at all', line('2026-11-03T23:00:00+01:00', 'a/sync', 'ok', 'rook')].join('\n'),
  );
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('renders a night with data: 200, jobs sorted, warn marks on retries >= 3 and fail', async () => {
    const res = await createApp(config).request('/digest/2026-11-01');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html.indexOf('a/sync')).toBeGreaterThan(-1);
    expect(html.indexOf('a/sync')).toBeLessThan(html.indexOf('z/backup'));
    expect(html).toContain('<span class="warn">3</span>');
    expect(html).toContain('<span class="warn">fail</span>');
  });

  it('404s on a night with no file', async () => {
    const res = await createApp(config).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for the empty night', async () => {
    const res = await createApp(config).request('/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders a night with a bad line and says so', async () => {
    const res = await createApp(config).request('/digest/2026-11-03');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('a/sync');
    expect(html).toContain('1 line');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the night as JSON: 200, rows sorted, badLines 0', async () => {
    const res = await createApp(config).request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestNight;
    expect(body.night).toBe('2026-11-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['a/sync', 'z/backup']);
  });

  it('404s as JSON on a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });

  it('returns rows: [] for the empty night', async () => {
    const res = await createApp(config).request('/api/digest/2026-11-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-11-02', rows: [], badLines: 0 });
  });

  it('counts the bad line and still returns the night', async () => {
    const res = await createApp(config).request('/api/digest/2026-11-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestNight;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['a/sync']);
  });
});

describe('page and JSON agree (ADR 0001)', () => {
  it('lists the same jobs in the same order for the same night', async () => {
    const app = createApp(config);
    const body = (await (await app.request('/api/digest/2026-11-01')).json()) as DigestNight;
    const html = await (await app.request('/digest/2026-11-01')).text();
    const positions = body.rows.map((r) => html.indexOf(`<td>${r.job}</td>`));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
