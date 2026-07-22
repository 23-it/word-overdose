// sfx.js — 効果音のWebAudio合成。超ド派手・ジャックポット級のハードデジタルSE。
// ゲーム側はここの play* を呼ぶだけ。AudioContext未解錠なら黙って無視する。

import { getCtx, getSfxBus, getNoiseBuffer } from './engine.js';

const semi = (n) => Math.pow(2, n / 12);
// メジャーペンタトニック（駆け上がる爽快感）。コンボで1段ずつ上がる。
const PENTA = [0, 2, 4, 7, 9];

// ---- 基本ボイス ----

// 単発オシレータ + エンベロープ。
function tone(freq, { type = 'square', dur = 0.12, attack = 0.004, peak = 0.4, detune = 0, dest, glideTo } = {}) {
  const ctx = getCtx();
  if (!ctx) return;
  const bus = dest || getSfxBus();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  if (detune) osc.detune.setValueAtTime(detune, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// FMベル（キラキラした金属的アタック）。
function fmBell(freq, { dur = 0.35, peak = 0.4, modRatio = 3.5, modDepth = 320, dest } = {}) {
  const ctx = getCtx();
  if (!ctx) return;
  const bus = dest || getSfxBus();
  const t = ctx.currentTime;
  const carrier = ctx.createOscillator();
  carrier.type = 'sine';
  carrier.frequency.setValueAtTime(freq, t);
  const mod = ctx.createOscillator();
  mod.type = 'sine';
  mod.frequency.setValueAtTime(freq * modRatio, t);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(modDepth, t);
  modGain.gain.exponentialRampToValueAtTime(1, t + dur);
  mod.connect(modGain).connect(carrier.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  carrier.connect(g).connect(bus);
  carrier.start(t);
  mod.start(t);
  carrier.stop(t + dur + 0.02);
  mod.stop(t + dur + 0.02);
}

// サブベースの一撃（ズシン）。
function subHit(freq = 70, { dur = 0.25, peak = 0.7 } = {}) {
  const ctx = getCtx();
  if (!ctx) return;
  const bus = getSfxBus();
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq * 2.4, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ノイズヒット（シンバル/スパークル/シャワー）。
function noiseHit(dur = 0.3, peak = 0.35, { type = 'highpass', freq = 6000, dest } = {}) {
  const ctx = getCtx();
  const buf = getNoiseBuffer();
  if (!ctx || !buf) return;
  const bus = dest || getSfxBus();
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt).connect(g).connect(bus);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// スーパーソウ和音スタブ（ぶ厚い）。
function chordStab(root, intervals, { dur = 0.3, peak = 0.14, type = 'sawtooth' } = {}) {
  for (const iv of intervals) {
    tone(root * semi(iv), { type, dur, peak, detune: -8 });
    tone(root * semi(iv), { type, dur, peak, detune: 8 });
  }
}

// 上昇アルペジオのきらめき。
function arpUp(root, steps, { gap = 45, dur = 0.14, peak = 0.3, type = 'square' } = {}) {
  steps.forEach((s, i) => {
    setTimeout(() => {
      tone(root * semi(s), { type, dur, peak });
      tone(root * semi(s) * 2, { type: 'triangle', dur: dur * 0.7, peak: peak * 0.5 });
    }, i * gap);
  });
}

// ---- 公開SE ----

// 正解: コンボでペンタトニックを駆け上がる。節目でファンファーレ＆シンバル。
export function playCorrect(combo = 0) {
  const ctx = getCtx();
  if (!ctx) return;
  const idx = combo <= 0 ? 0 : combo - 1;
  const octave = Math.floor(idx / PENTA.length);
  const degree = PENTA[idx % PENTA.length];
  const base = 523.25; // C5
  const freq = base * semi(degree) * Math.pow(2, Math.min(octave, 2));

  // メイン: 明るいFMベル
  fmBell(freq, { dur: 0.3, peak: 0.42, modRatio: 3, modDepth: 280 });
  // オクターブ上のキラッ
  tone(freq * 2, { type: 'triangle', dur: 0.12, peak: 0.2 });
  // 下支えのサブ
  subHit(90, { dur: 0.14, peak: 0.4 });
  // 高域スパークル
  noiseHit(0.14, 0.16, { type: 'highpass', freq: 9000 });

  // 5コンボごと: 上昇アルペジオのフラッシュ
  if (combo > 0 && combo % 5 === 0) {
    arpUp(freq, [0, 4, 7, 12], { gap: 40, dur: 0.12, peak: 0.26 });
  }
  // 10コンボごと: ファンファーレ（和音＋ブラス＋シンバル＋大サブ）
  if (combo > 0 && combo % 10 === 0) {
    chordStab(freq, [0, 4, 7, 12], { dur: 0.4, peak: 0.13 });
    tone(freq * semi(7), { type: 'sawtooth', dur: 0.35, peak: 0.22, detune: 10 });
    noiseHit(0.5, 0.3, { type: 'highpass', freq: 4000 }); // クラッシュ
    subHit(60, { dur: 0.4, peak: 0.7 });
  }
}

// ミス: 大袈裟なダウナー（下降デチューンソウ＋ブザー＋ビットクラッシュノイズ）。
export function playMiss() {
  const ctx = getCtx();
  if (!ctx) return;
  const bus = getSfxBus();
  const t = ctx.currentTime;
  // 下降デチューン2音
  for (const det of [-14, 14]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.45);
    o.detune.setValueAtTime(det, t);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(lp).connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.52);
  }
  // ブザー（矩形の不協和）
  tone(160, { type: 'square', dur: 0.35, peak: 0.22 });
  tone(160 * semi(1), { type: 'square', dur: 0.35, peak: 0.2 });
  // ノイズのバースト
  noiseHit(0.25, 0.3, { type: 'bandpass', freq: 700 });
}

export function playButton() {
  tone(880, { type: 'square', dur: 0.05, peak: 0.28, attack: 0.002 });
  tone(1320, { type: 'square', dur: 0.06, peak: 0.16, glideTo: 1760 });
}

export function playCountdownTick(n = 3) {
  const map = { 3: 440, 2: 554, 1: 740 };
  const f = map[n] || 440;
  if (n === 1) {
    // GO!: 特大スタブ＋サブ＋シンバル
    fmBell(f, { dur: 0.4, peak: 0.5, modRatio: 2, modDepth: 200 });
    chordStab(f, [0, 4, 7], { dur: 0.35, peak: 0.14 });
    subHit(70, { dur: 0.35, peak: 0.6 });
    noiseHit(0.4, 0.28, { type: 'highpass', freq: 5000 });
  } else {
    fmBell(f, { dur: 0.18, peak: 0.45, modRatio: 1.5, modDepth: 120 });
    subHit(100, { dur: 0.12, peak: 0.35 });
  }
}

export function playFeverStart() {
  const ctx = getCtx();
  if (!ctx) return;
  const bus = getSfxBus();
  const t = ctx.currentTime;
  // ライザー: ノイズ上昇＋ピッチスイープ＋サイレン
  const noise = ctx.createBufferSource();
  const buf = getNoiseBuffer();
  if (buf) {
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(8000, t + 0.7);
    bp.Q.value = 2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.4, t + 0.65);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    noise.connect(bp).connect(ng).connect(bus);
    noise.start(t);
    noise.stop(t + 0.9);
  }
  const sweep = ctx.createOscillator();
  sweep.type = 'sawtooth';
  sweep.frequency.setValueAtTime(200, t);
  sweep.frequency.exponentialRampToValueAtTime(2400, t + 0.7);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t);
  sg.gain.exponentialRampToValueAtTime(0.3, t + 0.6);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
  sweep.connect(sg).connect(bus);
  sweep.start(t);
  sweep.stop(t + 0.8);

  // ドロップの大一撃
  setTimeout(() => {
    subHit(55, { dur: 0.6, peak: 0.8 });
    chordStab(261.63, [0, 3, 7, 10, 12], { dur: 0.6, peak: 0.12 });
    noiseHit(0.6, 0.35, { type: 'highpass', freq: 3000 });
  }, 700);
}

export function playLevelUp() {
  const base = 523.25;
  arpUp(base, [0, 4, 7, 12, 16, 19], { gap: 65, dur: 0.2, peak: 0.34 });
  setTimeout(() => {
    chordStab(base * 2, [0, 4, 7], { dur: 0.5, peak: 0.13 });
    noiseHit(0.5, 0.25, { type: 'highpass', freq: 7000 });
  }, 6 * 65);
}

let tallyTimer = null;
export function playResultTally() {
  stopTally();
  let i = 0;
  tallyTimer = setInterval(() => {
    tone(880 + (i % 5) * 60, { type: 'square', dur: 0.04, peak: 0.14 });
    i++;
    if (i > 28) stopTally();
  }, 42);
}
export function stopTally() {
  if (tallyTimer) {
    clearInterval(tallyTimer);
    tallyTimer = null;
  }
}

export function playNewRecord() {
  const base = 659.25; // E5
  // 大ファンファーレ: ブラス風スタブの上昇＋シンバル＋サブ
  const melody = [0, 4, 7, 12, 7, 12];
  melody.forEach((s, i) => {
    setTimeout(() => {
      tone(base * semi(s), { type: 'sawtooth', dur: 0.22, peak: 0.26, detune: 8 });
      tone(base * semi(s), { type: 'sawtooth', dur: 0.22, peak: 0.26, detune: -8 });
      fmBell(base * semi(s) * 2, { dur: 0.2, peak: 0.24, modRatio: 3, modDepth: 200 });
    }, i * 120);
  });
  setTimeout(() => {
    chordStab(base, [0, 4, 7, 12], { dur: 0.7, peak: 0.13 });
    subHit(65, { dur: 0.6, peak: 0.7 });
    noiseHit(0.7, 0.32, { type: 'highpass', freq: 4000 });
  }, melody.length * 120);
}
