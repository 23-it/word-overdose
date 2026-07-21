// sfx.js — 効果音のWebAudio合成。超デジタル・ハードなシンセSE。
// ゲーム側はここの play* を呼ぶだけ。AudioContext未解錠なら黙って無視する。

import { getCtx, getSfxBus, getNoiseBuffer } from './engine.js';

const semi = (n) => Math.pow(2, n / 12);

// 単発オシレータ + エンベロープの基本ボイス。
function voice(freq, { type = 'square', dur = 0.12, attack = 0.004, peak = 0.5, detune = 0, dest } = {}) {
  const ctx = getCtx();
  if (!ctx) return null;
  const bus = dest || getSfxBus();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (detune) osc.detune.setValueAtTime(detune, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  return { osc, g, t };
}

// 正解: コンボで半音ずつ上昇、10コンボごとにオクターブリセット＋和音化。
export function playCorrect(combo = 0) {
  const ctx = getCtx();
  if (!ctx) return;
  const step = combo <= 0 ? 0 : (combo - 1) % 12; // 0..11 半音
  const octaveBoost = Math.floor((combo - 1) / 12) * 0; // ベースは据え置き（暴走防止）
  const base = 523.25; // C5
  const freq = base * semi(step + octaveBoost);

  // メイン: FM風（キャリア + モジュレータ）
  fmStab(freq, { dur: 0.14, peak: 0.5, modRatio: 2.0, modDepth: 180 });
  // キラッと上物
  voice(freq * 2, { type: 'triangle', dur: 0.09, peak: 0.18 });

  // 10コンボ達成の節目は和音（メジャートライアド）でご褒美感
  if (combo > 0 && combo % 10 === 0) {
    voice(freq * semi(4), { type: 'square', dur: 0.22, peak: 0.28 });
    voice(freq * semi(7), { type: 'square', dur: 0.26, peak: 0.28 });
    voice(freq * 2, { type: 'sawtooth', dur: 0.3, peak: 0.2, detune: 8 });
    blip(freq * 3, 0.3);
  }
}

// FM風スタブ。
function fmStab(freq, { dur = 0.14, peak = 0.5, modRatio = 2, modDepth = 150, dest } = {}) {
  const ctx = getCtx();
  if (!ctx) return;
  const bus = dest || getSfxBus();
  const t = ctx.currentTime;
  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(freq, t);
  const mod = ctx.createOscillator();
  mod.type = 'square';
  mod.frequency.setValueAtTime(freq * modRatio, t);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(modDepth, t);
  modGain.gain.exponentialRampToValueAtTime(1, t + dur);
  mod.connect(modGain).connect(carrier.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  carrier.connect(g).connect(bus);
  carrier.start(t);
  mod.start(t);
  carrier.stop(t + dur + 0.02);
  mod.stop(t + dur + 0.02);
}

// ミス: ビットクラッシュ風ダウナー（下降ノコギリ＋ノイズ）。
export function playMiss() {
  const ctx = getCtx();
  if (!ctx) return;
  const bus = getSfxBus();
  const t = ctx.currentTime;
  // 下降トーン
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.35);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.4, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  // ざらつくローパス
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1200, t);
  lp.frequency.exponentialRampToValueAtTime(200, t + 0.35);
  osc.connect(lp).connect(g).connect(bus);
  osc.start(t);
  osc.stop(t + 0.42);
  // ノイズのバースト
  noiseBurst(0.18, 0.25, 800);
}

function noiseBurst(dur = 0.15, peak = 0.3, cutoff = 2000) {
  const ctx = getCtx();
  const buf = getNoiseBuffer();
  if (!ctx || !buf) return;
  const bus = getSfxBus();
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(bus);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function blip(freq, peak = 0.25) {
  voice(freq, { type: 'square', dur: 0.05, peak, attack: 0.002 });
}

export function playButton() {
  blip(880, 0.22);
  blip(1320, 0.12);
}

export function playCountdownTick(n = 3) {
  // n=3,2,1 で音程が上がる。1(GO)は一番高く長め。
  const map = { 3: 440, 2: 554, 1: 740 };
  const f = map[n] || 440;
  fmStab(f, { dur: n === 1 ? 0.3 : 0.16, peak: 0.5, modRatio: 1.5, modDepth: 120 });
  if (n === 1) voice(f * 2, { type: 'triangle', dur: 0.35, peak: 0.2 });
}

export function playFeverStart() {
  const ctx = getCtx();
  if (!ctx) return;
  const bus = getSfxBus();
  const t = ctx.currentTime;
  // ライザー: ノイズ上昇 + スイープ
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(2000, t + 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
  osc.connect(g).connect(bus);
  osc.start(t);
  osc.stop(t + 0.8);
  // ドロップの一撃
  setTimeout(() => {
    fmStab(130.81, { dur: 0.5, peak: 0.6, modRatio: 1, modDepth: 200 });
    noiseBurst(0.4, 0.35, 400);
  }, 600);
}

export function playLevelUp() {
  // 上昇アルペジオ + シマー
  const base = 523.25;
  const steps = [0, 4, 7, 12, 16];
  steps.forEach((s, i) => {
    setTimeout(() => {
      voice(base * semi(s), { type: 'square', dur: 0.18, peak: 0.35 });
      voice(base * semi(s) * 2, { type: 'triangle', dur: 0.12, peak: 0.15 });
    }, i * 70);
  });
}

let tallyTimer = null;
export function playResultTally() {
  // ドララララ…転がるようなロール。
  stopTally();
  let i = 0;
  tallyTimer = setInterval(() => {
    voice(660 + (i % 4) * 40, { type: 'square', dur: 0.04, peak: 0.16 });
    i++;
    if (i > 24) stopTally();
  }, 45);
}
export function stopTally() {
  if (tallyTimer) {
    clearInterval(tallyTimer);
    tallyTimer = null;
  }
}

export function playNewRecord() {
  const base = 659.25; // E5
  const melody = [0, 0, 0, 5, 12];
  melody.forEach((s, i) => {
    setTimeout(() => {
      fmStab(base * semi(s), { dur: 0.2, peak: 0.4, modRatio: 2, modDepth: 160 });
      voice(base * semi(s) * 2, { type: 'triangle', dur: 0.15, peak: 0.18 });
    }, i * 110);
  });
}
