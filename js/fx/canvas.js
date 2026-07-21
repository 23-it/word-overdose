// canvas.js — 全画面FXレイヤー管理（Phase 1: 最小実装）。
// DOM UIの上に重ねる透明キャンバス。Phase 4でパーティクル等を本格化。

let canvas = null;
let ctx = null;
let running = false;
let effects = null; // effects.js が登録する更新関数群

export function initCanvas(el) {
  canvas = el;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

export function resize() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function registerEffects(fx) {
  effects = fx; // { update(dt, ctx, w, h), reset() }
}

export function start() {
  if (running) return;
  running = true;
  let last = performance.now();
  const loop = (now) => {
    if (!running) return;
    const dt = Math.min(50, now - last);
    last = now;
    if (ctx) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (effects && effects.update) effects.update(dt, ctx, window.innerWidth, window.innerHeight);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

export function stop() {
  running = false;
}

export function getCtx() {
  return ctx;
}
