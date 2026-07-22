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
  radials: [], // 集中線（回転スピードライン）
  rings: [], // 衝撃波リング
  aura: null, // 激アツ度に応じた放射オーラ { level, t, dur }
};

const COMBO_COLORS = [
  ['#00f0ff', '#7dfcff'],
  ['#29ff9b', '#00f0ff'],
  ['#ffe600', '#ff2bd6'],
  ['#ff2bd6', '#ffe600', '#00f0ff'],
];

// 激アツ度（0..4）。パチンコの「熱さ」ラダー。
const HEAT = [
  { name: '', colors: ['#00f0ff', '#7dfcff', '#ffffff'], glow: '#00f0ff', cls: 'h0' },
  { name: 'CHANCE!', colors: ['#29ff9b', '#00f0ff', '#ffffff'], glow: '#29ff9b', cls: 'h1' },
  { name: '激アツ!!', colors: ['#ff3b5c', '#ff2bd6', '#ffe600'], glow: '#ff3b5c', cls: 'h2' },
  { name: '激熱GOLD!!', colors: ['#ffe600', '#ffb300', '#fff3b0'], glow: '#ffd400', cls: 'h3' },
  { name: '大当り!!', colors: ['#ff2bd6', '#ffe600', '#00f0ff', '#29ff9b'], glow: '#ffffff', cls: 'h4' },
];

let cutinEl = null;
let cutinTimer = 0;

export function initEffects(appElement) {
  appEl = appElement;
  // カットイン文字のオーバーレイを用意（最前面）
  cutinEl = document.createElement('div');
  cutinEl.id = 'cutin';
  cutinEl.className = 'cutin hidden';
  document.body.appendChild(cutinEl);
}

// 正解の総合演出（パチンコ風）。game.js からはこれ一本を呼ぶ。
// o: { combo, multiplier, multiplierUp, enteredFever, milestone }
export function celebrate(x, y, o = {}) {
  const level = heatLevel(o);
  const heat = HEAT[level];

  // 基本: パーティクル爆発＋ヒットストップ＋シェイク＋ズームパンチ
  burstCorrect(x, y, o.combo || 0);
  hitStop(level >= 2 ? 90 : o.multiplierUp ? 70 : 45);
  shake(0.6 + level * 0.9);
  state.punch = Math.max(state.punch, 1 + level * 0.4);

  // 衝撃波リング（熱いほど多重）
  ring(x, y, heat.glow);
  if (level >= 2) ring(x, y, heat.colors[1], 90);
  if (level >= 3) ring(x, y, '#ffffff', 180);

  // 集中線（激アツ以上）
  if (level >= 2) radialLines(x, y, heat.glow, level);

  // オーラ（画面全体の放射グラデ）
  if (level >= 1) state.aura = { level, t: 0, dur: 500 + level * 150 };

  // フラッシュ／ストロボ
  if (level >= 4) strobe(heat.colors, 6, 55);
  else if (level >= 3) strobe(['#fff3b0', '#ffd400'], 3, 60);
  else if (level >= 1) flashColor(heat.colors[0], 0.35);

  // コイン/スターシャワー（激熱以上）
  if (level >= 3) coinShower(level);

  // カットイン文字
  let text = heat.name;
  if (o.milestone && o.combo) text = `${o.combo} COMBO!!`;
  if (o.enteredFever) text = 'FEVER!!';
  if (text) showCutin(text, heat.cls, level);
}

function heatLevel(o) {
  if (o.enteredFever || o.milestone) return 4; // 虹＝大当り確定
  if ((o.combo || 0) >= 20) return 3; // 金
  if (o.multiplierUp && (o.multiplier || 0) >= 8) return 3;
  if ((o.combo || 0) >= 10) return 2; // 赤
  if ((o.combo || 0) >= 5) return 1; // 緑
  return 0;
}

// 集中線をひとかたまり生成。
export function radialLines(x, y, color = '#ffffff', level = 2) {
  state.radials.push({
    x,
    y,
    color,
    count: Math.round((16 + level * 6) * (intensity === 'reduced' ? 0.5 : 1)),
    life: 420,
    maxLife: 420,
    rot: Math.random() * Math.PI,
    vr: 0.02 + level * 0.006,
  });
}

// 衝撃波リング。
export function ring(x, y, color = '#ffffff', delay = 0) {
  const push = () =>
    state.rings.push({ x, y, r: 8, life: 520, maxLife: 520, color, width: 6 });
  if (delay > 0) setTimeout(push, delay);
  else push();
}

// 上から降るコイン/スターの雨。
export function coinShower(level = 3) {
  const w = window.innerWidth;
  const drops = Math.round(level * 8 * k());
  for (let i = 0; i < drops; i++) {
    const x = Math.random() * w;
    particles.emit(x, -10, {
      count: 1,
      speed: 2 + Math.random() * 3,
      spread: 0.4,
      angle: Math.PI / 2, // 下向き
      colors: ['#ffe600', '#ffd400', '#fff3b0'],
      size: 7 + Math.random() * 6,
      life: 1400,
      gravity: 0.06,
      shape: 'circle',
    });
  }
}

// 短時間の全画面色フラッシュ（strobeの一枚）。
function flashColor(color, alpha = 0.4) {
  state.flash = { color: resolveColor(color), alpha: alpha * (intensity === 'reduced' ? 0.4 : 1) };
}

// 虹ストロボ: 連続フラッシュ。
export function strobe(colors, times = 5, interval = 55) {
  if (intensity === 'reduced') {
    flashColor(colors[0], 0.3);
    return;
  }
  let i = 0;
  const step = () => {
    flashColor(colors[i % colors.length], 0.5);
    i++;
    if (i < times) setTimeout(step, interval);
  };
  step();
}

// カットイン文字を表示。
export function showCutin(text, cls = 'h2', level = 2) {
  if (!cutinEl) return;
  cutinEl.textContent = text;
  cutinEl.className = `cutin ${cls}`;
  if (intensity === 'reduced') cutinEl.classList.add('reduced');
  void cutinEl.offsetWidth; // reflow でアニメ再start
  cutinEl.classList.add('show');
  clearTimeout(cutinTimer);
  cutinTimer = setTimeout(() => {
    cutinEl.classList.add('hidden');
    cutinEl.classList.remove('show');
  }, level >= 4 ? 900 : 650);
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
  state.radials.length = 0;
  state.rings.length = 0;
  state.aura = null;
  if (appEl) appEl.style.transform = '';
  if (cutinEl) {
    cutinEl.className = 'cutin hidden';
    clearTimeout(cutinTimer);
  }
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

  // 激アツオーラ（放射グラデ）
  drawAura(ctx, w, h, dt);

  // 集中線
  drawRadials(ctx, pdt);

  // 衝撃波リング
  drawRings(ctx, pdt);

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

function drawAura(ctx, w, h, dt) {
  if (!state.aura) return;
  state.aura.t += dt;
  const a = state.aura;
  const p = a.t / a.dur;
  if (p >= 1) {
    state.aura = null;
    return;
  }
  const heat = HEAT[a.level];
  const alpha = Math.sin(p * Math.PI) * 0.4 * (intensity === 'reduced' ? 0.4 : 1);
  const cx = w / 2;
  const cy = h * 0.42;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.6, 'transparent');
  grad.addColorStop(1, heat.glow);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawRadials(ctx, dt) {
  for (let i = state.radials.length - 1; i >= 0; i--) {
    const r = state.radials[i];
    r.life -= dt;
    if (r.life <= 0) {
      state.radials.splice(i, 1);
      continue;
    }
    r.rot += r.vr * (dt / 16.67);
    const alpha = Math.max(0, r.life / r.maxLife);
    const grow = 1 - alpha; // 内側から広がる
    const inner = 30 + grow * 120;
    const outer = Math.max(window.innerWidth, window.innerHeight);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = r.color;
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 8;
    ctx.translate(r.x, r.y);
    ctx.rotate(r.rot);
    for (let n = 0; n < r.count; n++) {
      const ang = (n / r.count) * Math.PI * 2;
      const wob = ((n % 2) * 0.5 + 0.5) * 4; // 太さ交互
      ctx.lineWidth = wob;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * inner, Math.sin(ang) * inner);
      ctx.lineTo(Math.cos(ang) * outer, Math.sin(ang) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawRings(ctx, dt) {
  for (let i = state.rings.length - 1; i >= 0; i--) {
    const r = state.rings[i];
    r.life -= dt;
    if (r.life <= 0) {
      state.rings.splice(i, 1);
      continue;
    }
    const p = 1 - r.life / r.maxLife;
    r.r = 8 + p * Math.max(window.innerWidth, window.innerHeight) * 0.7;
    const alpha = (1 - p) * 0.9;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = r.color;
    ctx.shadowColor = r.color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = r.width * (1 - p) + 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
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
