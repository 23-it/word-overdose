// result.js — リザルト。スコア確定→XP付与→ストリーク更新→ランキング登録。
// Phase 4でカウントアップ等の演出を強化する。

import { xpForResult } from '../core/score.js';
import { titleForLevel } from '../core/storage.js';

let ctx = null;
const el = {};

export function initResult(appCtx) {
  ctx = appCtx;
  el.rank = document.getElementById('result-rank');
  el.newrecord = document.getElementById('result-newrecord');
  el.score = document.getElementById('result-score');
  el.detail = document.getElementById('result-detail');
  el.level = document.getElementById('result-level');
  el.xp = document.getElementById('result-xp');

  document.getElementById('btn-retry').addEventListener('click', () => {
    ctx.sfx.playButton();
    ctx.navigate('game');
  });
  document.getElementById('btn-home').addEventListener('click', () => {
    ctx.sfx.playButton();
    ctx.navigate('home');
  });
}

export function showResult(appCtx, payload) {
  ctx = appCtx || ctx;
  const { score, rank, maxCombo, accuracy } = payload;

  // 永続化（結果画面到達時に一度だけ確定）
  const xpGain = xpForResult(score, maxCombo);
  const xpResult = ctx.store.addXp(xpGain);
  ctx.store.recordPlay();
  const rankResult = ctx.store.submitScore(score, rank);

  // 表示
  el.rank.textContent = rank;
  el.score.textContent = score;
  el.detail.textContent = `MAX COMBO ${maxCombo} ・ ACCURACY ${accuracy}%`;
  const lv = xpResult.after;
  el.level.textContent = `Lv.${lv.level} ${titleForLevel(lv.level)}  (+${xpGain} XP)`;

  el.newrecord.style.display = rankResult.isNewRecord ? '' : 'none';
  if (rankResult.isNewRecord) ctx.sfx.playNewRecord();
  if (xpResult.leveledUp) ctx.sfx.playLevelUp();
  ctx.sfx.playResultTally();

  // XPバー（レベル内進捗）。Phase 4でカウントアップ演出化。
  el.xp.style.width = '0%';
  const pct = Math.min(100, Math.round((lv.xpInLevel / lv.xpForLevel) * 100));
  requestAnimationFrame(() => {
    el.xp.style.width = pct + '%';
  });
}
