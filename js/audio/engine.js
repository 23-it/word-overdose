// engine.js — オーディオ基盤（Phase 1: スタブ）。Phase 3で本実装。
// 全SE/BGMはここの AudioContext とマスターゲインを共有する。
// ゲーム側は sfx.* / bgm.* を呼ぶだけでよい設計にする。

let ctx = null;
let masterGain = null;
let settings = { bgmVolume: 0.7, sfxVolume: 0.9, muted: false };

// 初回ユーザージェスチャで呼ぶ（iOS Safari の resume 対策）。
export function unlockAudio() {
  // Phase 3: new AudioContext() を生成し resume()。今はno-op。
  return Promise.resolve();
}

export function applyAudioSettings(next) {
  settings = { ...settings, ...next };
  // Phase 3: masterGain.gain を更新。
}

export function getAudioContext() {
  return ctx;
}
export function getMasterGain() {
  return masterGain;
}
export function getAudioSettings() {
  return settings;
}
