// canvas.js — 全画面FXレイヤー管理（Phase 1: 最小実装）。
// DOM UIの上に重ねる透明キャンバス。Phase 4でパーティクル等を本格化。

let canvas = null;
let ctx = null;
let running = false;
let effects = null; // effects.js が登録する更新関数群
let idleFrames = 0; // 描画対象が無い状態が続いたフレーム数

export function initCanvas(el) {
  canvas = el;
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

export function resize() {
  if (!canvas) return;
  // FXレイヤーは光の粒が主体で高精細である必要がない。
  // DPR3の端末だと全画面塗りのピクセル数が9倍になるため上限2に丸める。
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      const w = window.innerWidth;
      const h = window.innerHeight;
      // 描くものが無いフレームは全画面塗りを省く（ホーム画面などで無駄に走らせない）。
      // 直後は残像を消しきるまで数フレームだけ塗り続ける。
      const active = !effects || !effects.hasContent || effects.hasContent();
      if (active) idleFrames = 0;
      else idleFrames++;
      if (active || idleFrames <= 20) {
        if (effects && effects.motionBlur && effects.motionBlur()) {
          // 残像: destination-out で既存を少しずつ透明化（黒で塗らないのでDOMは隠さない）。
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = 'source-over';
        } else {
          ctx.clearRect(0, 0, w, h);
        }
      }
      // update は DOM の揺れ・明暗も担うので常に呼ぶ（描画分は中身が空なら走らない）。
      if (effects && effects.update) effects.update(dt, ctx, w, h);
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
