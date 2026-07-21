// effects.js — 演出オーケストレータ。canvas.js のループから update() で駆動される。
// DOM(#app)のシェイク/パンチ、Canvasのフラッシュ・パーティクル・FEVER背景・コンボ破砕を管理。

import { ParticleSystem } from './particles.js';

let intensity = 'full'; // 'full' | 'reduced'
let appEl = null;
const particles = new ParticleSystem();

const state = {
  shake: 0, // 現在のシェイク強度
  flash: null, // { color, alpha }
  freeze: 0, // ヒットストップ残りms（>0で物理停止）
  fever: false,
  feverT: 0,
  shatter: [], // 破砕する数字の破片
  punch: 0, // DOMパンチ量
};

const COMBO_COLORS = [
  ['#00f0ff', '#7dfcff'],
  ['#29ff9b', '#00f0ff'],
  ['#ffe600', '#ff2bd6'],
  ['#ff2bd6', '#ffe600', '#00f0ff'],
];

export function initEffects(appElement) {
  appEl = appElement;
}

export function setIntensity(v) {
  intensity = v === 'reduced' ? 'reduced' : 'full';
}
export function isReduced() {
  return intensity === 'reduced';
}
function k() {
  // reduced時は演出量を落とす係数
  return intensity === 'reduced' ? 0.4 : 1;
}

// 正解パーティクル爆発。コンボが上がるほど派手に。
export function burstCorrect(x, y, combo = 0) {
  const tier = combo >= 20 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1 : 0;
  const colors = COMBO_COLORS[tier];
  const count = Math.round((18 + tier * 14) * k());
  particles.emit(x, y, {
    count,
    speed: 5 + tier * 1.5,
    spread: Math.PI * 2,
    colors,
    size: 4 + tier,
    life: 650 + tier * 150,
    gravity: 0.03,
    shape: combo % 10 === 0 && combo > 0 ? 'circle' : 'rect',
  });
  // 上向きの噴水
  particles.emit(x, y, {
    count: Math.round((6 + tier * 4) * k()),
    speed: 7 + tier * 2,
    spread: Math.PI / 3,
    angle: -Math.PI / 2,
    colors,
    size: 3 + tier,
    life: 800,
    gravity: 0.05,
  });
}

export function shake(strength = 1) {
  state.shake = Math.max(state.shake, strength * 8 * k());
}

export function flash(color = '#ffffff') {
  const alpha = (color.includes('red') || color === '#ff3b5c' ? 0.5 : 0.4) * (intensity === 'reduced' ? 0.4 : 1);
  state.flash = { color: resolveColor(color), alpha };
}

export function hitStop(ms = 50) {
  state.freeze = Math.max(state.freeze, ms * (intensity === 'reduced' ? 0.5 : 1));
  state.punch = Math.max(state.punch, 1);
}

// コンボ数字が砕けて飛び散る。
export function comboShatter(combo = 0) {
  if (combo < 2) return;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.28;
  const pieces = Math.min(24, 8 + combo);
  for (let i = 0; i < pieces * k(); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 3 + Math.random() * 6;
    state.shatter.push({
      x: cx + (Math.random() - 0.5) * 60,
      y: cy + (Math.random() - 0.5) * 30,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 3,
      life: 900,
      maxLife: 900,
      size: 10 + Math.random() * 18,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
    });
  }
  // 赤い破片も飛ばす
  particles.emit(cx, cy, {
    count: Math.round(20 * k()),
    speed: 6,
    colors: ['#ff3b5c', '#ff2bd6'],
    size: 5,
    life: 700,
    gravity: 0.08,
  });
}

export function feverBackground(on) {
  state.fever = !!on;
}

export function resetAll() {
  particles.clear();
  state.shake = 0;
  state.flash = null;
  state.freeze = 0;
  state.fever = false;
  state.shatter.length = 0;
  state.punch = 0;
  if (appEl) appEl.style.transform = '';
}

// canvas.js から毎フレーム呼ばれる。
export function update(dt, ctx, w, h) {
  // ヒットストップ中はパーティクル物理を止める（余韻を作る）
  const frozen = state.freeze > 0;
  if (frozen) state.freeze -= dt;
  const pdt = frozen ? 0 : dt;

  // FEVER背景（走るネオングリッド＋色相回転）
  if (state.fever) {
    state.feverT += dt;
    drawFeverBg(ctx, w, h, state.feverT);
  }

  // パーティクル
  particles.update(pdt, ctx);

  // コンボ破砕片
  drawShatter(ctx, pdt);

  // フラッシュ（全画面）
  if (state.flash) {
    ctx.save();
    ctx.globalAlpha = state.flash.alpha;
    ctx.fillStyle = state.flash.color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    state.flash.alpha -= dt / 250;
    if (state.flash.alpha <= 0) state.flash = null;
  }

  // DOMシェイク＆パンチ
  applyDomTransform(dt);
}

function drawFeverBg(ctx, w, h, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const hue = (t * 0.15) % 360;
  const lines = 14;
  for (let i = 0; i < lines; i++) {
    const p = ((t * 0.0004 + i / lines) % 1);
    const y = p * h;
    ctx.globalAlpha = 0.12 * (intensity === 'reduced' ? 0.4 : 1);
    ctx.strokeStyle = `hsl(${(hue + i * 25) % 360}, 100%, 60%)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + Math.sin(t * 0.003 + i) * 20);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShatter(ctx, dt) {
  const f = dt / 16.67;
  for (let i = state.shatter.length - 1; i >= 0; i--) {
    const s = state.shatter[i];
    s.life -= dt;
    if (s.life <= 0) {
      state.shatter.splice(i, 1);
      continue;
    }
    s.vy += 0.25 * f;
    s.x += s.vx * f;
    s.y += s.vy * f;
    s.rot += s.vr * f;
    const alpha = Math.max(0, s.life / s.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.fillStyle = '#ffe600';
    ctx.shadowColor = '#ff2bd6';
    ctx.shadowBlur = 10;
    ctx.fillRect(-s.size / 2, -s.size / 6, s.size, s.size / 3);
    ctx.restore();
  }
}

function applyDomTransform(dt) {
  if (!appEl) return;
  let tf = '';
  if (state.shake > 0.2) {
    const dx = (Math.random() - 0.5) * state.shake;
    const dy = (Math.random() - 0.5) * state.shake;
    tf += `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) `;
    state.shake *= Math.pow(0.001, dt / 1000); // 減衰
    if (state.shake < 0.2) state.shake = 0;
  }
  if (state.punch > 0.01) {
    const scale = 1 + 0.03 * state.punch;
    tf += `scale(${scale.toFixed(3)})`;
    state.punch -= dt / 90;
    if (state.punch < 0.01) state.punch = 0;
  }
  appEl.style.transform = tf;
}

function resolveColor(c) {
  if (c === 'var(--red)') return '#ff3b5c';
  if (c === 'var(--cyan)') return '#00f0ff';
  if (c.startsWith('var(')) return '#ffffff';
  return c;
}
