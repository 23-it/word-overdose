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

// 極彩ネオンの粒色（テトリス7色ベース）。
const COMBO_COLORS = [
  ['#00eaff', '#2b7fff', '#ffffff'],
  ['#2bff88', '#00eaff', '#ffffff'],
  ['#ffe600', '#ff9500', '#ff3b5c'],
  ['#ff2e97', '#c04bff', '#00eaff', '#2bff88'],
];

// 度合い（0..4）。ネオンが激しくなるラダー。文言はド派手に。
const HEAT = [
  { name: '', colors: ['#00eaff', '#2b7fff', '#ffffff'], glow: '#00eaff', cls: 'h0' },
  { name: 'NICE!!', colors: ['#2bff88', '#00eaff', '#ffffff'], glow: '#2bff88', cls: 'h1' },
  { name: 'GREAT!!', colors: ['#00eaff', '#2b7fff', '#c04bff'], glow: '#00eaff', cls: 'h2' },
  { name: 'INSANE!!', colors: ['#ffe600', '#ff9500', '#ff3b5c'], glow: '#ffe600', cls: 'h3' },
  { name: 'GODLIKE!!', colors: ['#ff2e97', '#ffe600', '#00eaff', '#2bff88', '#c04bff'], glow: '#ffffff', cls: 'h4' },
];

let cutinEl = null;
let cutinTimer = 0;

let mblurEl = null; // 方向性モーションブラーの feGaussianBlur
let veilLight = null; // 拍で光る全画面ヴェール（screen合成）
let veilDark = null; // 拍で沈む全画面ヴェール

export function initEffects(appElement) {
  appEl = appElement;
  // カットイン文字のオーバーレイを用意（最前面）
  cutinEl = document.createElement('div');
  cutinEl.id = 'cutin';
  cutinEl.className = 'cutin hidden';
  document.body.appendChild(cutinEl);

  // 拍で明暗を作る全画面ヴェール。opacity だけを毎フレーム変えるので
  // GPU合成のみで済み、DOMの再描画が起きない（＝軽い）。
  veilLight = document.createElement('div');
  veilLight.id = 'veil-light';
  veilDark = document.createElement('div');
  veilDark.id = 'veil-dark';
  document.body.appendChild(veilDark);
  document.body.appendChild(veilLight);

  // 揺れの速度に応じて「動いた向きだけ」ぼかすSVGフィルタ。
  // stdDeviation に x y を別々に入れると方向性ブラーになる。
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
  const filter = document.createElementNS(NS, 'filter');
  filter.setAttribute('id', 'mblur');
  filter.setAttribute('x', '-20%');
  filter.setAttribute('y', '-20%');
  filter.setAttribute('width', '140%');
  filter.setAttribute('height', '140%');
  mblurEl = document.createElementNS(NS, 'feGaussianBlur');
  mblurEl.setAttribute('stdDeviation', '0 0');
  filter.appendChild(mblurEl);
  svg.appendChild(filter);
  document.body.appendChild(svg);
}

// 低コンボでも出す景気づけワード（毎回カットインを出すため）。
const HYPE_WORDS = ['GO!!', 'YES!!', 'NICE!!', 'COOL!!', 'POG!!', 'HYPE!!', "LET'S GO!!"];

// 正解の総合演出。game.js からはこれ一本を呼ぶ。
// o: { combo, multiplier, multiplierUp, enteredFever, milestone, score }
//
// 設計方針（ドーパミン＆軽量化）:
//  1. 通常ヒットは「キレ」重視で軽い（ヒットストップ・リング・少量の粒・スコアポップ）
//  2. コンボで滑らかに増強＝登り感
//  3. 節目(5/10)・FEVER は確定の大盤振る舞い
//  4. ランダムに JACKPOT（変動報酬）。予測できない当たりが一番効く
// 毎回フルパワーにしないのは、コントラストが無いと脳が慣れて効かなくなるため。
const JACKPOT_CHANCE = 0.1;

export function celebrate(x, y, o = {}) {
  const combo = o.combo || 0;
  const level = heatLevel(o);
  const heat = HEAT[level];
  const big = !!(o.milestone || o.enteredFever);
  // 変動報酬: 節目以外でも低確率で大当りが降ってくる
  const jackpot = !big && Math.random() < JACKPOT_CHANCE;
  const grand = big || jackpot;

  // === 毎回（軽量・キレ重視） ===
  hitStop(50 + level * 10);
  shake(0.8 + level * 0.5);
  state.punch = Math.max(state.punch, 1.1 + level * 0.25);

  // 着弾の閃光とリング（安価で効く）
  impactStar(x, y, '#ffffff', 0.8 + level * 0.15);
  ring(x, y, heat.colors[0]);

  // 粒は控えめに。コンボで少しずつ増える。
  particles.emit(x, y, {
    count: Math.round((16 + level * 7) * k()),
    speed: 6 + level,
    spread: Math.PI * 2,
    colors: heat.colors,
    size: 5,
    life: 620,
    gravity: 0.035,
  });

  // スコアポップ（毎回の手応え）
  if (o.score) floatText(x, y, '+' + o.score, heat.colors[0]);

  // カットインはコンボが乗ってから（毎回出すと効かなくなる）
  if (level >= 1 && !grand) showCutin(heat.name, heat.cls, level);

  // === ここぞ（節目・FEVER・JACKPOT）だけ大盤振る舞い ===
  if (!grand) return;

  const gLevel = jackpot && !big ? 4 : Math.max(level, 3);
  const gHeat = HEAT[gLevel];

  megaExplosion(x, y, gHeat, 1 + gLevel * 0.2);
  radialLines(x, y, gHeat.glow, gLevel);
  ring(x, y, '#ffffff', 80);
  ring(x, y, gHeat.glow, 170);
  impactStar(x, y, gHeat.glow, 1.5);
  state.aura = { level: gLevel, t: 0, dur: 520 };
  state.bgFlash = Math.max(state.bgFlash, 0.8);
  strobe(gHeat.colors, gLevel >= 4 ? 4 : 2, 55);
  coinShower(gLevel);
  hitStop(110);
  shake(3);
  state.punch = Math.max(state.punch, 2.2);

  let text = gHeat.name;
  if (o.milestone && combo) text = `${combo} COMBO!!`;
  if (jackpot) text = 'JACKPOT!!';
  if (o.enteredFever) text = 'FEVER!!';
  showCutin(text, jackpot ? 'h4' : gHeat.cls, gLevel);
}

// 多層メガ爆発。放射・上昇噴水・きらめきの3レイヤーを一気に。
function megaExplosion(x, y, heat, b = 1) {
  const kk = k();
  // 放射（全方向）
  particles.emit(x, y, {
    count: Math.round(40 * b * kk),
    speed: 8 * b,
    spread: Math.PI * 2,
    colors: heat.colors,
    size: 6,
    life: 750,
    gravity: 0.04,
  });
  // 高速の細かい破片
  particles.emit(x, y, {
    count: Math.round(26 * b * kk),
    speed: 13 * b,
    spread: Math.PI * 2,
    colors: [...heat.colors, '#ffffff'],
    size: 3.5,
    life: 520,
    gravity: 0.02,
  });
  // 上向き噴水
  particles.emit(x, y, {
    count: Math.round(18 * b * kk),
    speed: 12 * b,
    spread: Math.PI / 2.5,
    angle: -Math.PI / 2,
    colors: heat.colors,
    size: 7,
    life: 900,
    gravity: 0.06,
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
// 残像（モーションブラー）を出すか。reduced では無効。
export function motionBlurOn() {
  return intensity !== 'reduced';
}

// キャンバスに描くものがあるか（無ければ全画面塗りを省ける）。
export function hasCanvasContent() {
  return !!(
    particles.count ||
    state.rings.length ||
    state.radials.length ||
    state.stars.length ||
    state.floats.length ||
    state.shatter.length ||
    state.flash ||
    state.aura ||
    state.fever ||
    state.bgFlash > 0.01
  );
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
  beatPhase = 1e9;
  beatStr = 0;
  if (veilLight) veilLight.style.opacity = '0';
  if (veilDark) veilDark.style.opacity = '0';
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
    ctx.fillStyle = '#241a4d';
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

  // 拍の明暗ポンプ
  updateBeatVeils(dt);

  // DOMシェイク＆パンチ
  applyDomTransform(dt);
}

function drawFeverBg(ctx, w, h, t) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const hue = (t * 0.15) % 360;
  const lines = 9; // 本数を絞る（見た目はほぼ変わらず描画量が減る）
  ctx.globalAlpha = 0.13 * (intensity === 'reduced' ? 0.4 : 1);
  ctx.lineWidth = 2;
  for (let i = 0; i < lines; i++) {
    const p = (t * 0.0004 + i / lines) % 1;
    const y = p * h;
    ctx.strokeStyle = `hsl(${(hue + i * 38) % 360}, 100%, 60%)`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y + Math.sin(t * 0.003 + i) * 20);
    ctx.stroke();
  }
  ctx.restore();
}

const auraGradCache = { key: '', grad: null };

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
  // グラデーションは毎フレーム作ると重いので (サイズ, 色) 単位でキャッシュする。
  const key = `${w}x${h}:${heat.glow}`;
  let grad = auraGradCache.key === key ? auraGradCache.grad : null;
  if (!grad) {
    const cx = w / 2;
    const cy = h * 0.42;
    grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.6, 'transparent');
    grad.addColorStop(1, heat.glow);
    auraGradCache.key = key;
    auraGradCache.grad = grad;
  }
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
    ctx.fillStyle = '#00eaff';
    ctx.fillRect(-s.size / 2, -s.size / 6, s.size, s.size / 3);
    ctx.restore();
  }
}

// BGMのキックで呼ばれる拍グルーヴ。
// 指数減衰ではなく「ばね」で動かす: 蹴られて沈み、行き過ぎて戻る＝弾む気持ちよさ。
// さらに拍ごとに左右交互へスイングさせて、頭を振るようなノリを作る。
const K_BOUNCE = 380, D_BOUNCE = 13; // 縦の沈み込み（やや速く戻る）
const K_LEAN = 170, D_LEAN = 8; // 横のスイング（ゆったり）
const K_ZOOM = 300, D_ZOOM = 13; // 拍のズーム

let bounceY = 0, bounceV = 0;
let leanX = 0, leanV = 0;
let zoomP = 0, zoomV = 0;
let beatParity = 0;

// 拍の明暗ポンプ（サイドチェイン風）: キックで光り→沈み→戻る。
let beatPhase = 1e9; // 直近のキックからの経過ms
let beatStr = 0;

export function beat(strength = 1) {
  if (intensity === 'reduced') return;
  bounceV += strength * 120; // 下へ蹴る
  leanV += (beatParity ? 1 : -1) * strength * 40; // 交互に左右へ
  zoomV += strength * 0.35; // わずかに寄る
  beatParity ^= 1;
  beatPhase = 0;
  beatStr = strength;
}

// 明暗ヴェールの更新。光は鋭く一瞬、暗はやや遅れて来て緩やかに戻る。
function updateBeatVeils(dt) {
  if (!veilLight || !veilDark) return;
  if (intensity === 'reduced') {
    setVeil(veilLight, 0, 'l');
    setVeil(veilDark, 0, 'd');
    return;
  }
  beatPhase += dt;
  const p = beatPhase;
  const boost = state.fever ? 1.5 : 1;

  // 光: キックの瞬間に鋭く立ち上がってすぐ消える
  const light = beatStr * Math.exp(-p / 55);
  // 暗: 少し遅れて沈み、次の拍までに戻る（ダッキングの呼吸）
  let dark = 0;
  if (p > 40) {
    const q = p - 40;
    // 次の拍までにしっかり戻す（戻りが遅いと画面が沈みっぱなしになる）
    dark = beatStr * (1 - Math.exp(-q / 50)) * Math.exp(-q / 180);
  }

  setVeil(veilLight, Math.min(0.2, light * 0.09 * boost), 'l');
  setVeil(veilDark, Math.min(0.3, dark * 0.22 * boost), 'd');
}

// 同じ値を書き続けると無駄なスタイル再計算が走るので、変化した時だけ書く。
const lastVeil = { l: -1, d: -1 };
function setVeil(el, v, key) {
  const q = Math.round(v * 200) / 200; // 0.005刻みに量子化
  if (lastVeil[key] === q) return;
  lastVeil[key] = q;
  el.style.opacity = q === 0 ? '0' : q.toFixed(3);
}

let swayT = 0;
let prevX = 0, prevY = 0; // モーションブラー用に前フレーム位置を保持
let blurOn = false;

function applyDomTransform(dt) {
  if (!appEl) return;
  swayT += dt;
  const reduced = intensity === 'reduced';
  const s = Math.min(0.05, dt / 1000); // 積分ステップ（大きすぎると発散するので上限）

  let tx = 0, ty = 0, rot = 0, scale = 1;

  if (!reduced) {
    // --- 拍のばねを積分（蹴られて沈み、行き過ぎて戻る）---
    bounceV += (-K_BOUNCE * bounceY - D_BOUNCE * bounceV) * s;
    bounceY += bounceV * s;
    leanV += (-K_LEAN * leanX - D_LEAN * leanV) * s;
    leanX += leanV * s;
    zoomV += (-K_ZOOM * zoomP - D_ZOOM * zoomV) * s;
    zoomP += zoomV * s;

    // --- 連続ドリフト（メニューと同じ、据え置き）---
    tx += Math.sin(swayT * 0.0016) * 3 + leanX;
    ty += Math.cos(swayT * 0.0013) * 2 + bounceY;
    rot += Math.sin(swayT * 0.0011) * 0.4 + leanX * 0.12; // 横揺れに傾きを連動
    scale *= 1 + zoomP;
  }

  if (state.shake > 0.2) {
    tx += (Math.random() - 0.5) * state.shake;
    ty += (Math.random() - 0.5) * state.shake;
    state.shake *= Math.pow(0.001, dt / 1000); // 減衰
    if (state.shake < 0.2) state.shake = 0;
  }
  if (state.punch > 0.01) {
    scale *= 1 + 0.03 * state.punch;
    state.punch -= dt / 90;
    if (state.punch < 0.01) state.punch = 0;
  }

  appEl.style.transform =
    `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${scale.toFixed(4)})`;

  // --- 動いた向きに沿ったモーションブラー ---
  // 静止時はフィルタを完全に外す（付けっぱなしは描画コストになるため）。
  const dx = tx - prevX;
  const dy = ty - prevY;
  prevX = tx;
  prevY = ty;
  if (reduced) {
    if (blurOn) {
      appEl.style.filter = '';
      blurOn = false;
    }
    return;
  }
  // 閾値を少し高めにして、ゆっくりした漂いではブラーを掛けない（負荷対策）。
  const bx = Math.min(2.6, Math.abs(dx) * 0.5);
  const by = Math.min(2.6, Math.abs(dy) * 0.5);
  if (bx > 0.18 || by > 0.18) {
    if (mblurEl) mblurEl.setAttribute('stdDeviation', `${bx.toFixed(2)} ${by.toFixed(2)}`);
    if (!blurOn) {
      appEl.style.filter = 'url(#mblur)';
      blurOn = true;
    }
  } else if (blurOn) {
    appEl.style.filter = '';
    blurOn = false;
  }
}

function resolveColor(c) {
  if (c === 'var(--red)') return '#ff3b5c';
  if (c === 'var(--cyan)') return '#00eaff';
  if (c.startsWith('var(')) return '#ffffff';
  return c;
}
