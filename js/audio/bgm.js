// bgm.js — ジェネレーティブ・ステップシーケンサー（超デジタルRemix）。
// 16ステップ/BPM160。コンボ段階(layer 0-3)とFEVERでレイヤーが増減する。
// 全パートは自前のフィルタ→bgmBus を通し、ミス時にフィルタを一瞬閉じる（DJ風）。

import { getCtx, getBgmBus, getNoiseBuffer } from './engine.js';

const BPM_BASE = 160;
const STEPS = 16;
const LOOKAHEAD = 0.1; // 先読み秒
const TICK = 25; // スケジューラ間隔ms

const semi = (n) => Math.pow(2, n / 12);
// A2 を root にしたマイナーペンタトニック（度数を半音で）
const ROOT = 110; // A2
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];

// パターン（1=鳴らす）
const P_KICK = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
const P_SUB = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0];
const P_HAT = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1];
const P_ACID = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0];
const ACID_NOTES = [0, 0, 3, 0, 5, 0, 3, 7, 0, 0, 10, 0, 7, 5, 3, 0];
const P_RIFF = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
const RIFF_NOTES = [12, 0, 0, 10, 0, 0, 7, 0, 12, 0, 0, 15, 0, 10, 0, 0];
const P_CLAP = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]; // 2・4拍にクラップ
const P_CHORD = [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]; // FEVERのスーパーソウ和音
const CHORD_INTERVALS = [0, 3, 7, 10]; // マイナー7th系

let ctx = null;
let filter = null; // マスターローパス（ミス時ダック）
let running = false;
let currentStep = 0;
let nextStepTime = 0;
let schedTimer = null;
let layer = 0; // 0..3
let fever = false;

function ensureChain() {
  ctx = getCtx();
  if (!ctx) return false;
  if (!filter) {
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 18000;
    filter.Q.value = 1;
    filter.connect(getBgmBus());
  }
  return true;
}

function stepDur() {
  const bpm = BPM_BASE + (fever ? 8 : 0);
  return 60 / bpm / 4; // 16分音符
}

export function startBgm() {
  if (!ensureChain() || running) return;
  running = true;
  currentStep = 0;
  nextStepTime = ctx.currentTime + 0.05;
  schedTimer = setInterval(scheduler, TICK);
}

export function stopBgm() {
  running = false;
  if (schedTimer) clearInterval(schedTimer);
  schedTimer = null;
}

export function setBgmLayer(l) {
  layer = Math.max(0, Math.min(3, l));
}

export function setFever(on) {
  fever = !!on;
  if (filter && ctx) {
    // FEVERはフィルタ全開で明るく
    filter.frequency.setTargetAtTime(on ? 20000 : 18000, ctx.currentTime, 0.1);
  }
}

// ミス: フィルタを一瞬閉じて水中化→復帰。
export function duckForMiss() {
  if (!filter || !ctx) return;
  const t = ctx.currentTime;
  filter.frequency.cancelScheduledValues(t);
  filter.frequency.setValueAtTime(filter.frequency.value, t);
  filter.frequency.exponentialRampToValueAtTime(300, t + 0.05);
  filter.frequency.exponentialRampToValueAtTime(fever ? 20000 : 18000, t + 0.8);
}

function scheduler() {
  if (!running || !ctx) return;
  while (nextStepTime < ctx.currentTime + LOOKAHEAD) {
    scheduleStep(currentStep, nextStepTime);
    nextStepTime += stepDur();
    currentStep = (currentStep + 1) % STEPS;
  }
}

function scheduleStep(step, time) {
  // L0: キック + サブベース（常時）
  if (P_KICK[step]) kick(time);
  if (P_SUB[step]) sub(ROOT, time);
  if (P_CLAP[step]) clap(time); // 2・4拍のクラップは常時（ノリを強く）

  // L1: ハイハット + アシッドベース
  if (layer >= 1) {
    if (P_HAT[step]) hat(time, step % 4 === 3 ? 0.28 : 0.16);
    if (P_ACID[step]) acid(ROOT * 2 * semi(ACID_NOTES[step]), time);
  }
  // L2: シンセリフ + 常時アルペジオ
  if (layer >= 2) {
    if (P_RIFF[step]) riff(ROOT * 2 * semi(RIFF_NOTES[step]), time);
    if (step % 2 === 1) {
      const n = PENTA[((step - 1) / 2) % PENTA.length];
      lead(ROOT * 4 * semi(n), time, 0.06);
    }
  }
  // L3 / FEVER: リードアルペジオ全開＋スーパーソウ和音
  if (layer >= 3 || fever) {
    if (step % 2 === 0) {
      const n = PENTA[(step / 2) % PENTA.length];
      lead(ROOT * 4 * semi(n), time, 0.12);
    }
    if (fever && P_CHORD[step]) superSaw(ROOT * 2, CHORD_INTERVALS, time);
  }
}

// --- 楽器 ---

function kick(t) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(filter);
  o.start(t);
  o.stop(t + 0.2);
}

function sub(freq, t) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(filter);
  o.start(t);
  o.stop(t + 0.24);
}

function hat(t, peak) {
  const buf = getNoiseBuffer();
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  src.connect(hp).connect(g).connect(filter);
  src.start(t);
  src.stop(t + 0.05);
}

function acid(freq, t) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq, t);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(freq * 6, t);
  lp.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.12);
  lp.Q.value = 8; // レゾナンスでアシッド感
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.28, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(lp).connect(g).connect(filter);
  o.start(t);
  o.stop(t + 0.16);
}

function riff(freq, t) {
  const o1 = ctx.createOscillator();
  o1.type = 'square';
  o1.frequency.setValueAtTime(freq, t);
  const o2 = ctx.createOscillator();
  o2.type = 'square';
  o2.frequency.setValueAtTime(freq, t);
  o2.detune.setValueAtTime(10, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o1.connect(g);
  o2.connect(g);
  g.connect(filter);
  o1.start(t);
  o2.start(t);
  o1.stop(t + 0.18);
  o2.stop(t + 0.18);
}

function lead(freq, t, peak = 0.12) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  o.connect(g).connect(filter);
  o.start(t);
  o.stop(t + 0.14);
}

// クラップ（複数のノイズバーストで厚みを出す）。
function clap(t) {
  const buf = getNoiseBuffer();
  if (!buf) return;
  for (const off of [0, 0.008, 0.016]) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1600;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    const st = t + off;
    g.gain.setValueAtTime(0.25, st);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.08);
    src.connect(bp).connect(g).connect(filter);
    src.start(st);
    src.stop(st + 0.1);
  }
}

// スーパーソウ和音（デチューン多重ソウでぶ厚い）。
function superSaw(root, intervals, t) {
  for (const iv of intervals) {
    const f = root * semi(iv);
    for (const det of [-12, 0, 12]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.detune.setValueAtTime(det, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(filter);
      o.start(t);
      o.stop(t + 0.38);
    }
  }
}
