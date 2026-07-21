// main.js — エントリ。画面遷移ステートマシン＋共有コンテキスト。

import { Store } from './core/storage.js';
import { WORDS } from './data/words.js';
import * as engine from './audio/engine.js';
import * as sfx from './audio/sfx.js';
import * as effects from './fx/effects.js';
import { initCanvas, start as startCanvas, registerEffects } from './fx/canvas.js';

import { initHome, showHome } from './screens/home.js';
import { initGame, startGame } from './screens/game.js';
import { initResult, showResult } from './screens/result.js';
import { initSettings, showSettings } from './screens/settings.js';

const SCREENS = ['home', 'game', 'result', 'settings'];

// 全画面で共有するアプリコンテキスト。
const ctx = {
  store: new Store(),
  words: WORDS,
  sfx,
  effects,
  audioUnlocked: false,
  navigate,
  lastResult: null, // game → result 受け渡し
};

function show(name) {
  for (const s of SCREENS) {
    document.getElementById(`screen-${s}`).classList.toggle('active', s === name);
  }
}

// 画面遷移のハブ。
function navigate(name, payload) {
  switch (name) {
    case 'home':
      show('home');
      showHome(ctx);
      break;
    case 'game':
      show('game');
      startGame(ctx);
      break;
    case 'result':
      show('result');
      showResult(ctx, payload);
      break;
    case 'settings':
      show('settings');
      showSettings(ctx);
      break;
  }
}

// 初回ユーザージェスチャでオーディオ解錠（iOS対策）。
function bindAudioUnlock() {
  const unlock = async () => {
    if (ctx.audioUnlocked) return;
    ctx.audioUnlocked = true;
    await engine.unlockAudio();
    engine.applyAudioSettings(ctx.store.getSettings());
  };
  window.addEventListener('pointerdown', unlock, { once: false });
}

function boot() {
  // FXレイヤー
  initCanvas(document.getElementById('fx-canvas'));
  effects.initEffects(document.getElementById('app'));
  registerEffects({ update: effects.update });
  startCanvas();

  // 設定をエフェクト強度に反映
  effects.setIntensity(ctx.store.getSettings().effectIntensity);

  // 各画面を初期化（イベントバインド）
  initHome(ctx);
  initGame(ctx);
  initResult(ctx);
  initSettings(ctx);

  bindAudioUnlock();
  navigate('home');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
