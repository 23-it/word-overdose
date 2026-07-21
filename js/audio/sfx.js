// sfx.js — 効果音（Phase 1: スタブ）。Phase 3でWebAudio合成。
// ゲーム側の呼び出しポイントを固定するためのインターフェース。

// combo: 現在のコンボ数（正解SEのピッチ上昇に使う）
export function playCorrect(combo = 0) {}
export function playMiss() {}
export function playButton() {}
export function playCountdownTick(n) {} // 3,2,1
export function playFeverStart() {}
export function playLevelUp() {}
export function playResultTally() {}
export function playNewRecord() {}
