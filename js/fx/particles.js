// particles.js — パーティクルシステム（Canvas 2D）。
// 描画は事前生成したグローのスプライトを加算合成で貼る方式。
// （per-particle の shadowBlur は非常に重いので使わない）

const SPRITE_SIZE = 24;
const spriteCache = new Map();

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// 色ごとにグロー円のスプライトを1枚だけ作って使い回す。
function getSprite(color) {
  let s = spriteCache.get(color);
  if (s) return s;
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE_SIZE;
  const g = c.getContext('2d');
  const r = SPRITE_SIZE / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  try {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, color);
    grad.addColorStop(0.6, hexToRgba(color, 0.4));
    grad.addColorStop(1, hexToRgba(color, 0));
  } catch {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  spriteCache.set(color, c);
  return c;
}

export class ParticleSystem {
  constructor(max = 700) {
    this.max = max;
    this.list = [];
  }

  emit(x, y, opts = {}) {
    const {
      count = 20,
      speed = 4,
      spread = Math.PI * 2,
      angle = -Math.PI / 2,
      colors = ['#00eaff', '#c04bff', '#ffe600'],
      size = 4,
      life = 700,
      gravity = 0.02,
      drag = 0.985,
    } = opts;
    for (let i = 0; i < count; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = speed * (0.4 + Math.random() * 0.9);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.9),
        color: colors[(Math.random() * colors.length) | 0],
        gravity,
        drag,
      });
    }
  }

  update(dt, ctx) {
    if (!this.list.length) return;
    const f = dt / 16.67; // 60fps基準の係数
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * f;
      p.vx *= p.drag;
      p.x += p.vx * f;
      p.y += p.vy * f;

      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, t);
      // 消えるにつれて少し縮む
      const s = p.size * (0.5 + t * 0.9);
      ctx.drawImage(getSprite(p.color), p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.restore();
  }

  get count() {
    return this.list.length;
  }
  clear() {
    this.list.length = 0;
  }
}
