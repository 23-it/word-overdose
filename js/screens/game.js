// game.js — クイズ進行。core(combo/score/quiz) を使って1プレイ20問を回す。

import { buildSession } from '../core/quiz.js';
import { ComboState } from '../core/combo.js';
import { questionScore, rankForScore } from '../core/score.js';

const QUESTIONS_PER_GAME = 20;
const BASE_TIME_MS = 7000; // 初期制限時間
const MIN_TIME_MS = 3500; // コンボで短縮される下限

let ctx = null;
let session = [];
let index = 0;
let combo = null;
let score = 0;
let correctCount = 0;
let answered = false;
let timer = { raf: 0, deadline: 0, limit: BASE_TIME_MS };
let questionStart = 0;

const el = {};

export function initGame(appCtx) {
  ctx = appCtx;
  el.progress = document.getElementById('game-progress');
  el.score = document.getElementById('game-score');
  el.combo = document.getElementById('game-combo');
  el.mult = document.getElementById('game-mult');
  el.timer = document.getElementById('game-timer');
  el.word = document.getElementById('game-word');
  el.choices = document.getElementById('game-choices');
  el.app = document.getElementById('app');
}

export function startGame(appCtx) {
  ctx = appCtx || ctx;
  const progress = ctx.store.getProgress();
  const stats = ctx.store.getWordStats();
  session = buildSession(ctx.words, {
    playerLevel: progress.level,
    stats,
    count: QUESTIONS_PER_GAME,
  });
  index = 0;
  score = 0;
  correctCount = 0;
  combo = new ComboState();
  el.app.classList.remove('fever');
  renderQuestion();
}

function currentTimeLimit() {
  // コンボが上がるほど制限時間が短くなる（テンションを上げる）。
  const shrink = Math.min(1, combo.combo / 30);
  return Math.round(BASE_TIME_MS - (BASE_TIME_MS - MIN_TIME_MS) * shrink);
}

function renderQuestion() {
  answered = false;
  const q = session[index];
  el.progress.textContent = `${index + 1} / ${session.length}`;
  el.score.textContent = score;
  el.word.textContent = q.word.en;
  updateComboDisplay(false);

  // 選択肢
  el.choices.innerHTML = '';
  q.choices.forEach((choice, i) => {
    const b = document.createElement('button');
    b.className = 'choice';
    b.textContent = choice;
    b.addEventListener('click', () => onAnswer(i, b));
    el.choices.appendChild(b);
  });

  // タイマー開始
  timer.limit = currentTimeLimit();
  questionStart = performance.now();
  startTimer();
}

function updateComboDisplay(animate) {
  if (combo.combo >= 2) {
    el.combo.classList.remove('hidden');
    el.combo.textContent = combo.combo;
    el.mult.textContent = combo.multiplier > 1 ? `${combo.multiplier}x` : '';
  } else {
    el.combo.classList.add('hidden');
    el.mult.textContent = '';
  }
}

function startTimer() {
  cancelAnimationFrame(timer.raf);
  timer.deadline = questionStart + timer.limit;
  const tick = (now) => {
    const remain = Math.max(0, timer.deadline - now);
    const ratio = remain / timer.limit;
    el.timer.style.transform = `scaleX(${ratio})`;
    if (remain <= 0) {
      onTimeout();
      return;
    }
    timer.raf = requestAnimationFrame(tick);
  };
  timer.raf = requestAnimationFrame(tick);
}

function onAnswer(choiceIndex, btnEl) {
  if (answered) return;
  answered = true;
  cancelAnimationFrame(timer.raf);

  const q = session[index];
  const isCorrect = choiceIndex === q.answerIndex;
  ctx.store.recordWord(q.word.en, isCorrect);

  if (isCorrect) {
    const elapsed = performance.now() - questionStart;
    const timeRatio = 1 - Math.min(1, elapsed / timer.limit);
    const res = combo.correct();
    const gained = questionScore(res.scoreMultiplier, timeRatio);
    score += gained;
    correctCount += 1;

    btnEl.classList.add('correct');
    el.score.textContent = score;
    updateComboDisplay(true);

    // 演出・音（Phase 3-4で中身が入る）
    ctx.sfx.playCorrect(res.combo);
    ctx.effects.burstCorrect(centerXOf(btnEl), centerYOf(btnEl), res.combo);
    if (res.multiplierUp) ctx.effects.shake(1 + res.multiplier / 8);
    if (res.enteredFever) {
      el.app.classList.add('fever');
      ctx.sfx.playFeverStart();
      ctx.effects.feverBackground(true);
    }
    if (res.feverEnded) {
      el.app.classList.remove('fever');
      ctx.effects.feverBackground(false);
    }
  } else {
    // 不正解: 正解を光らせて学習させる
    const res = combo.miss();
    btnEl.classList.add('wrong');
    el.choices.children[q.answerIndex].classList.add('correct');
    updateComboDisplay(false);
    ctx.sfx.playMiss();
    ctx.effects.flash('var(--red)');
    ctx.effects.shake(1.5);
    if (res.feverEnded) {
      el.app.classList.remove('fever');
      ctx.effects.feverBackground(false);
    }
  }

  disableChoices();
  setTimeout(nextQuestion, isCorrect ? 550 : 1100);
}

function onTimeout() {
  if (answered) return;
  answered = true;
  const q = session[index];
  ctx.store.recordWord(q.word.en, false);
  combo.miss();
  el.choices.children[q.answerIndex].classList.add('correct');
  updateComboDisplay(false);
  ctx.sfx.playMiss();
  ctx.effects.flash('var(--red)');
  el.app.classList.remove('fever');
  disableChoices();
  setTimeout(nextQuestion, 1100);
}

function disableChoices() {
  for (const b of el.choices.children) b.disabled = true;
}

function nextQuestion() {
  index += 1;
  if (index >= session.length) {
    finishGame();
    return;
  }
  renderQuestion();
}

function finishGame() {
  cancelAnimationFrame(timer.raf);
  const rank = rankForScore(score);
  const accuracy = Math.round((correctCount / session.length) * 100);
  ctx.navigate('result', {
    score,
    rank,
    maxCombo: combo.maxCombo,
    accuracy,
    total: session.length,
    correct: correctCount,
  });
}

function centerXOf(elm) {
  const r = elm.getBoundingClientRect();
  return r.left + r.width / 2;
}
function centerYOf(elm) {
  const r = elm.getBoundingClientRect();
  return r.top + r.height / 2;
}
