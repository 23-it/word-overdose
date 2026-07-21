// effects.js — 演出トリガー（Phase 1: スタブ的な最小実装）。Phase 4で本格化。
// game/result 画面はここの関数を呼ぶだけ。強度は設定(effectIntensity)に従う。

let intensity = 'full'; // 'full' | 'reduced'

export function setIntensity(v) {
  intensity = v;
}
export function isReduced() {
  return intensity === 'reduced';
}

// --- Phase 4で中身を実装する演出フック ---
export function burstCorrect(x, y, combo) {} // 正解パーティクル爆発
export function shake(strength = 1) {} // スクリーンシェイク
export function flash(color) {} // 画面フラッシュ（reducedなら減光）
export function hitStop(ms = 50) {} // ヒットストップ
export function comboShatter(combo) {} // コンボ数字の破砕
export function feverBackground(on) {} // FEVER中の背景エフェクト
export function resetAll() {}
