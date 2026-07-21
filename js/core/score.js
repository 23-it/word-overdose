// score.js — スコア計算・ランク判定（純ロジック、DOM非依存）

export const BASE_POINTS = 100;

// 残り時間ボーナス: 速answ ほど加点（0..1 の割合で最大 +50%）。
export const SPEED_BONUS_MAX = 0.5;

// 1問分の獲得スコア。
//   base × comboScoreMultiplier × (1 + 速度ボーナス)
// comboScoreMultiplier は ComboState.correct() が返す scoreMultiplier。
export function questionScore(comboScoreMultiplier, timeRatio = 0) {
  const clamped = Math.max(0, Math.min(1, timeRatio));
  const speed = 1 + SPEED_BONUS_MAX * clamped;
  return Math.round(BASE_POINTS * comboScoreMultiplier * speed);
}

// ランク判定。20問プレイの理論値に対する達成度でざっくり分ける。
export const RANK_THRESHOLDS = [
  { rank: 'S', min: 30000 },
  { rank: 'A', min: 15000 },
  { rank: 'B', min: 6000 },
  { rank: 'C', min: 0 },
];

export function rankForScore(score) {
  for (const t of RANK_THRESHOLDS) {
    if (score >= t.min) return t.rank;
  }
  return 'C';
}

// スコアから獲得XPを算出（レベル進行用）。スコアの一定割合＋最大コンボボーナス。
export function xpForResult(score, maxCombo) {
  return Math.round(score / 10) + maxCombo * 5;
}
