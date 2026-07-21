import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionScore, rankForScore, xpForResult, BASE_POINTS } from './score.js';

test('questionScore applies combo multiplier and speed bonus', () => {
  // 倍率1、速度0 → 基礎点そのまま
  assert.equal(questionScore(1, 0), BASE_POINTS);
  // 倍率4、速度満点 → 100*4*1.5 = 600
  assert.equal(questionScore(4, 1), 600);
  // timeRatio はクランプされる
  assert.equal(questionScore(1, 5), Math.round(BASE_POINTS * 1.5));
  assert.equal(questionScore(1, -1), BASE_POINTS);
});

test('rankForScore thresholds', () => {
  assert.equal(rankForScore(0), 'C');
  assert.equal(rankForScore(5999), 'C');
  assert.equal(rankForScore(6000), 'B');
  assert.equal(rankForScore(15000), 'A');
  assert.equal(rankForScore(30000), 'S');
  assert.equal(rankForScore(999999), 'S');
});

test('xpForResult combines score and maxCombo', () => {
  assert.equal(xpForResult(10000, 20), 1000 + 100);
});
