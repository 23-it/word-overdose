import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComboState, multiplierForCombo, FEVER_THRESHOLD } from './combo.js';

test('multiplier tiers at boundaries', () => {
  assert.equal(multiplierForCombo(0), 1);
  assert.equal(multiplierForCombo(4), 1);
  assert.equal(multiplierForCombo(5), 2);
  assert.equal(multiplierForCombo(9), 2);
  assert.equal(multiplierForCombo(10), 4);
  assert.equal(multiplierForCombo(19), 4);
  assert.equal(multiplierForCombo(20), 8);
  assert.equal(multiplierForCombo(29), 8);
  assert.equal(multiplierForCombo(30), 16);
  assert.equal(multiplierForCombo(999), 16);
});

test('correct() increments combo and tracks max', () => {
  const c = new ComboState();
  for (let i = 0; i < 3; i++) c.correct();
  assert.equal(c.combo, 3);
  assert.equal(c.maxCombo, 3);
  c.miss();
  assert.equal(c.combo, 0);
  assert.equal(c.maxCombo, 3);
});

test('multiplierUp flags on tier crossing', () => {
  const c = new ComboState();
  const results = [];
  for (let i = 0; i < 5; i++) results.push(c.correct());
  // 5問目でcombo=5 → 2xに上がる
  assert.equal(results[4].multiplierUp, true);
  assert.equal(results[3].multiplierUp, false);
});

test('FEVER enters at threshold and applies 2x score', () => {
  const c = new ComboState();
  let entered = null;
  for (let i = 0; i < FEVER_THRESHOLD; i++) {
    const r = c.correct();
    if (r.enteredFever) entered = r;
  }
  assert.ok(entered, 'FEVER should have been entered');
  assert.equal(c.fever, true);
  // 突入問題はFEVERスコア(×2)が乗る。combo=20なので8x×2=16
  assert.equal(entered.scoreMultiplier, 16);
});

test('FEVER ends after FEVER_DURATION questions', () => {
  const c = new ComboState();
  for (let i = 0; i < FEVER_THRESHOLD; i++) c.correct(); // 突入
  assert.equal(c.fever, true);
  // 突入問題で1問消費済み。残り9問でちょうど終わる。
  let ended = false;
  for (let i = 0; i < 9; i++) {
    const r = c.correct();
    if (r.feverEnded) ended = true;
  }
  assert.equal(ended, true);
  assert.equal(c.fever, false);
});

test('miss during FEVER ends it and reports feverEnded', () => {
  const c = new ComboState();
  for (let i = 0; i < FEVER_THRESHOLD; i++) c.correct();
  const r = c.miss();
  assert.equal(r.feverEnded, true);
  assert.equal(r.lostCombo, FEVER_THRESHOLD);
  assert.equal(c.fever, false);
  assert.equal(c.combo, 0);
});
