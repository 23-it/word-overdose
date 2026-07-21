import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store, levelFromXp, xpToNext, titleForLevel, dayDiff } from './storage.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test('levelFromXp accumulates thresholds', () => {
  assert.deepEqual(levelFromXp(0), { level: 1, xpInLevel: 0, xpForLevel: xpToNext(1) });
  // レベル1で100必要 → 100でレベル2の頭
  const at100 = levelFromXp(100);
  assert.equal(at100.level, 2);
  assert.equal(at100.xpInLevel, 0);
});

test('titleForLevel scales', () => {
  assert.equal(titleForLevel(1), '単語の卵');
  assert.equal(titleForLevel(50), 'VOCAB OVERLORD');
});

test('addXp reports level ups', () => {
  const s = new Store(fakeStorage());
  const r1 = s.addXp(50);
  assert.equal(r1.leveledUp, false);
  const r2 = s.addXp(60); // 累計110 → レベル2
  assert.equal(r2.leveledUp, true);
  assert.equal(s.getProgress().level, 2);
});

test('streak: same day no change, next day +1, gap resets', () => {
  let today = new Date('2026-07-21T09:00:00');
  const s = new Store(fakeStorage(), () => today);

  assert.equal(s.recordPlay().count, 1); // 初回
  assert.equal(s.recordPlay().count, 1); // 同日再プレイ → 据え置き

  today = new Date('2026-07-22T09:00:00');
  assert.equal(s.recordPlay().count, 2); // 翌日 → +1

  today = new Date('2026-07-23T23:00:00');
  assert.equal(s.recordPlay().count, 3); // さらに翌日 → +1

  today = new Date('2026-07-26T09:00:00');
  assert.equal(s.recordPlay().count, 1); // 2日以上あき → リセット
});

test('dayDiff boundaries', () => {
  assert.equal(dayDiff('2026-07-21', '2026-07-21'), 0);
  assert.equal(dayDiff('2026-07-21', '2026-07-22'), 1);
  assert.equal(dayDiff('2026-12-31', '2027-01-01'), 1);
});

test('ranking keeps top 10 sorted and detects new record', () => {
  const s = new Store(fakeStorage(), () => new Date('2026-07-21T00:00:00'));
  const first = s.submitScore(1000, 'C');
  assert.equal(first.isNewRecord, true);
  const second = s.submitScore(500, 'C');
  assert.equal(second.isNewRecord, false);
  const third = s.submitScore(2000, 'A');
  assert.equal(third.isNewRecord, true);
  assert.equal(s.getRanking()[0].score, 2000);

  for (let i = 0; i < 15; i++) s.submitScore(i, 'C');
  assert.equal(s.getRanking().length, 10);
});

test('word stats accumulate seen/correct', () => {
  const s = new Store(fakeStorage());
  s.recordWord('cat', true);
  s.recordWord('cat', false);
  const stats = s.getWordStats();
  assert.deepEqual(stats.cat, { seen: 2, correct: 1 });
});

test('settings merge with defaults and resetAll clears', () => {
  const st = fakeStorage();
  const s = new Store(st);
  s.setSettings({ muted: true });
  assert.equal(s.getSettings().muted, true);
  assert.equal(s.getSettings().bgmVolume, 0.7); // default retained
  s.resetAll();
  assert.equal(s.getSettings().muted, false);
});
