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
  stars: [], // インパクトスター（十字閃光）
  floats: [], // 飛び出すスコア文字
  bgFlash: 0, // 毎回の全画面バックフラッシュ
};

// 金基調の粒色（コンボ段階で少しずつ白金へ）。
const COMBO_COLORS = [
  ['#f8ecc0', '#d4af37', '#ffffff'],
  ['#f8ecc0', '#ffe9a8', '#d4af37'],
  ['#fff3c8', '#ffd76a', '#d4af37'],
  ['#ffffff', '#fff0b8', '#ffd76a', '#d4af37'],
];

// 度合い（0..4）。金の輝きが増していくラダー。文言も上質に。
const HEAT = [
  { name: '', colors: ['#f8ecc0', '#d4af37', '#ffffff'], glow: '#d4af37', cls: 'h0' },
  { name: 'FINE', colors: ['#f8ecc0', '#ffe9a8', '#d4af37'], glow: '#e8c874', cls: 'h1' },
  { name: 'EXCELLENT', colors: ['#fff3c8', '#ffd76a', '#d4af37'], glow: '#f0d98c', cls: 'h2' },
  { name: 'BRILLIANT', colors: ['#fff7e0', '#ffe9a8', '#ffd76a'], glow: '#ffd76a', cls: 'h3' },
  { name: 'MASTERPIECE', colors: ['#ffffff', '#fff7e0', '#ffd76a', '#d4af37'], glow: '#ffffff', cls: 'h4' },
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

// 低コンボでも出す称賛ワード（毎回カットインを出すため）。上質めの語彙で。
const HYPE_WORDS = ['GOOD', 'NICE', 'GREAT', 'SUPERB', 'SPLENDID', 'PERFECT', 'SUBLIME'];

// 正解の総合演出（パチンコ風・全部盛り）。game.js からはこれ一本を呼ぶ。
// o: { combo, multiplier, multiplierUp, enteredFever, milestone, score }
// 方針: 「毎回が大当り級」。1問目から確定演出レベルの物量をぶっぱなす。
export function celebrate(x, y, o = {}) {
  const level = heatLevel(o);
  const heat = HEAT[level];
  const b = 1 + level * 0.35; // 熱さ倍率

  // === 毎回必ず出る超派手ベース ===
  // 多層メガ爆発
  megaExplosion(x, y, heat, b);
  burstCorrect(x, y, o.combo || 0);

  // 全画面バックフラッシュ＋色フラッシュ（毎回）
  state.bgFlash = Math.max(state.bgFlash, 0.85);
  strobe(heat.colors, 2 + level, 50);

  // 十字インパクトスター（毎回・特大）
  impactStar(x, y, '#ffffff', 1.4);
  impactStar(x, y, heat.glow, 1.0);

  // 衝撃波リング（毎回3連＋熱さで追加）
  ring(x, y, '#ffffff');
  ring(x, y, heat.colors[0], 70);
  ring(x, y, heat.colors[1] || heat.colors[0], 150);
  if (level >= 2) ring(x, y, heat.glow, 230);

  // 集中線（毎回）
  radialLines(x, y, heat.glow, Math.max(2, level + 1));

  // 放射オーラ（毎回）
  state.aura = { level: Math.max(1, level), t: 0, dur: 480 + level * 150 };

  // 紙吹雪＆スターシャワー（毎回、上から降らす）
  confetti(heat.colors, 18 + level * 10);
  if (level >= 2) coinShower(level + 1);

  // 強ヒットストップ＋大ズーム＋大シェイク（毎回）
  hitStop(70 + level * 20);
  shake((2.0 + level * 0.9) * b);
  state.punch = Math.max(state.punch, 1.8 + level * 0.5);

  // 飛び出すスコア文字（毎回）
  if (o.score) floatText(x, y, '+' + o.score, heat.colors[0]);

  // カットイン文字（毎回。低コンボは景気づけワード）
  let text = HYPE_WORDS[(o.combo || 0) % HYPE_WORDS.length];
  let cls = heat.cls;
  if (level >= 1) text = heat.name;
  if (o.milestone && o.combo) text = `${o.combo} COMBO`;
  if (o.enteredFever) text = 'FEVER';
  showCutin(text, cls, level);
}

// 多層メガ爆発。放射・上昇噴水・きらめきの3レイヤーを一気に。
function megaExplosion(x, y, heat, b = 1) {
  const kk = k();
  // 放射（全方向）
  particles.emit(x, y, {
    count: Math.round(70 * b * kk),
    speed: 8 * b,
    spread: Math.PI * 2,
    colors: heat.colors,
    size: 5,
    life: 750,
    gravity: 0.04,
  });
  // 高速の細かい破片
  particles.emit(x, y, {
    count: Math.round(50 * b * kk),
    speed: 13 * b,
    spread: Math.PI * 2,
    colors: [...heat.colors, '#ffffff'],
    size: 3,
    life: 550,
    gravity: 0.02,
  });
  // 上向き噴水
  particles.emit(x, y, {
    count: Math.round(30 * b * kk),
    speed: 12 * b,
    spread: Math.PI / 2.5,
    angle: -Math.PI / 2,
    colors: heat.colors,
    size: 6,
    life: 950,
    gravity: 0.06,
    shape: 'circle',
  });
}

// 紙吹雪: 画面上部の全幅から降らす。
export function confetti(colors, count = 24) {
  const w = window.innerWidth;
  const n = Math.round(count * k());
  for (let i = 0; i < n; i++) {
    particles.emit(Math.random() * w, -12, {
      count: 1,
      speed: 1 + Math.random() * 3,
      spread: 0.6,
      angle: Math.PI / 2,
      colors,
      size: 6 + Math.random() * 8,
      life: 1500,
      gravity: 0.05,
    });
  }
}

// 十字インパクトスター（パチンコの閃光）。
export function impactStar(x, y, color = '#ffffff', scale = 1) {
  state.stars.push({ x, y, life: 380, maxLife: 380, color, scale, rot: Math.random() * Math.PI });
}

// 飛び出すスコア文字。
export function floatText(x, y, text, color = '#ffe600') {
  state.floats.push({ x, y, vy: -1.4, life: 900, maxLife: 900, text, color });
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
  const count = Math.round((60 + tier * 30) * k());
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
  // 破片を飛ばす（ミスの色）
  particles.emit(cx, cy, {
    count: Math.round(20 * k()),
    speed: 6,
    colors: ['#c23a54', '#7a2333'],
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
  state.stars.length = 0;
  state.floats.length = 0;
  state.bgFlash = 0;
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

  // 全画面バックフラッシュ（毎回の正解でパッと明るく）
  if (state.bgFlash > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = state.bgFlash * (intensity === 'reduced' ? 0.4 : 1);
    ctx.fillStyle = '#3a2c10';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    state.bgFlash -= dt / 200;
  }

  // 激アツオーラ（放射グラデ）
  drawAura(ctx, w, h, dt);

  // 集中線
  drawRadials(ctx, pdt);

  // 衝撃波リング
  drawRings(ctx, pdt);

  // パーティクル
  particles.update(pdt, ctx);

  // インパクトスター
  drawStars(ctx, pdt);

  // 飛び出すスコア文字
  drawFloats(ctx, pdt);

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

function drawStars(ctx, dt) {
  for (let i = state.stars.length - 1; i >= 0; i--) {
    const s = state.stars[i];
    s.life -= dt;
    if (s.life <= 0) {
      state.stars.splice(i, 1);
      continue;
    }
    const p = 1 - s.life / s.maxLife;
    const alpha = Math.max(0, 1 - p);
    const len = (60 + p * 260) * s.scale;
    const thick = (10 + (1 - p) * 22) * s.scale;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 20;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    // 十字＋斜め（8方向っぽい閃光）
    for (let a = 0; a < 4; a++) {
      ctx.rotate(Math.PI / 2);
      const l = a % 2 === 0 ? len : len * 0.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-thick / 2, -l * 0.5);
      ctx.lineTo(0, -l);
      ctx.lineTo(thick / 2, -l * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    // 中心のまぶしい玉
    ctx.beginPath();
    ctx.arc(0, 0, thick * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFloats(ctx, dt) {
  const f = dt / 16.67;
  for (let i = state.floats.length - 1; i >= 0; i--) {
    const t = state.floats[i];
    t.life -= dt;
    if (t.life <= 0) {
      state.floats.splice(i, 1);
      continue;
    }
    const p = 1 - t.life / t.maxLife;
    t.y += t.vy * f;
    t.vy *= 0.96;
    const alpha = Math.max(0, 1 - p);
    const scale = 1 + (1 - t.life / t.maxLife) * 0.4;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(t.x, t.y);
    ctx.scale(scale, scale);
    ctx.font = '900 34px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = t.color;
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(t.text, 0, 0);
    ctx.fillText(t.text, 0, 0);
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
    ctx.fillStyle = '#d4af37';
    ctx.shadowColor = '#f8ecc0';
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
  if (c === 'var(--red)') return '#c23a54';
  if (c === 'var(--cyan)') return '#f0d98c';
  if (c.startsWith('var(')) return '#ffffff';
  return c;
}
