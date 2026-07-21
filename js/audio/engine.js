// engine.js — オーディオ基盤。AudioContext・マスターゲイン・SE/BGM別バスを管理。
// 全SE/BGMはここのバスを共有する。iOS対策で初回ジェスチャに resume する。

let ctx = null;
let master = null; // 全体
let sfxBus = null; // 効果音バス
let bgmBus = null; // BGMバス
let settings = { bgmVolume: 0.7, sfxVolume: 0.9, muted: false };
let unlocked = false;

export function unlockAudio() {
  if (unlocked && ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return Promise.resolve(ctx);
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return Promise.resolve(null);
  ctx = new AC();

  master = ctx.createGain();
  master.gain.value = settings.muted ? 0 : 1;
  master.connect(ctx.destination);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = settings.sfxVolume;
  sfxBus.connect(master);

  bgmBus = ctx.createGain();
  bgmBus.gain.value = settings.bgmVolume;
  bgmBus.connect(master);

  unlocked = true;
  if (ctx.state === 'suspended') ctx.resume();
  return Promise.resolve(ctx);
}

export function applyAudioSettings(next) {
  settings = { ...settings, ...next };
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.02);
  sfxBus.gain.setTargetAtTime(settings.sfxVolume, t, 0.02);
  bgmBus.gain.setTargetAtTime(settings.bgmVolume, t, 0.02);
}

export function getCtx() {
  return ctx;
}
export function getSfxBus() {
  return sfxBus;
}
export function getBgmBus() {
  return bgmBus;
}
export function isUnlocked() {
  return unlocked;
}
export function now() {
  return ctx ? ctx.currentTime : 0;
}

// --- 合成ヘルパ（sfx/bgm から共用） ---

// 短いノイズバッファ（ハイハット・ミス音・パーカッションに使う）。
let noiseBuf = null;
export function getNoiseBuffer() {
  if (!ctx) return null;
  if (noiseBuf) return noiseBuf;
  const len = ctx.sampleRate * 1.0;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

// ADSR風のゲインエンベロープを組む。
export function envGain(bus, { attack = 0.005, decay = 0.1, sustain = 0, release = 0.05, peak = 1, startAt } = {}) {
  const g = ctx.createGain();
  const t = startAt ?? ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
  const sustainLevel = Math.max(0.0001, peak * sustain);
  g.gain.exponentialRampToValueAtTime(sustainLevel, t + attack + decay);
  g.connect(bus);
  return { node: g, startAt: t, sustainLevel, params: { attack, decay, sustain, release } };
}
