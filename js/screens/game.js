// game.js — クイズ進行。core(combo/score/quiz) を使って1プレイ20問を回す。

import { buildSession } from '../core/quiz.js';
import { ComboState } from '../core/combo.js';
import { questionScore, rankForScore } from '../core/score.js';
import * as bgm from '../audio/bgm.js';

// コンボ数 → BGMレイヤー(0..3)。倍率の段に合わせる。
function layerForCombo(combo) {
  if (combo >= 20) return 3;
  if (combo >= 10) return 2;
  if (combo >= 5) return 1;
  return 0;
}

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
  el.countdown = document.getElementById('game-countdown');
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
  bgm.startBgm();
  bgm.setBgmLayer(0);
  bgm.setFever(false);
  el.word.textContent = '';
  el.choices.innerHTML = '';
  runCountdown(() => renderQuestion());
}

// START直後のカウントダウン演出（3・2・1・GO）。
function runCountdown(done) {
  const seq = [
    { label: '3', n: 3 },
    { label: '2', n: 2 },
    { label: '1', n: 1 },
    { label: 'GO!', n: 1 },
  ];
  let i = 0;
  const overlay = el.countdown;
  overlay.classList.remove('hidden');
  const tick = () => {
    if (i >= seq.length) {
      overlay.classList.add('hidden');
      done();
      return;
    }
    const s = seq[i++];
    overlay.textContent = s.label;
    overlay.classList.remove('pop');
    // reflow でアニメ再start
    void overlay.offsetWidth;
    overlay.classList.add('pop');
    ctx.sfx.playCountdownTick(s.n);
    ctx.effects.flash(s.label === 'GO!' ? 'var(--cyan)' : '#ffffff');
    setTimeout(tick, s.label === 'GO!' ? 350 : 500);
  };
  tick();
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
    if (animate) {
      el.combo.classList.remove('bump');
      void el.combo.offsetWidth;
      el.combo.classList.add('bump');
    }
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
    el.word.classList.remove('hit');
    void el.word.offsetWidth;
    el.word.classList.add('hit');

    // BGMレイヤーをコンボ段に合わせる
    bgm.setBgmLayer(layerForCombo(res.combo));

    // 演出・音（パチンコ風の総合演出）
    ctx.sfx.playCorrect(res.combo);
    ctx.effects.celebrate(centerXOf(btnEl), centerYOf(btnEl), {
      combo: res.combo,
      multiplier: res.multiplier,
      multiplierUp: res.multiplierUp,
      enteredFever: res.enteredFever,
      milestone: res.combo > 0 && res.combo % 10 === 0,
    });
    if (res.enteredFever) {
      el.app.classList.add('fever');
      bgm.setFever(true);
      ctx.sfx.playFeverStart();
      ctx.effects.feverBackground(true);
    }
    if (res.feverEnded) {
      el.app.classList.remove('fever');
      bgm.setFever(false);
      ctx.effects.feverBackground(false);
    }
  } else {
    // 不正解: 正解を光らせて学習させる
    const res = combo.miss();
    btnEl.classList.add('wrong');
    el.choices.children[q.answerIndex].classList.add('correct');
    updateComboDisplay(false);
    bgm.setBgmLayer(0);
    bgm.duckForMiss();
    ctx.sfx.playMiss();
    ctx.effects.flash('var(--red)');
    ctx.effects.shake(2.2);
    ctx.effects.comboShatter(res.lostCombo);
    if (res.feverEnded) {
      el.app.classList.remove('fever');
      bgm.setFever(false);
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
  const res = combo.miss();
  el.choices.children[q.answerIndex].classList.add('correct');
  updateComboDisplay(false);
  bgm.setBgmLayer(0);
  bgm.setFever(false);
  bgm.duckForMiss();
  ctx.sfx.playMiss();
  ctx.effects.flash('var(--red)');
  ctx.effects.comboShatter(res.lostCombo);
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
  bgm.stopBgm();
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
