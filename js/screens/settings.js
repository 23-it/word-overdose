// settings.js — 音量・エフェクト強度・データリセット。

import * as engine from '../audio/engine.js';

let ctx = null;
const el = {};

export function initSettings(appCtx) {
  ctx = appCtx;
  el.bgm = document.getElementById('set-bgm');
  el.sfx = document.getElementById('set-sfx');
  el.lblBgm = document.getElementById('lbl-bgm');
  el.lblSfx = document.getElementById('lbl-sfx');
  el.mute = document.getElementById('set-mute');
  el.intensity = document.getElementById('set-intensity');

  document.getElementById('btn-back').addEventListener('click', () => {
    ctx.sfx.playButton();
    ctx.navigate('home');
  });

  el.bgm.addEventListener('input', () => save({ bgmVolume: parseFloat(el.bgm.value) }));
  el.sfx.addEventListener('input', () => save({ sfxVolume: parseFloat(el.sfx.value) }));

  el.mute.addEventListener('click', (e) => {
    const v = e.target.dataset.v;
    if (!v) return;
    ctx.sfx.playButton();
    save({ muted: v === 'on' });
  });
  el.intensity.addEventListener('click', (e) => {
    const v = e.target.dataset.v;
    if (!v) return;
    ctx.sfx.playButton();
    ctx.effects.setIntensity(v);
    save({ effectIntensity: v });
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('全データを消去します。よろしいですか？')) {
      ctx.store.resetAll();
      render();
      ctx.effects.setIntensity('full');
    }
  });
}

function save(patch) {
  const next = ctx.store.setSettings(patch);
  engine.applyAudioSettings(next);
  render();
}

export function showSettings(appCtx) {
  ctx = appCtx || ctx;
  render();
}

function render() {
  const s = ctx.store.getSettings();
  el.bgm.value = s.bgmVolume;
  el.sfx.value = s.sfxVolume;
  el.lblBgm.textContent = Math.round(s.bgmVolume * 100) + '%';
  el.lblSfx.textContent = Math.round(s.sfxVolume * 100) + '%';
  setSeg(el.mute, s.muted ? 'on' : 'off');
  setSeg(el.intensity, s.effectIntensity);
}

function setSeg(container, value) {
  for (const b of container.children) b.classList.toggle('on', b.dataset.v === value);
}
