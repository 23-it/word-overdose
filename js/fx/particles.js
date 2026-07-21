// particles.js — パーティクルシステム（Canvas 2D）。

export class ParticleSystem {
  constructor(max = 800) {
    this.max = max;
    this.list = [];
  }

  emit(x, y, opts = {}) {
    const {
      count = 20,
      speed = 4,
      spread = Math.PI * 2,
      angle = -Math.PI / 2,
      colors = ['#00f0ff', '#ff2bd6', '#ffe600'],
      size = 4,
      life = 700,
      gravity = 0.02,
      shape = 'rect',
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
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        shape,
      });
    }
  }

  update(dt, ctx) {
    const f = dt / 16.67; // 60fps基準の係数
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * f;
      p.vx *= 0.985;
      p.x += p.vx * f;
      p.y += p.vy * f;
      p.rot += p.vr * f;

      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-s / 2, -s / 2, s, s);
      }
      ctx.restore();
    }
  }

  get count() {
    return this.list.length;
  }
  clear() {
    this.list.length = 0;
  }
}
