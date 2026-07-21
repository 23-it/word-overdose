// combo.js — コンボ・倍率・FEVER判定（純ロジック、DOM非依存）
//
// 倍率テーブル: コンボ数に応じた得点倍率。
//   1x (0-4), 2x (5-9), 4x (10-19), 8x (20-29), 16x (30+)
// FEVER: 20コンボ到達で突入。突入後は「10問経過」または「ミス」で終了。
//   FEVER中はスコア2倍（倍率とは別に乗る）。

export const COMBO_TIERS = [
  { min: 30, mult: 16 },
  { min: 20, mult: 8 },
  { min: 10, mult: 4 },
  { min: 5, mult: 2 },
  { min: 0, mult: 1 },
];

export const FEVER_THRESHOLD = 20;
export const FEVER_DURATION = 10; // FEVER中に解ける最大問数
export const FEVER_SCORE_MULT = 2;

export function multiplierForCombo(combo) {
  for (const tier of COMBO_TIERS) {
    if (combo >= tier.min) return tier.mult;
  }
  return 1;
}

// コンボ状態を保持する軽量ステートマシン。
export class ComboState {
  constructor() {
    this.combo = 0;
    this.maxCombo = 0;
    this.fever = false;
    this.feverQuestionsLeft = 0;
  }

  get multiplier() {
    return multiplierForCombo(this.combo);
  }

  // 正解時。戻り値で「この正解で何が起きたか」を返す（演出のトリガー用）。
  correct() {
    const prevMult = this.multiplier;
    this.combo += 1;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    let enteredFever = false;
    if (!this.fever && this.combo >= FEVER_THRESHOLD) {
      this.fever = true;
      this.feverQuestionsLeft = FEVER_DURATION;
      enteredFever = true;
    }

    // この問題自体がFEVER中に解かれたかどうか（終了判定より前に確定させる）。
    const scoredUnderFever = this.fever;

    let feverEnded = false;
    if (this.fever) {
      this.feverQuestionsLeft -= 1;
      if (this.feverQuestionsLeft <= 0) {
        this.fever = false;
        feverEnded = true;
      }
    }

    const newMult = this.multiplier;
    return {
      combo: this.combo,
      multiplier: newMult,
      multiplierUp: newMult > prevMult,
      enteredFever,
      feverEnded,
      scoreMultiplier: newMult * (scoredUnderFever ? FEVER_SCORE_MULT : 1),
    };
  }

  // ミス時。コンボは全損、FEVERも即終了。
  miss() {
    const hadFever = this.fever;
    const lostCombo = this.combo;
    this.combo = 0;
    this.fever = false;
    this.feverQuestionsLeft = 0;
    return { lostCombo, feverEnded: hadFever };
  }
}
