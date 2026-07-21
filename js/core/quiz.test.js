import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  levelBandForPlayer,
  weightForWord,
  buildQuestion,
  buildSession,
  weightedSample,
} from './quiz.js';

const POOL = [
  { en: 'cat', ja: 'ねこ', level: 1 },
  { en: 'dog', ja: 'いぬ', level: 1 },
  { en: 'run', ja: '走る', level: 1 },
  { en: 'blue', ja: '青い', level: 1 },
  { en: 'apple', ja: 'りんご', level: 2 },
  { en: 'happy', ja: '幸せな', level: 2 },
  { en: 'travel', ja: '旅行する', level: 3 },
  { en: 'achieve', ja: '達成する', level: 3 },
  { en: 'reluctant', ja: '気が進まない', level: 4 },
  { en: 'ambiguous', ja: 'あいまいな', level: 5 },
];

// 決定的なRNG（seed列を順に返す）
function seqRng(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

test('levelBandForPlayer widens with level', () => {
  assert.deepEqual(levelBandForPlayer(1), [1, 2]);
  assert.deepEqual(levelBandForPlayer(5), [1, 2, 3]);
  assert.deepEqual(levelBandForPlayer(12), [1, 2, 3, 4]);
  assert.deepEqual(levelBandForPlayer(25), [2, 3, 4, 5]);
  assert.deepEqual(levelBandForPlayer(40), [3, 4, 5]);
});

test('weightForWord: unseen high, low-accuracy heavier than high-accuracy', () => {
  const stats = {
    cat: { seen: 10, correct: 2 }, // 正解率0.2 → 重い
    dog: { seen: 10, correct: 9 }, // 正解率0.9 → 軽い
  };
  const unseen = weightForWord({ en: 'run' }, stats);
  const wrong = weightForWord({ en: 'cat' }, stats);
  const right = weightForWord({ en: 'dog' }, stats);
  assert.ok(wrong > right, 'low accuracy should be heavier');
  assert.ok(unseen > right, 'unseen should be heavier than well-known');
});

test('buildQuestion produces 4 unique choices with correct answerIndex', () => {
  const word = POOL[0]; // cat / ねこ
  const q = buildQuestion(word, POOL, seqRng([0.1, 0.3, 0.6, 0.2, 0.5, 0.9]));
  assert.equal(q.choices.length, 4);
  assert.equal(new Set(q.choices).size, 4, 'choices must be unique');
  assert.ok(q.choices.includes('ねこ'));
  assert.equal(q.choices[q.answerIndex], 'ねこ');
});

test('buildQuestion distractors avoid the answer text', () => {
  for (let i = 0; i < 20; i++) {
    const word = POOL[Math.floor(Math.random() * POOL.length)];
    const q = buildQuestion(word, POOL);
    const wrong = q.choices.filter((_, idx) => idx !== q.answerIndex);
    assert.ok(!wrong.includes(word.ja), 'answer text must not appear as a distractor');
  }
});

test('buildSession returns requested count of well-formed questions', () => {
  const session = buildSession(POOL, { playerLevel: 1, count: 4 });
  assert.equal(session.length, 4);
  for (const q of session) {
    assert.equal(q.choices.length, 4);
    assert.equal(new Set(q.choices).size, 4);
    assert.equal(q.choices[q.answerIndex], q.word.ja);
  }
});

test('weightedSample never repeats an item', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  const picked = weightedSample(items, [1, 1, 1, 1, 1], 5, seqRng([0.99, 0.5, 0.5, 0.5, 0.5]));
  assert.equal(new Set(picked).size, 5);
});
