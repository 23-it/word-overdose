// home.js — タイトル画面。ストリーク・レベル・ベスト表示、START/SETTINGS。

import { titleForLevel } from '../core/storage.js';

export function initHome(ctx) {
  document.getElementById('btn-start').addEventListener('click', () => {
    ctx.sfx.playButton();
    ctx.navigate('game');
  });
  document.getElementById('btn-settings').addEventListener('click', () => {
    ctx.sfx.playButton();
    ctx.navigate('settings');
  });
}

export function showHome(ctx) {
  const streak = ctx.store.getStreak();
  const progress = ctx.store.getProgress();
  const ranking = ctx.store.getRanking();
  const best = ranking.length ? ranking[0].score : 0;

  document.getElementById('home-streak').textContent = `🔥 ${streak.count}日`;
  document.getElementById('home-level').textContent =
    `Lv.${progress.level} ${titleForLevel(progress.level)}`;
  document.getElementById('home-best').textContent = `BEST ${best}`;
}
