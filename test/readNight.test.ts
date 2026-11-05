import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/readNight.js';

describe('readNight on the real fixture (runs/ is read-only)', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line, sorted by job', async () => {
    const night = await readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night!.night).toBe('2026-10-28');
    expect(night!.badLines).toBe(1);
    expect(night!.rows).toHaveLength(5);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('aggregates runs, retries, last status and error, first/last time', async () => {
    const night = await readNight('runs', '2026-10-28');
    const refresh = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh.runs).toBe(4);
    expect(refresh.retries).toBe(3);
    expect(refresh.lastStatus).toBe('ok');
    expect(refresh.lastError).toBeNull();
    expect(refresh.firstAt).toBe('2026-10-29T01:30:00+01:00');
    expect(refresh.lastAt).toBe('2026-10-29T01:37:00+01:00');

    const backup = night!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
  });

  it('keeps a null owner as null', async () => {
    const night = await readNight('runs', '2026-10-28');
    const render = night!.rows.find((r) => r.job === 'digest/render')!;
    expect(render.owner).toBeNull();
  });

  it('a missing file yields null', async () => {
    expect(await readNight('runs', '2026-01-01')).toBeNull();
  });
});

describe('readNight on a temp dir', () => {
  let dir: string;
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('an empty file yields no rows and no bad lines', async () => {
    dir = await mkdtemp(join(tmpdir(), 'digest-'));
    await writeFile(join(dir, 'empty.jsonl'), '');
    expect(await readNight(dir, 'empty')).toEqual({ night: 'empty', rows: [], badLines: 0 });
  });

  it('counts lines with the wrong shape as bad, never throws', async () => {
    const lines = [
      'not json at all',
      '{"at":"2026-10-29T01:00:00+01:00","job":"a","status":"exploded","owner":null}',
      '{"at":"2026-10-29T02:00:00+01:00","job":"a","status":"ok","owner":null}',
    ].join('\n');
    await writeFile(join(dir, 'bad.jsonl'), lines);
    const night = await readNight(dir, 'bad');
    expect(night!.badLines).toBe(2);
    expect(night!.rows).toHaveLength(1);
    expect(night!.rows[0]!.runs).toBe(1);
  });
});
